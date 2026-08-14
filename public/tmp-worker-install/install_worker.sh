cat > /opt/crm-worker/worker.py << 'WORKER_EOF'
"""
Telegram-worker dlya CRM "Kasaniya" — MULTI-COMPANY versiya.

V otlichie ot pervoi versii (odna sessiya na server, vhod vruchnuyu po nomeru+kodu),
etot worker odnovremenno obsluzhivaet MNOGO kompanii — u kazhdoi svoi lichnyi
Telegram-akkaunt. Podklyuchenie proishodit PO QR-KODU pryamo v CRM (vkladka
"Integratsii" -> "Lichnyi Telegram" -> "Podklyuchit po QR-kodu"), bez dostupa
k etomu serveru.

Kak eto rabotaet:
1. CRM SAMA "budit" vorkera pushem (POST /worker-push na etom servere,
   port WORKER_PUSH_PORT) v moment poyavleniya novoi zadachi (novoe
   soobschenie na otpravku, zayavka na podklyuchenie linii) — vmesto togo,
   chtoby vorker sam postoyanno sprashival CRM "est' chto-to novoe?".
   Fonovye tsikly (main_loop / poll_and_send_loop) prosypayutsya srazu.
2. NEW_TASK_POLL_SEC / SEND_POLL_SEC ostalis' TOL'KO kak PODSTRAHOVKA — redkii
   opros na sluchai, esli push po kakoi-to prichine ne doshyol (set' morgnula
   i t.p.), chtoby zadacha ne zavisla navsegda.
3. Dlya novoi zayavki na podklyuchenie ("connect"):
   - sozdayotsya TelegramClient s otdel'nym failom sessii sessions/{company_id}.session
   - zapraschivaetsya QR-kod (client.qr_login()), ssylka otpravlyaetsya v CRM
     (status=qr_ready) - CRM pokazyvaet eyo sotrudniku kak kartinku
   - worker zhdyot skanirovaniya (QR u Telegram zhivyot ~30 sek, poetomu
     periodicheski peregenerируем ssylku, poka polzovatel' ne otskaniruet)
   - posle uspeshnogo vhoda - soobschaet CRM status=connected + imya/nomer
4. Dlya kazhdoi PODKLYUCHENNOI kompanii worker parallel'no:
   - slushaet vhodyaschie soobscheniya (peresylaet v CRM, channel-webhook)
   - oprashivaet CRM na predmet soobschenii "na otpravku" (pending-messages)
     i otpravlyaet ih cherez etot akkaunt Telegram
5. Otklyuchenie ("disconnect") - vyhod iz akkaunta (client.log_out()), failed
   sessii udalyaetsya, CRM soobschaetsya status=disconnected.

Nastroika - cherez peremennye okruzheniya (fail .env ryadom):
  TG_API_ID          - iz https://my.telegram.org (odin na vseh - eto ID
                        NASHEGO prilozheniya, ne akkaunta pol'zovatelya)
  TG_API_HASH        - iz https://my.telegram.org
  CRM_WEBHOOK_URL    - adres funktsii crm-manager
  CRM_WORKER_TOKEN   - sekretnyi token voркера (tot zhe, chto TG_PROXY_TOKEN
                        v sekretah proekta) - zaschischaet channel-qr-worker
  WORKER_PUSH_PORT   - port dlya priyoma pushei ot CRM (default 8766),
                        dolzhen sovpadat' s putyom v nginx (sm. UPGRADE.md)
"""

import os
import io
import json
import asyncio
import threading
import requests
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from telethon import TelegramClient, events
from telethon.errors import SessionPasswordNeededError, PasswordHashInvalidError
from telethon.tl.functions.contacts import ImportContactsRequest, DeleteContactsRequest
from telethon.tl.types import InputPhoneContact
from dotenv import load_dotenv

load_dotenv()

API_ID = int(os.environ["TG_API_ID"])
API_HASH = os.environ["TG_API_HASH"]
CRM_WEBHOOK_URL = os.environ["CRM_WEBHOOK_URL"]
CRM_WORKER_TOKEN = os.environ["CRM_WORKER_TOKEN"]

