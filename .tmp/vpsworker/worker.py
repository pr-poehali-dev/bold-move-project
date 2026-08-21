"""
VPS-воркер (pull-модель, МУЛЬТИТЕНАНТНЫЙ). На вашем сервере, наружу порты открывать НЕ нужно.

Один процесс воркера одновременно обслуживает НЕСКОЛЬКО независимых компаний
(«арендаторов», tenant) — у каждой свой CRM (свой backend + своя БД), свой ключ
X-Webhook-Key и свои линии-номера. Список компаний берётся ДВУМЯ способами, работающими
параллельно:
  1. Статично — из config.py (TENANTS), правится руками, применяется после перезапуска.
  2. Автоматически — из центрального реестра (config.REGISTRY_URL + WORKER_TOKEN), если
     он настроен: воркер сам, раз в REGISTRY_POLL_INTERVAL сек, спрашивает реестр «какие
     компании сейчас подключены» и сам подключает/отключает их БЕЗ перезапуска процесса
     и без правки config.py. Если tenant_id из реестра совпадает с уже заданным вручную
     в TENANTS — приоритет у ручной записи, реестр её не трогает.
Если компания всего одна и реестр не используется — в TENANTS просто один элемент,
поведение не отличается от прежней одиночной установки.

У воркера НЕТ открытых портов наружу (сознательно, ради безопасности сервера) — поэтому
CRM не может сама «постучаться» к нему, и воркер обязан САМ периодически спрашивать CRM
каждой компании, есть ли для неё работа. Для каждой компании из TENANTS запускается свой
независимый набор циклов опроса — они работают параллельно и не мешают друг другу; если
CRM одной компании недоступна, это никак не влияет на остальные.

Опрос по каждой компании идёт с РАЗНОЙ частотой для разных задач (расписание общее для
всех компаний, задаётся в config.py):

  1. Очередь исходящих сообщений (worker_pending) — двухскоростной режим по МСК:
     в рабочие часы (WORK_HOURS_START–WORK_HOURS_END) каждые POLL_INTERVAL_MESSAGES сек,
     вне рабочих часов — реже, раз в POLL_INTERVAL_MESSAGES_NIGHT сек (клиент может
     написать и ночью, поэтому не молчим совсем, но и не держим полную скорость).
  2. Список активных линий (worker_accounts) — чтобы вовремя остановить удалённую/
     отключённую в CRM линию — раз в POLL_INTERVAL_ACCOUNTS сек (по умолчанию 1 час), 24/7.
  3. Запросы на (пере)авторизацию линии (worker_auth_pending) — раз в POLL_INTERVAL_AUTH сек
     (по умолчанию 60 сек), 24/7, чтобы нажатие «Авторизовать» в CRM подхватывалось быстро
     в любое время суток. Пока идёт КОНКРЕТНАЯ попытка входа (после нажатия) — воркер
     временно опрашивает тот же worker_auth_pending чаще, раз в 2 сек, но только на время
     этой одной попытки (максимум 90–300 сек), а не постоянно.

Отправка сообщений и приём входящих (для каждой компании — со своими линиями):
  - Отправляет каждое найденное сообщение с нужной линии (Telegram — Telethon, Max — PyMax)
  - Подтверждает результат в CRM этой же компании (worker_mark_sent)
  - Ловит входящие сообщения от клиентов и передаёт в CRM этой же компании (worker_incoming)

Изоляция между компаниями:
  - Файлы сессий лежат в sessions/<tenant_id>/<external_id>.session (или .max.db) —
    линия "max_1" компании А физически не может задеть файл линии "max_1" компании Б.
  - Реестр запущенных линий в памяти проиндексирован парой (tenant_id, external_id).
  - Защита от частых попыток авторизации (AUTH_COOLDOWN_SEC) также считается отдельно
    для каждой пары (tenant_id, external_id) — сбой в одной компании не блокирует линии
    другой.

Запуск:
    python3 worker.py
(Разовая консольная авторизация через login.py по-прежнему доступна как запасной вариант,
 см. login.py --tenant <tenant_id> <external_id>.)
"""
import asyncio
import json
import os
import time
from datetime import datetime, timedelta, timezone
import urllib.request
import urllib.error

import config
from channels.base import BaseLine
from channels.telegram_ch import TelegramLine

MSK = timezone(timedelta(hours=3))  # в РФ нет перевода времени — фиксированный оффсет UTC+3