# Раньше это были ОСНОВНЫМ механизмом (воркер сам спрашивал CRM каждые
# несколько секунд) — теперь CRM сама "будит" воркер пушем (см. PUSH_PORT
# ниже) в момент появления новой задачи, а эти интервалы остались только
# ПОДСТРАХОВКОЙ на случай, если пуш по какой-то причине не дошёл (сеть
# моргнула и т.п.) — поэтому их можно держать редкими, не тратя лимит вызовов
# облачных функций попусту.
NEW_TASK_POLL_SEC = int(os.environ.get("NEW_TASK_POLL_SEC", "300"))
SEND_POLL_SEC = int(os.environ.get("SEND_POLL_SEC", "300"))
SESSIONS_DIR = os.environ.get("SESSIONS_DIR", "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

# ── Приёмник пушей от CRM ────────────────────────────────────────────────────
# Лёгкий HTTP-сервер на отдельном порту (тот же паттерн, что и tools/tg-proxy/
# tg_proxy.py — только стандартная библиотека, без новых зависимостей).
# Получив POST /worker-push, сразу выставляет событие — активный цикл опроса
# (poll_and_send_loop / main_loop) просыпается немедленно, не дожидаясь своего
# обычного интервала. Защищён тем же токеном, что и остальные эндпоинты
# воркера (CRM_WORKER_TOKEN == TG_PROXY_TOKEN в секретах проекта).
PUSH_PORT = int(os.environ.get("WORKER_PUSH_PORT", "8766"))
_wake_send = threading.Event()
_wake_tasks = threading.Event()


class _PushHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[worker-push] {self.address_string()} - {fmt % args}")

    def _send_json(self, status, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"ok": True})
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/worker-push":
            self._send_json(404, {"error": "not found"})
            return
        if self.headers.get("X-Proxy-Token") != CRM_WORKER_TOKEN:
            self._send_json(401, {"error": "unauthorized"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length) or b"{}")
            reason = body.get("reason", "")
        except Exception:
            reason = ""
        # qr-connect — новая заявка на подключение линии (будим main_loop),
        # send-message — новое сообщение на отправку (будим poll_and_send_loop
        # каждой активной компании). На всякий случай будим оба — дёшево, а
        # реакция мгновенная в любом случае.
        _wake_tasks.set()
        _wake_send.set()
        print(f"[worker-push] разбужен ({reason or 'unknown'})")
        self._send_json(200, {"ok": True})


def start_push_server():
    server = ThreadingHTTPServer(("0.0.0.0", PUSH_PORT), _PushHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"[worker-push] слушаю пуши от CRM на 0.0.0.0:{PUSH_PORT}")


async def _sleep_or_wake(event: threading.Event, timeout_sec: int):
    """Спит timeout_sec секунд, но просыпается раньше, если пришёл пуш."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, event.wait, timeout_sec)
    event.clear()

# SOCKS5-proksi dlya soedineniya s Telegram — nuzhen, kogda hoster blokiruet
# pryamye podklyucheniya k dата-tsentram Telegram (MTProto). Esli TG_PROXY_HOST
# ne zadan — Telethon podklyuchaetsya napryamuyu, kak ran'she.
TG_PROXY_HOST = os.environ.get("TG_PROXY_HOST")
TG_PROXY_PORT = int(os.environ.get("TG_PROXY_PORT", "0") or 0)
TG_PROXY_USER = os.environ.get("TG_PROXY_USER")
TG_PROXY_PASS = os.environ.get("TG_PROXY_PASS")

TELETHON_PROXY = None
if TG_PROXY_HOST and TG_PROXY_PORT:
    import socks
    TELETHON_PROXY = (socks.SOCKS5, TG_PROXY_HOST, TG_PROXY_PORT, True, TG_PROXY_USER, TG_PROXY_PASS)
    print(f"[qr-worker] ispol'zuetsya SOCKS5-proksi {TG_PROXY_HOST}:{TG_PROXY_PORT} dlya svyazi s Telegram")

# company_id -> asyncio.Task (fonovyi tsikl slushaniya + otpravki dlya etoi kompanii)
active_clients: dict[int, TelegramClient] = {}
active_tasks: dict[int, list[asyncio.Task]] = {}


def _worker_headers():
    return {"X-Worker-Token": CRM_WORKER_TOKEN, "Content-Type": "application/json"}


def fetch_password(company_id: int, channel: str):
    """Sprashivaet u CRM — vvyol li sotrudnik oblachnyi parol' (2FA) v okne QR.
    Vozvraschaet None, esli parol' eschyo ne vveden."""
    try:
        resp = requests.get(
            f"{CRM_WEBHOOK_URL}?r=channel-qr-worker-password&company_id={company_id}&channel={channel}",
            headers=_worker_headers(), timeout=15,
        )
        if resp.status_code != 200:
            return None
        return resp.json().get("password")
    except Exception as e:
        print(f"[qr-worker] company={company_id} oshibka zaprosa parolya: {e}")
        return None


def fetch_worker_tasks():
    """Sprashivaet u CRM novye zadachi (connect/disconnect) i spisok uzhe
    podklyuchennyh kompanii. Ne brosaet isklyucheniya naruzhu."""
    try:
        resp = requests.get(f"{CRM_WEBHOOK_URL}?r=channel-qr-worker", headers=_worker_headers(), timeout=15)
        if resp.status_code != 200:
            print(f"[qr-worker] oshibka oprosa zadach: {resp.status_code} {resp.text[:200]}")
            return [], []
        data = resp.json()
        return data.get("tasks", []), data.get("active", [])
    except Exception as e:
        print(f"[qr-worker] oshibka oprosa zadach: {e}")
        return [], []


def report_qr_status(company_id: int, channel: str, status: str, **extra):
    """Soobschaet CRM o hode podklyucheniya (qr_ready/connected/error/disconnected)."""
    try:
        payload = {"company_id": company_id, "channel": channel, "status": status, **extra}
        resp = requests.post(f"{CRM_WEBHOOK_URL}?r=channel-qr-worker", json=payload, headers=_worker_headers(), timeout=15)
        print(f"[qr-worker] company={company_id} status={status} -> {resp.status_code}")
    except Exception as e:
        print(f"[qr-worker] oshibka otpravki statusa: {e}")


def send_to_crm(webhook_key: str, company_id: int, payload: dict):
    """Otpravlyaet normalizovannoe vhodyashchee soobshchenie v CRM konkretnoi kompanii."""
    try:
        resp = requests.post(
            f"{CRM_WEBHOOK_URL}?r=channel-webhook&company_id={company_id}",
            json=payload,
            headers={"X-Webhook-Key": webhook_key, "Content-Type": "application/json"},
            timeout=15,
        )
        print(f"[crm-in c={company_id}] -> {payload.get('external_id')}: {resp.status_code}")
    except Exception as e:
        print(f"[crm-in c={company_id}] oshibka otpravki: {e}")


async def send_attachments(client: TelegramClient, entity, attachments: list, caption: str):
    """Skachivaet vlozheniya po CDN-URL (oni uzhe zagruzheny na nash S3 cherez
    backend "upload") i otpravlyaet ih v Telegram cherez Telethon send_file.
    Golosovoe soobschenie otpravlyaem s voice_note=True — Telegram pokazyvaet
    ego kak audio-volnu, a ne kak obychnyi audio-fail."""
    for i, att in enumerate(attachments):
        url = att.get("url")
        if not url:
            continue
        kind = att.get("type") or "file"
        filename = att.get("filename") or url.rsplit("/", 1)[-1]
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        buf = io.BytesIO(resp.content)
        buf.name = filename
        is_last = i == len(attachments) - 1
        await client.send_file(
            entity, buf,
            voice_note=(kind == "voice"),
            caption=(caption if caption and is_last else None),
        )


def get_pending_messages(webhook_key: str, company_id: int):
    try:
        resp = requests.get(
            f"{CRM_WEBHOOK_URL}?r=pending-messages&company_id={company_id}&channel=telegram",
            headers={"X-Webhook-Key": webhook_key},
            timeout=15,
        )
        if resp.status_code != 200:
            return []
        return resp.json().get("messages", [])
    except Exception as e:
        print(f"[crm-out c={company_id}] oshibka oprosa: {e}")
        return []


def mark_sent(webhook_key: str, company_id: int, touch_id: int, success: bool,
              channel: str = None, external_chat_id: str = None):
    try:
        payload = {"touch_id": touch_id, "success": success}
        if channel:
            payload["channel"] = channel
        if external_chat_id:
            payload["external_chat_id"] = external_chat_id
        requests.post(
            f"{CRM_WEBHOOK_URL}?r=mark-sent&company_id={company_id}",
            json=payload,
            headers={"X-Webhook-Key": webhook_key, "Content-Type": "application/json"},
            timeout=15,
        )
    except Exception as e:
        print(f"[crm-out c={company_id}] oshibka mark-sent: {e}")