# (tenant_id, external_id) -> объект линии (готовой к отправке/приёму)
lines: dict[tuple[str, str], BaseLine] = {}
# (tenant_id, external_id) линий, для которых сейчас идёт процесс авторизации
# (чтобы не запускать дважды)
active_auth: set[tuple[str, str]] = set()

# tenant_id -> Event, который «будит» auth_poll_loop этой компании раньше планового
# интервала (POLL_INTERVAL_AUTH) — используется мини-HTTP-приёмником пуша ниже, чтобы
# нажатие «Авторизовать» в CRM подхватывалось почти мгновенно, а не жда́ло до 60 сек.
wake_events: dict[str, asyncio.Event] = {}

# (tenant_id, external_id) -> время последней попытки входа (защита от частых повторных
# попыток — без неё сбойный цикл может «долбить» Max/Telegram запросами SMS/QR и привести
# к временной блокировке номера самим мессенджером). Хранится В ФАЙЛЕ, а не только
# в памяти — иначе перезапуск службы (systemd restart) сбрасывает защиту, и если
# в CRM остался «зависший» requested-статус, воркер тут же полезет в Max заново.
# Ключ в файле — строка "tenant_id::external_id" (JSON не умеет кортежи-ключи).
AUTH_COOLDOWN_SEC = 180
_ATTEMPTS_FILE = os.path.join(os.path.dirname(__file__), "sessions", "auth_attempts.json")


def _attempt_key(tenant_id: str, ext_id: str) -> str:
    return f"{tenant_id}::{ext_id}"


def _load_auth_attempts() -> dict[str, float]:
    try:
        with open(_ATTEMPTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {}


def _save_auth_attempt(tenant_id: str, ext_id: str, ts: float) -> None:
    data = _load_auth_attempts()
    data[_attempt_key(tenant_id, ext_id)] = ts
    try:
        os.makedirs(os.path.dirname(_ATTEMPTS_FILE), exist_ok=True)
        with open(_ATTEMPTS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception:  # noqa: BLE001
        pass


def fetch_registry_tenants() -> list[dict] | None:
    """Опрашивает центральный реестр компаний (если настроен в config.py), чтобы получить
    список ВСЕХ компаний, у кого сейчас включена интеграция, без ручной правки TENANTS.

    Возвращает список tenant-словарей в том же формате, что и config.TENANTS
    (tenant_id, crm_base_url, webhook_key, accounts), либо None, если реестр не настроен
    или ответ не удалось получить (в этом случае вызывающий код просто использует то, что
    было получено на предыдущем успешном опросе, — временная недоступность реестра не
    должна обрывать уже работающие линии)."""
    registry_url = getattr(config, "REGISTRY_URL", None)
    worker_token = getattr(config, "WORKER_TOKEN", None)
    if not registry_url or not worker_token:
        return None
    req = urllib.request.Request(
        registry_url, method="GET",
        headers={"Content-Type": "application/json", "X-Worker-Token": worker_token},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f"[registry] ошибка {e.code}: {e.read().decode('utf-8', 'ignore')[:300]}")
        return None
    except Exception as e:  # noqa: BLE001
        print(f"[registry] недоступен: {e}")
        return None

    tenants = []
    for row in data.get("tenants", []):
        tenant_id = row.get("tenant_id") or (f"company_{row['company_id']}" if row.get("company_id") else None)
        if not tenant_id or not row.get("crm_base_url") or not row.get("webhook_key"):
            print(f"[registry] пропускаю запись без tenant_id/crm_base_url/webhook_key: {row}")
            continue
        tenants.append({
            "tenant_id": str(tenant_id),
            "crm_base_url": row["crm_base_url"],
            "webhook_key": row["webhook_key"],
            "accounts": row.get("accounts", []),
            "moysklad_sync": row.get("moysklad_sync", False),
        })
    return tenants


def crm_request(tenant: dict, action: str, method: str = "GET", body: dict | None = None):
    """HTTP-запрос к CRM КОНКРЕТНОЙ компании — url и ключ берутся из её записи в TENANTS,
    а не из общих настроек (у каждой компании свой backend и свой X-Webhook-Key)."""
    url = f"{tenant['crm_base_url']}?action={action}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json", "X-Webhook-Key": tenant["webhook_key"]},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode("utf-8", "ignore")[:300]}
    except Exception as e:  # noqa: BLE001
        return 599, {"error": str(e)}