async def find_by_phone(client: TelegramClient, phone: str):
    """Ischet polzovatelya Telegram po nomeru telefona — tot zhe mehanizm, chto
    "dobavit' kontakt po nomeru" v obychnom prilozhenii. Rabotaet TOL'KO esli
    u nomera est' Telegram-akkaunt, telefon otkryt dlya poiska po nomeru (ne
    skryt v nastroikah privatnosti) i akkaunt voobsche sushchestvuet.
    Vozvraschaet (entity, chat_id_str) ili (None, None), esli ne naiden.
    Dobavlennyi kontakt srazu zhe udalyaetsya — my ne hotim zasorat' spisok
    kontaktov akkaunta kompanii chuzhimi nomerami navsegda."""
    if not phone:
        return None, None
    digits = "".join(c for c in phone if c.isdigit())
    if not digits:
        return None, None
    try:
        result = await client(ImportContactsRequest([
            InputPhoneContact(client_id=0, phone=f"+{digits}", first_name="Client", last_name="")
        ]))
        if not result.users:
            return None, None
        user = result.users[0]
        # Srazu ubiraem iz kontaktov — nam nuzhen byl tol'ko poisk, ne khranenie.
        try:
            await client(DeleteContactsRequest(id=[user.id]))
        except Exception:
            pass
        return user, str(user.id)
    except Exception as e:
        print(f"[find-by-phone] oshibka poiska {phone}: {e}")
        return None, None


async def run_company_session(company_id: int, webhook_key: str, client: TelegramClient):
    """Fonovye zadachi dlya odnoi UZHE avtorizovannoi kompanii: slushanie
    vhodyaschih + tsikl otpravki ozhidayuschih soobschenii."""

    @client.on(events.NewMessage(incoming=True))
    async def on_new_message(event):
        sender = await event.get_sender()
        phone = getattr(sender, "phone", None)
        name = " ".join(filter(None, [getattr(sender, "first_name", None), getattr(sender, "last_name", None)])) or None
        payload = {
            "channel": "telegram",
            "direction": "in",
            "text": event.raw_text or "",
            "external_id": f"tg_{event.chat_id}_{event.id}",
            "external_chat_id": str(event.chat_id),
        }
        # Lichka ili gruppa/kanal — Telethon znaet eto tochno (ne nado gadat' po
        # znaku chat_id). Dlya gruppy/kanala dopolnitel'no shlyom nazvanie chata
        # (ne imya otpravitelya — chtoby v CRM byla ODNA kartochka gruppy, a ne
        # otdel'naya "kartochka klienta" na kazhdogo, kto v nej napisal) i imya
        # KONKRETNOGO avtora soobscheniya (sender_name) — nuzhno v lente gruppy,
        # chtoby videt' kto imenno napisal.
        if event.is_private:
            payload["chat_type"] = "private"
        else:
            payload["chat_type"] = "channel" if event.is_channel and not event.is_group else "group"
            chat = await event.get_chat()
            chat_title = getattr(chat, "title", None)
            if chat_title:
                payload["group_title"] = chat_title
            if name:
                payload["sender_name"] = name
        if phone:
            payload["phone"] = phone
        if name:
            payload["name"] = name
        preview = (event.raw_text or "(bez teksta)")[:80]
        chat_label = payload.get("group_title") or name or phone or event.chat_id
        print(f"[tg-in c={company_id}] ({payload['chat_type']}) {chat_label}: {preview}")
        send_to_crm(webhook_key, company_id, payload)

    async def poll_and_send_loop():
        while company_id in active_clients:
            try:
                messages = get_pending_messages(webhook_key, company_id)
                for msg in messages:
                    touch_id = msg["touch_id"]
                    text = msg["text"]
                    attachments = msg.get("attachments") or []
                    external_chat_id = msg.get("external_chat_id")
                    phone = msg.get("phone")
                    try:
                        if external_chat_id:
                            entity = int(external_chat_id)
                            found_chat_id = None
                        else:
                            # Pervoe soobschenie klientu — perepiski eschyo ne bylo.
                            # Ischem ego v Telegram po nomeru telefona (kak obychnoe
                            # "dobavit' kontakt po nomeru"), potom pishem pervymi.
                            entity, found_chat_id = await find_by_phone(client, phone)
                            if entity is None:
                                print(f"[tg-out c={company_id}] telefon {phone} ne naiden v Telegram, touch_id={touch_id}")
                                mark_sent(webhook_key, company_id, touch_id, False)
                                continue
                        if attachments:
                            await send_attachments(client, entity, attachments, text)
                        else:
                            await client.send_message(entity, text)
                        print(f"[tg-out c={company_id}] otpravleno touch_id={touch_id} -> {external_chat_id or phone}")
                        mark_sent(webhook_key, company_id, touch_id, True,
                                  channel="telegram", external_chat_id=found_chat_id if not external_chat_id else None)
                    except Exception as e:
                        print(f"[tg-out c={company_id}] oshibka otpravki touch_id={touch_id}: {e}")
                        mark_sent(webhook_key, company_id, touch_id, False)
            except Exception as e:
                print(f"[poll c={company_id}] neozhidannaya oshibka: {e}")
            await _sleep_or_wake(_wake_send, SEND_POLL_SEC)

    task = asyncio.create_task(poll_and_send_loop())
    active_tasks[company_id] = [task]


async def start_existing_session(company_id: int, channel: str, webhook_key: str):
    """Podnimaet uzhe avtorizovannuyu (ranshe podklyuchyonnuyu) sessiyu posle
    perezapuska servera - QR NE nuzhen, sessiya uzhe est' na diske."""
    if company_id in active_clients:
        return
    session_path = os.path.join(SESSIONS_DIR, f"{company_id}")
    client = TelegramClient(session_path, API_ID, API_HASH, proxy=TELETHON_PROXY)
    await client.connect()
    if not await client.is_user_authorized():
        print(f"[qr-worker] company={company_id} sessiya ne avtorizovana, propuskaem (nuzhno peropodklyuchenie cherez QR)")
        await client.disconnect()
        return
    active_clients[company_id] = client
    await run_company_session(company_id, webhook_key, client)
    print(f"[qr-worker] company={company_id} sessiya podnyata iz faila")


async def wait_for_password(company_id: int, channel: str, timeout_sec: int = 240):
    """Zhdyot, poka sotrudnik vvedyot oblachnyi parol' (2FA) v okne QR v CRM.
    Oprashivaet CRM kazhdye 2 sek. Vozvraschaet None, esli vremya vyshlo."""
    elapsed = 0
    while elapsed < timeout_sec:
        password = fetch_password(company_id, channel)
        if password:
            return password
        await asyncio.sleep(2)
        elapsed += 2
    return None