def make_on_incoming(tenant: dict):
    """Возвращает колбэк входящих сообщений, «замкнутый» на конкретную компанию —
    чтобы сообщение с линии этой компании ушло именно в её CRM, а не в чужую."""
    tenant_id = tenant["tenant_id"]

    async def on_incoming(channel, phone, chat_id, external_msg_id, text,
                           reply_to_external_msg_id=None, direction="in"):
        """Единый колбэк сообщений в чатах линии: передаём в CRM этой компании.

        direction: 'in' — написал клиент; 'out' — написали МЫ (в т.ч. вручную с телефона
        тем же аккаунтом-линией). Определяется по автору сообщения в самом канале."""
        crm_request(tenant, "worker_incoming", "POST", {
            "channel": channel, "phone": phone, "chat_id": chat_id,
            "external_msg_id": external_msg_id, "text": text,
            "reply_to_external_msg_id": reply_to_external_msg_id,
            "direction": direction,
        })
        print(f"[{direction}/{channel}] [{tenant_id}] {phone or chat_id}: {text[:50]}")

    return on_incoming


def make_on_read_receipt(tenant: dict):
    """Возвращает колбэк «прочитано», замкнутый на конкретную компанию."""
    tenant_id = tenant["tenant_id"]

    async def on_read_receipt(channel: str, chat_id: str, max_external_msg_id: str | None):
        """Собеседник прочитал наше(и) исходящее(ие) сообщение(я) — сообщаем в CRM этой
        компании, чтобы в интерфейсе появилась «вторая галочка» (статус «Прочитано»)."""
        crm_request(tenant, "worker_mark_read", "POST", {
            "channel": channel, "chat_id": chat_id, "max_external_msg_id": max_external_msg_id,
        })
        print(f"[read/{channel}] [{tenant_id}] chat {chat_id}: "
              f"прочитано до {max_external_msg_id or '(весь чат)'}")

    return on_read_receipt


async def send_one(tenant: dict, msg: dict):
    """Отправить одно исходящее сообщение (компании tenant) и отчитаться в её CRM."""
    tenant_id = tenant["tenant_id"]
    ext_id = msg.get("account_external_id")
    line = lines.get((tenant_id, ext_id))
    if not line:
        crm_request(tenant, "worker_mark_sent", "POST",
                    {"message_id": msg["id"], "ok": False, "error": f"Линия '{ext_id}' не запущена"})
        return
    try:
        external_id, chat_id = await line.send(
            msg.get("phone"), msg.get("text") or "",
            msg.get("reply_to_external_msg_id"),
        )
        crm_request(tenant, "worker_mark_sent", "POST",
                    {"message_id": msg["id"], "ok": True,
                     "external_msg_id": external_id, "chat_id": chat_id})
        print(f"[out/{line.channel}] [{tenant_id}] #{msg['id']} → {msg.get('phone')} ok")
    except Exception as e:  # noqa: BLE001
        crm_request(tenant, "worker_mark_sent", "POST",
                    {"message_id": msg["id"], "ok": False, "error": str(e)[:300]})
        print(f"[out/{line.channel}] [{tenant_id}] #{msg['id']} error: {e}")


def _apply_removed_lines(tenant_id: str, accounts: list[dict]):
    """Если линию удалили или выключили в CRM этой компании — закрываем её подключение
    на VPS, чтобы оно не «висело» в памяти и не конфликтовало с новой линией на том же
    номере. Затрагивает только линии ЭТОЙ компании — другие tenant'ы не смотрим."""
    current_ext_ids = {acc["external_id"] for acc in accounts}
    for key in list(lines.keys()):
        t_id, ext_id = key
        if t_id != tenant_id:
            continue
        if ext_id not in current_ext_ids:
            line = lines.pop(key)
            asyncio.create_task(line.stop())
            print(f"[stop] [{tenant_id}] линия '{ext_id}' удалена/отключена в CRM — соединение закрыто")


def _in_work_hours() -> bool:
    """Рабочее окно по московскому времени (WORK_HOURS_START–WORK_HOURS_END из config.py)."""
    hour = datetime.now(MSK).hour
    start, end = config.WORK_HOURS_START, config.WORK_HOURS_END
    return start <= hour < end