async def handle_connect_task(company_id: int, channel: str):
    """Obrabatyvaet zayavku na podklyuchenie: generiruet QR, zhdyot skanirovaniya,
    pri neobhodimosti zaprashivaet oblachnyi parol' (2FA) cherez CRM,
    posle uspeha - zapuskaet fonovye zadachi dlya etoi kompanii."""
    if channel != "telegram":
        report_qr_status(company_id, channel, "error", error="Этот канал пока не поддерживается")
        return

    session_path = os.path.join(SESSIONS_DIR, f"{company_id}")
    client = TelegramClient(session_path, API_ID, API_HASH, proxy=TELETHON_PROXY)
    await client.connect()

    async def ask_password_and_signin() -> bool:
        """Zaprashivaet u sotrudnika oblachnyi parol' cherez CRM i pytaetsya voiti.
        Vozvraschaet True pri uspehe, False — esli vremya vyshlo ili parol' neveren
        (v oboih sluchayah status v CRM uzhe vystavlen na 'error')."""
        report_qr_status(company_id, channel, "password_needed")
        password = await wait_for_password(company_id, channel)
        if not password:
            report_qr_status(company_id, channel, "error", error="Пароль не был введён вовремя")
            return False
        try:
            await client.sign_in(password=password)
            return True
        except PasswordHashInvalidError:
            report_qr_status(company_id, channel, "error", error="Неверный пароль")
            return False

    try:
        # SessionPasswordNeededError mozhet priletet' uzhe na etom shage (esli na
        # akkaunte vklyuchyon 2FA i sessiya "pomnit" chastichnyi vhod s proshloi
        # popytki) — obrabatyvaem eyo zdes' zhe, a ne tol'ko v tsikle ozhidaniya niže.
        try:
            qr_login = await client.qr_login()
        except SessionPasswordNeededError:
            if not await ask_password_and_signin():
                await client.disconnect()
                return
            qr_login = None

        authorized = qr_login is None  # uzhe voshli vyshe cherez parol'
        if qr_login is not None:
            report_qr_status(company_id, channel, "qr_ready", qr_url=qr_login.url)

            # QR u Telegram zhivyot ~30 sek - peregeneriruem do 4 raz (~2 minuty vsego),
            # poka pol'zovatel' ne otskaniruet ili poka ne isteklo obschee vremya ozhidaniya.
            # VAZHNO: SessionPasswordNeededError mozhet priletet' kak iz wait(), tak i iz
            # recreate() — lovim obe situatsii, ne davaya oshibke uiti v obschii except.
            need_password = False
            for _ in range(4):
                try:
                    await qr_login.wait(timeout=30)
                    authorized = True
                    break
                except asyncio.TimeoutError:
                    try:
                        await qr_login.recreate()
                        report_qr_status(company_id, channel, "qr_ready", qr_url=qr_login.url)
                    except SessionPasswordNeededError:
                        need_password = True
                        break
                except SessionPasswordNeededError:
                    need_password = True
                    break

            if need_password:
                if not await ask_password_and_signin():
                    await client.disconnect()
                    return
                authorized = True

        if not authorized:
            report_qr_status(company_id, channel, "error", error="QR-код не был отсканирован вовремя")
            await client.disconnect()
            return

        me = await client.get_me()
        account_name = " ".join(filter(None, [me.first_name, me.last_name])) or (f"+{me.phone}" if me.phone else "Telegram")
    except Exception as e:
        print(f"[qr-worker] company={company_id} oshibka podklyucheniya: {e}")
        report_qr_status(company_id, channel, "error", error=str(e)[:200])
        try:
            await client.disconnect()
        except Exception:
            pass
        return

    # Uspeshnyi vhod — soobschaem CRM (ona sama vydast webhook_key etoi kompanii
    # v sleduyuschem oprose "active"), zapuskaem fonovye zadachi.
    report_qr_status(company_id, channel, "connected", account_name=account_name)
    active_clients[company_id] = client
    # webhook_key eschyo neizvesten na etom shage — podхватим ego na sleduyuschem
    # tike glavnogo tsikla iz spiska "active" (CRM otdast ego сразу posle connected).


async def handle_disconnect_task(company_id: int, channel: str):
    client = active_clients.pop(company_id, None)
    for t in active_tasks.pop(company_id, []):
        t.cancel()
    if client:
        try:
            await client.log_out()
        except Exception as e:
            print(f"[qr-worker] company={company_id} oshibka log_out: {e}")
        try:
            await client.disconnect()
        except Exception:
            pass
    session_file = os.path.join(SESSIONS_DIR, f"{company_id}.session")
    if os.path.exists(session_file):
        try:
            os.remove(session_file)
        except Exception:
            pass
    report_qr_status(company_id, channel, "disconnected")


async def main_loop():
    """Glavnyi tsikl: oprashivaet CRM na predmet novyh zadach i podderzhivaet
    aktivnye sessii vseh podklyuchennyh kompanii."""
    while True:
        tasks, active = fetch_worker_tasks()

        for t in tasks:
            company_id, channel, action = t["company_id"], t["channel"], t["action"]
            if action == "connect":
                asyncio.create_task(handle_connect_task(company_id, channel))
            elif action == "disconnect":
                asyncio.create_task(handle_disconnect_task(company_id, channel))

        for a in active:
            company_id, channel, webhook_key = a["company_id"], a["channel"], a["webhook_key"]
            if channel != "telegram":
                continue
            if company_id in active_clients and company_id not in active_tasks:
                # Klient uzhe podnyat (tol'ko chto podklyuchilsya cherez QR),
                # no fonovye zadachi eschyo ne zapuscheny — zapuskaem seichas,
                # kogda uzhe znaem webhook_key.
                await run_company_session(company_id, webhook_key, active_clients[company_id])
            elif company_id not in active_clients:
                # Perezapusk servera — podnimaem sessiyu iz faila bez QR.
                asyncio.create_task(start_existing_session(company_id, channel, webhook_key))

        await _sleep_or_wake(_wake_tasks, NEW_TASK_POLL_SEC)


async def main():
    start_push_server()
    print("[qr-worker] zapushchen, ozhidayu zayavki na podklyuchenie ot CRM...")
    await main_loop()


if __name__ == "__main__":
    asyncio.run(main())
WORKER_EOF