async def messages_loop(tenant: dict):
    """Очередь исходящих сообщений ОДНОЙ компании — двухскоростной режим по московскому
    времени: в рабочие часы (WORK_HOURS_START–WORK_HOURS_END) опрашиваем каждые
    POLL_INTERVAL_MESSAGES сек (живое общение с клиентами), вне рабочих часов —
    реже, раз в POLL_INTERVAL_MESSAGES_NIGHT сек (клиент всё же может написать
    ночью — молчать вообще не хотим, но и держать полную скорость незачем)."""
    tenant_id = tenant["tenant_id"]
    while True:
        status, data = crm_request(tenant, "worker_pending")
        if status == 200:
            for msg in data.get("messages", []):
                await send_one(tenant, msg)
        else:
            print(f"[messages] [{tenant_id}] CRM ответила {status}: {data}")
        interval = config.POLL_INTERVAL_MESSAGES if _in_work_hours() else config.POLL_INTERVAL_MESSAGES_NIGHT
        await asyncio.sleep(interval)


async def accounts_loop(tenant: dict):
    """Список активных линий ОДНОЙ компании — раз в POLL_INTERVAL_ACCOUNTS сек
    (по умолчанию 1 час), 24/7, чтобы вовремя остановить отключённую/удалённую в CRM линию."""
    tenant_id = tenant["tenant_id"]
    while True:
        status, data = crm_request(tenant, "worker_accounts")
        if status == 200:
            _apply_removed_lines(tenant_id, data.get("accounts", []))
        else:
            print(f"[accounts] [{tenant_id}] CRM ответила {status}: {data}")
        await asyncio.sleep(config.POLL_INTERVAL_ACCOUNTS)


async def auth_poll_loop(tenant: dict):
    """Запросы на (пере)авторизацию линии ОДНОЙ компании — раз в POLL_INTERVAL_AUTH сек
    (по умолчанию 60 сек), 24/7, чтобы нажатие «Авторизовать» в CRM подхватывалось быстро
    в любое время суток. Дополнительно ждём wake_events[tenant_id] — если CRM этой компании
    настроен «Адрес пробуждения воркера» и она прислала пуш (см. push_server ниже), опрос
    случится немедленно, не дожидаясь конца текущего интервала сна."""
    tenant_id = tenant["tenant_id"]
    wake = wake_events.setdefault(tenant_id, asyncio.Event())
    while True:
        status, data = crm_request(tenant, "worker_auth_pending")
        if status == 200:
            for acc in data.get("accounts", []):
                key = (tenant_id, acc.get("external_id"))
                if acc.get("auth_status") == "requested" and key not in active_auth:
                    print(f"[auth_poll] [{tenant_id}] найден запрос на вход: '{acc.get('external_id')}'")
                    asyncio.create_task(run_auth(tenant, acc))
        else:
            print(f"[auth_poll] [{tenant_id}] CRM ответила {status}: {data}")
        wake.clear()
        try:
            await asyncio.wait_for(wake.wait(), timeout=config.POLL_INTERVAL_AUTH)
            print(f"[auth_poll] [{tenant_id}] разбужен пушем — опрашиваю CRM немедленно")
        except asyncio.TimeoutError:
            pass


def _seconds_until_next_sync() -> float:
    """Сколько секунд ждать до ближайшего MOYSKLAD_SYNC_HOUR:MOYSKLAD_SYNC_MINUTE по МСК."""
    now = datetime.now(MSK)
    target = now.replace(hour=config.MOYSKLAD_SYNC_HOUR, minute=config.MOYSKLAD_SYNC_MINUTE,
                          second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


def _ms_batch(tenant: dict, action: str, body: dict | None = None) -> dict:
    """Один вызов пачечного action МойСклад-эндпоинта CRM этой компании (X-Webhook-Key,
    тот же что и у мессенджеров этой же компании)."""
    status, data = crm_request(tenant, action, "POST", body or {})
    if status != 200:
        raise RuntimeError(f"{action} -> {status}: {data}")
    return data


async def moysklad_sync_once(tenant: dict):
    """Полная синхронизация с МойСклад ОДНОЙ компании: контрагенты → продажи → история
    заказов → метрики. Те же action, что дёргает кнопка «Загрузить из МойСклад» в CRM,
    только пачками до конца."""
    tenant_id = tenant["tenant_id"]
    print(f"[moysklad_sync] [{tenant_id}] запуск ежедневной синхронизации")
    try:
        offset, total = 0, 1
        while offset < total:
            res = _ms_batch(tenant, "import", {"offset": offset, "limit": 100})
            offset, total = res["offset"], res["total"]
        print(f"[moysklad_sync] [{tenant_id}] контрагентов загружено: {offset}")

        offset, total = 0, 1
        while offset < total:
            res = _ms_batch(tenant, "sync_sales", {"offset": offset, "limit": 100})
            offset, total = res["offset"], res["total"]
        print(f"[moysklad_sync] [{tenant_id}] продажи обновлены: {offset}")

        offset, total, since = 0, 1, None
        while offset < total:
            body = {"offset": offset, "limit": 100}
            if since:
                body["since"] = since
            res = _ms_batch(tenant, "sync_demands", body)
            if res.get("skipped"):
                print(f"[moysklad_sync] [{tenant_id}] история заказов уже свежая, пропускаем")
                break
            since = res.get("since") or since
            offset, total = res["offset"], res["total"]
        else:
            _ms_batch(tenant, "sync_demands_finish")
            print(f"[moysklad_sync] [{tenant_id}] история заказов и метрики частоты обновлены "
                  f"(заказов: {offset})")
        print(f"[moysklad_sync] [{tenant_id}] готово")
    except Exception as e:  # noqa: BLE001
        print(f"[moysklad_sync] [{tenant_id}] ошибка: {e}")


async def moysklad_sync_loop(tenant: dict):
    """Ждёт до MOYSKLAD_SYNC_HOUR:MOYSKLAD_SYNC_MINUTE по МСК (по умолчанию 00:00) и раз
    в сутки запускает полную синхронизацию с МойСклад ОДНОЙ компании — вместо того чтобы
    это делал браузер каждого сотрудника при открытии раздела «Контрагенты». Запускается
    только для компаний, у которых в TENANTS стоит "moysklad_sync": True."""
    tenant_id = tenant["tenant_id"]
    while True:
        wait_sec = _seconds_until_next_sync()
        print(f"[moysklad_sync] [{tenant_id}] следующий запуск через {int(wait_sec // 60)} мин")
        await asyncio.sleep(wait_sec)
        await moysklad_sync_once(tenant)


def build_line(tenant: dict, acc: dict) -> BaseLine | None:
    """Создаёт объект линии по её каналу — привязанную к конкретной компании (tenant):
    свой колбэк входящих, своя изолированная папка файлов сессий."""
    tenant_id = tenant["tenant_id"]
    channel = acc.get("channel")
    ext_id = acc["external_id"]
    session_dir = os.path.join(os.path.dirname(__file__), "sessions", tenant_id)
    on_incoming = make_on_incoming(tenant)
    on_read = make_on_read_receipt(tenant)
    if channel == "telegram":
        return TelegramLine(ext_id, on_incoming, on_read, tenant_id=tenant_id, session_dir=session_dir)
    if channel == "max":
        # Импорт здесь, чтобы отсутствие pymax не ломало Telegram-only установки
        try:
            from channels.max_ch import MaxLine
        except ImportError:
            print(f"[skip] [{tenant_id}] '{ext_id}': не установлен maxapi-python (pip install maxapi-python)")
            return None
        phone = acc.get("phone")
        if not phone:
            print(f"[skip] [{tenant_id}] '{ext_id}': для Max нужно указать 'phone' в CRM/config")
            return None
        return MaxLine(ext_id, on_incoming, phone, on_read, tenant_id=tenant_id, session_dir=session_dir)
    print(f"[skip] [{tenant_id}] неизвестный канал '{channel}' для линии '{ext_id}'")
    return None


def fetch_accounts(tenant: dict) -> list[dict]:
    """Список линий ОДНОЙ компании берём из её CRM (Интеграции → Мессенджеры) — там же
    хранится и номер телефона для Max. Если CRM недоступна, используем accounts из
    config.TENANTS как резерв."""
    tenant_id = tenant["tenant_id"]
    status, data = crm_request(tenant, "worker_accounts")
    if status == 200 and data.get("accounts"):
        return data["accounts"]
    print(f"[accounts] [{tenant_id}] не удалось получить линии из CRM ({status}: {data}), "
          f"беру из config.TENANTS")
    return tenant.get("accounts", [])


def start_runtime(tenant_id: str, ext_id: str, line: BaseLine):
    """Регистрирует линию как готовую и запускает её приём входящих в фоне."""
    lines[(tenant_id, ext_id)] = line
    asyncio.create_task(line.run_forever())


# ---------------- Удалённая авторизация линий (через CRM, без консоли VPS) ----------------

async def auth_report(tenant: dict, acc_id: int, status: str, payload: str | None = None,
                       consume_value: bool = False):
    crm_request(tenant, "worker_auth_update", "POST", {
        "id": acc_id, "status": status, "payload": payload, "consume_value": consume_value,
    })


async def sync_authorized_status(tenant: dict, acc: dict, line: BaseLine):
    """Линия поднялась сама по сохранённой сессии (при старте воркера) — сразу сообщаем
    в CRM этой компании статус "authorized", чтобы бейдж в интерфейсе не расходился
    с реальностью и повторное нажатие «Авторизовать» не пыталось открыть второе
    конфликтующее подключение."""
    acc_id = acc.get("id")
    if not acc_id:
        return
    try:
        if await line.is_authorized():
            await auth_report(tenant, acc_id, "authorized", None, consume_value=True)
    except Exception:  # noqa: BLE001
        pass


async def auth_wait_value(tenant: dict, acc_id: int, expected_status: str, timeout: int = 300) -> str:
    """Ждём, пока админ введёт код/пароль в соответствующее поле в CRM этой компании."""
    elapsed = 0
    while elapsed < timeout:
        status, data = crm_request(tenant, "worker_auth_pending")
        if status == 200:
            for row in data.get("accounts", []):
                if row.get("id") == acc_id and row.get("auth_status") == expected_status and row.get("auth_value"):
                    return row["auth_value"]
        await asyncio.sleep(2)
        elapsed += 2
    raise TimeoutError("Истекло время ожидания кода от администратора")


AUTH_TIMEOUT_SEC = 480  # жёсткий предел на весь процесс входа (SMS-код + пароль 2FA) — не даёт зависнуть навечно


async def run_auth(tenant: dict, acc: dict):
    """Проводит полную удалённую авторизацию одной линии ОДНОЙ компании по запросу из её CRM."""
    tenant_id = tenant["tenant_id"]
    acc_id = acc["id"]
    ext_id = acc["external_id"]
    key = (tenant_id, ext_id)
    print(f"[auth] [{tenant_id}] линия '{ext_id}': получен запрос на авторизацию (id={acc_id})")
    if key in active_auth:
        print(f"[auth] [{tenant_id}] линия '{ext_id}': уже идёт попытка входа, пропускаем повтор")
        return

    now = time.time()
    last = _load_auth_attempts().get(_attempt_key(tenant_id, ext_id))
    if last is not None and now - last < AUTH_COOLDOWN_SEC:
        wait_left = int(AUTH_COOLDOWN_SEC - (now - last))
        print(f"[auth] [{tenant_id}] линия '{ext_id}': слишком частые попытки входа, "
              f"подождите ещё {wait_left} сек (защита от блокировки номера)")
        await auth_report(
            tenant, acc_id, "error",
            f"Слишком частые попытки входа. Подождите {wait_left} сек. и попробуйте снова "
            f"(защита от временной блокировки номера мессенджером).",
        )
        return
    _save_auth_attempt(tenant_id, ext_id, now)

    active_auth.add(key)
    try:
        line = lines.get(key) or build_line(tenant, acc)
        if not line:
            print(f"[auth] [{tenant_id}] линия '{ext_id}': build_line вернул None (нет модуля/номера)")
            await auth_report(tenant, acc_id, "error", "Не удалось создать линию — проверьте канал/номер телефона")
            return

        async def report(status: str, payload: str | None = None, consume_value: bool = False):
            print(f"[auth] [{tenant_id}] линия '{ext_id}': статус -> {status}")
            await auth_report(tenant, acc_id, status, payload, consume_value)

        async def wait_value(expected_status: str) -> str:
            return await auth_wait_value(tenant, acc_id, expected_status)

        print(f"[auth] [{tenant_id}] линия '{ext_id}': запускаем line.auth() (таймаут {AUTH_TIMEOUT_SEC} сек)")
        await asyncio.wait_for(line.auth(report, wait_value), timeout=AUTH_TIMEOUT_SEC)
        if key not in lines:
            start_runtime(tenant_id, ext_id, line)
        print(f"[auth] [{tenant_id}] линия '{ext_id}' авторизована через CRM")
    except asyncio.TimeoutError:
        print(f"[auth] [{tenant_id}] линия '{ext_id}': истёк таймаут {AUTH_TIMEOUT_SEC} сек, обрываем попытку")
        await auth_report(tenant, acc_id, "error",
                           "Сервер Max/Telegram не ответил вовремя. Попробуйте ещё раз позже.")
    except Exception as e:  # noqa: BLE001
        await auth_report(tenant, acc_id, "error", str(e)[:300])
        print(f"[auth] [{tenant_id}] линия '{ext_id}' — ошибка: {e!r}")
    finally:
        active_auth.discard(key)


async def start_tenant(tenant: dict):
    """Поднимает все готовые (уже авторизованные) линии одной компании и возвращает
    список асинхронных задач опроса CRM этой компании — их нужно запустить в общем
    asyncio.gather() вместе с задачами остальных компаний."""
    tenant_id = tenant["tenant_id"]
    for acc in fetch_accounts(tenant):
        line = build_line(tenant, acc)
        if not line:
            continue
        try:
            if await line.start():
                lines[(tenant_id, acc["external_id"])] = line
                await sync_authorized_status(tenant, acc, line)
        except Exception as e:  # noqa: BLE001
            print(f"[!] [{tenant_id}] Линия '{acc['external_id']}' не запущена: {e}")

    tasks = [messages_loop(tenant), accounts_loop(tenant), auth_poll_loop(tenant)]
    if tenant.get("moysklad_sync"):
        tasks.append(moysklad_sync_loop(tenant))
    return tasks


async def run_tenant_forever(tenant: dict):
    """Поднимает ОДНУ компанию (её линии + циклы опроса) и держит их работающими, пока
    эту задачу не отменят. Используется для компаний, подключаемых ДИНАМИЧЕСКИ через
    центральный реестр (registry_supervisor_loop) — в отличие от компаний из статичного
    config.TENANTS, такую задачу можно отменить на лету, без перезапуска всего процесса,
    когда компания пропадёт из реестра (выключит интеграцию у себя в CRM)."""
    tenant_id = tenant["tenant_id"]
    tasks = await start_tenant(tenant)
    my_lines = [line for (t_id, _), line in lines.items() if t_id == tenant_id]
    await asyncio.gather(*tasks, *[line.run_forever() for line in my_lines])


async def _stop_tenant_task(tenant_id: str, task: asyncio.Task):
    """Останавливает динамически запущенную компанию: отменяет её задачу опроса и
    закрывает все её линии, чтобы соединения не «висели» в памяти процесса."""
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    except Exception as e:  # noqa: BLE001
        print(f"[registry] [{tenant_id}] ошибка при остановке: {e}")
    for key in list(lines.keys()):
        t_id, ext_id = key
        if t_id != tenant_id:
            continue
        line = lines.pop(key)
        try:
            await line.stop()
        except Exception:  # noqa: BLE001
            pass
    print(f"[registry] [{tenant_id}] компания отключена (пропала из реестра)")


async def registry_supervisor_loop():
    """Раз в config.REGISTRY_POLL_INTERVAL сек (по умолчанию 3600 — 1 час) опрашивает
    центральный реестр компаний (config.REGISTRY_URL) и САМ подключает новые компании /
    отключает пропавшие — без перезапуска процесса и без правки config.py руками.

    Компании, уже прописанные вручную в config.TENANTS, реестр не трогает — ручная запись
    всегда в приоритете (если tenant_id совпадает, запись из реестра просто игнорируется),
    чтобы не запустить одну и ту же компанию дважды параллельно."""
    static_ids = {t["tenant_id"] for t in config.TENANTS}
    running: dict[str, asyncio.Task] = {}
    interval = getattr(config, "REGISTRY_POLL_INTERVAL", 3600)
    while True:
        tenants = fetch_registry_tenants()
        if tenants is not None:
            seen_ids = set()
            for tenant in tenants:
                tenant_id = tenant["tenant_id"]
                if tenant_id in static_ids:
                    continue  # уже обслуживается вручную из TENANTS — не дублируем
                seen_ids.add(tenant_id)
                if tenant_id not in running:
                    print(f"[registry] [{tenant_id}] новая компания в реестре — подключаю")
                    running[tenant_id] = asyncio.create_task(run_tenant_forever(tenant))
            for tenant_id in list(running.keys()):
                if tenant_id not in seen_ids:
                    await _stop_tenant_task(tenant_id, running.pop(tenant_id))
        await asyncio.sleep(interval)


# ---------------- Мгновенное пробуждение (push) — необязательное ускорение auth_poll_loop ----------------
# По умолчанию воркер узнаёт о нажатии «Авторизовать» в течение POLL_INTERVAL_AUTH (60 сек) —
# этого обычно достаточно. Если хочется, чтобы вход начинался практически мгновенно, можно
# поднять локальный HTTP-приёмник пуша (см. WORKER_PUSH_PORT в config.py) и указать его адрес
# (через nginx-домен, проксирующий на этот порт) в CRM: Интеграции → Мессенджеры → «Адрес
# пробуждения воркера». Открывать порт наружу напрямую не нужно — только через nginx/домен.
# Если WORKER_PUSH_PORT не задан — эта возможность просто не используется, ничего не сломается.

async def _handle_push_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Разбирает один простой HTTP POST-запрос (без внешних библиотек — только asyncio),
    вида POST /worker-push с телом {"tenant_id": "...", "event": "auth"}, и «будит»
    auth_poll_loop нужной компании (или всех компаний, если tenant_id не указан/не найден)."""
    try:
        request_line = await asyncio.wait_for(reader.readline(), timeout=5)
        headers: dict[str, str] = {}
        while True:
            line = await asyncio.wait_for(reader.readline(), timeout=5)
            if not line or line in (b"\r\n", b"\n"):
                break
            if b":" in line:
                k, _, v = line.partition(b":")
                headers[k.decode().strip().lower()] = v.decode().strip()
        length = int(headers.get("content-length", "0") or "0")
        body_raw = await asyncio.wait_for(reader.readexactly(length), timeout=5) if length else b""

        tenant_id = None
        if request_line.startswith(b"POST"):
            try:
                payload = json.loads(body_raw.decode("utf-8")) if body_raw else {}
                tenant_id = payload.get("tenant_id")
            except Exception:  # noqa: BLE001
                payload = {}
            if tenant_id and tenant_id in wake_events:
                wake_events[tenant_id].set()
            else:
                # tenant_id не пришёл или не совпал ни с одной известной компанией —
                # на всякий случай будим все, чтобы пуш не потерялся.
                for ev in wake_events.values():
                    ev.set()
            body = b'{"ok": true}'
        else:
            body = b'{"error": "not found"}'
        resp = (b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
                b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)
        writer.write(resp)
        await writer.drain()
    except Exception as e:  # noqa: BLE001
        print(f"[push_server] ошибка обработки запроса: {e}")
    finally:
        writer.close()


async def push_server(port: int):
    """Локальный HTTP-приёмник пуша — слушает ТОЛЬКО 127.0.0.1 (наружу не торчит сам по
    себе, доступ снаружи даёт только nginx, проксирующий на этот порт)."""
    server = await asyncio.start_server(_handle_push_client, "127.0.0.1", port)
    print(f"[push_server] слушаю 127.0.0.1:{port} (/worker-push) для мгновенного пробуждения")
    async with server:
        await server.serve_forever()


async def main():
    use_registry = bool(getattr(config, "REGISTRY_URL", None) and getattr(config, "WORKER_TOKEN", None))
    if not config.TENANTS and not use_registry:
        print("В config.py пуст список TENANTS и не настроен REGISTRY_URL/WORKER_TOKEN — "
              "нечего обслуживать.")
        return

    all_tasks: list = []
    for tenant in config.TENANTS:
        tenant_id = tenant["tenant_id"]
        wake_events.setdefault(tenant_id, asyncio.Event())
        print(f"[start] [{tenant_id}] запуск линий компании (config.TENANTS)…")
        all_tasks += await start_tenant(tenant)

    if use_registry:
        all_tasks.append(registry_supervisor_loop())
        print(f"[registry] автоподхват компаний включён ({config.REGISTRY_URL})")

    # Порт приёмника пуша: сначала смотрим переменную окружения WORKER_PUSH_PORT (удобно
    # задавать через systemd Environment=, без правки config.py), иначе — config.py.
    push_port = os.environ.get("WORKER_PUSH_PORT") or getattr(config, "WORKER_PUSH_PORT", None)
    if push_port:
        all_tasks.append(push_server(int(push_port)))

    if not lines and not use_registry:
        print("Нет ни одной готовой линии ни у одной компании. Авторизуйте линию кнопкой "
              "«Авторизовать» в CRM нужной компании (Интеграции → Мессенджеры) — воркер "
              "продолжит опрашивать запросы на вход.")

    print(f"Воркер запущен. Компаний из config.TENANTS: {len(config.TENANTS)}."
          f"{' Плюс автоподхват через реестр.' if use_registry else ''} "
          f"Ожидание сообщений и запросов авторизации из CRM…")
    await asyncio.gather(*all_tasks, *[l.run_forever() for l in lines.values()])


if __name__ == "__main__":
    asyncio.run(main())