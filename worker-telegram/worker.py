"""
Telegram-worker dlya CRM "Kasaniya" — MULTI-COMPANY versiya.

V otlichie ot pervoi versii (odna sessiya na server, vhod vruchnuyu po nomeru+kodu),
etot worker odnovremenno obsluzhivaet MNOGO kompanii — u kazhdoi svoi lichnyi
Telegram-akkaunt. Podklyuchenie proishodit PO QR-KODU pryamo v CRM (vkladka
"Integratsii" -> "Lichnyi Telegram" -> "Podklyuchit po QR-kodu"), bez dostupa
k etomu serveru.

Kak eto rabotaet:
1. Kazhdye NEW_TASK_POLL_SEC sekund worker sprashivaet u CRM (channel-qr-worker,
   GET) - est li novye zayavki na podklyuchenie/otklyuchenie i spisok UZHE
   podklyuchennyh kompanii (nuzhno posle perezapuska servera - sessii lezhat
   lokalno v papke sessions/, a spisok "kto podklyuchen" - v BD CRM).
2. Dlya novoi zayavki na podklyuchenie ("connect"):
   - sozdayotsya TelegramClient s otdel'nym failom sessii sessions/{company_id}.session
   - zapraschivaetsya QR-kod (client.qr_login()), ssylka otpravlyaetsya v CRM
     (status=qr_ready) - CRM pokazyvaet eyo sotrudniku kak kartinku
   - worker zhdyot skanirovaniya (QR u Telegram zhivyot ~30 sek, poetomu
     periodicheski peregenerируем ssylku, poka polzovatel' ne otskaniruet)
   - posle uspeshnogo vhoda - soobschaet CRM status=connected + imya/nomer
3. Dlya kazhdoi PODKLYUCHENNOI kompanii worker parallel'no:
   - slushaet vhodyaschie soobscheniya (peresylaet v CRM, channel-webhook)
   - oprashivaet CRM na predmet soobschenii "na otpravku" (pending-messages)
     i otpravlyaet ih cherez etot akkaunt Telegram
4. Otklyuchenie ("disconnect") - vyhod iz akkaunta (client.log_out()), failed
   sessii udalyaetsya, CRM soobschaetsya status=disconnected.

Nastroika - cherez peremennye okruzheniya (fail .env ryadom):
  TG_API_ID          - iz https://my.telegram.org (odin na vseh - eto ID
                        NASHEGO prilozheniya, ne akkaunta pol'zovatelya)
  TG_API_HASH        - iz https://my.telegram.org
  CRM_WEBHOOK_URL    - adres funktsii crm-manager
  CRM_WORKER_TOKEN   - sekretnyi token voркера (tot zhe, chto TG_PROXY_TOKEN
                        v sekretah proekta) - zaschischaet channel-qr-worker
"""

import os
import asyncio
import requests
from telethon import TelegramClient, events
from telethon.errors import SessionPasswordNeededError
from dotenv import load_dotenv

load_dotenv()

API_ID = int(os.environ["TG_API_ID"])
API_HASH = os.environ["TG_API_HASH"]
CRM_WEBHOOK_URL = os.environ["CRM_WEBHOOK_URL"]
CRM_WORKER_TOKEN = os.environ["CRM_WORKER_TOKEN"]

NEW_TASK_POLL_SEC = int(os.environ.get("NEW_TASK_POLL_SEC", "3"))
SEND_POLL_SEC = int(os.environ.get("SEND_POLL_SEC", "3"))
SESSIONS_DIR = os.environ.get("SESSIONS_DIR", "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

# company_id -> asyncio.Task (fonovyi tsikl slushaniya + otpravki dlya etoi kompanii)
active_clients: dict[int, TelegramClient] = {}
active_tasks: dict[int, list[asyncio.Task]] = {}


def _worker_headers():
    return {"X-Worker-Token": CRM_WORKER_TOKEN, "Content-Type": "application/json"}


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


def mark_sent(webhook_key: str, company_id: int, touch_id: int, success: bool):
    try:
        requests.post(
            f"{CRM_WEBHOOK_URL}?r=mark-sent&company_id={company_id}",
            json={"touch_id": touch_id, "success": success},
            headers={"X-Webhook-Key": webhook_key, "Content-Type": "application/json"},
            timeout=15,
        )
    except Exception as e:
        print(f"[crm-out c={company_id}] oshibka mark-sent: {e}")


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
        if phone:
            payload["phone"] = phone
        if name:
            payload["name"] = name
        preview = (event.raw_text or "(bez teksta)")[:80]
        print(f"[tg-in c={company_id}] ot {name or phone or event.chat_id}: {preview}")
        send_to_crm(webhook_key, company_id, payload)

    async def poll_and_send_loop():
        while company_id in active_clients:
            try:
                messages = get_pending_messages(webhook_key, company_id)
                for msg in messages:
                    touch_id = msg["touch_id"]
                    chat_id = int(msg["external_chat_id"])
                    text = msg["text"]
                    try:
                        await client.send_message(chat_id, text)
                        print(f"[tg-out c={company_id}] otpravleno touch_id={touch_id} -> {chat_id}")
                        mark_sent(webhook_key, company_id, touch_id, True)
                    except Exception as e:
                        print(f"[tg-out c={company_id}] oshibka otpravki touch_id={touch_id}: {e}")
                        mark_sent(webhook_key, company_id, touch_id, False)
            except Exception as e:
                print(f"[poll c={company_id}] neozhidannaya oshibka: {e}")
            await asyncio.sleep(SEND_POLL_SEC)

    task = asyncio.create_task(poll_and_send_loop())
    active_tasks[company_id] = [task]


async def start_existing_session(company_id: int, channel: str, webhook_key: str):
    """Podnimaet uzhe avtorizovannuyu (ranshe podklyuchyonnuyu) sessiyu posle
    perezapuska servera - QR NE nuzhen, sessiya uzhe est' na diske."""
    if company_id in active_clients:
        return
    session_path = os.path.join(SESSIONS_DIR, f"{company_id}")
    client = TelegramClient(session_path, API_ID, API_HASH)
    await client.connect()
    if not await client.is_user_authorized():
        print(f"[qr-worker] company={company_id} sessiya ne avtorizovana, propuskaem (nuzhno peropodklyuchenie cherez QR)")
        await client.disconnect()
        return
    active_clients[company_id] = client
    await run_company_session(company_id, webhook_key, client)
    print(f"[qr-worker] company={company_id} sessiya podnyata iz faila")


async def handle_connect_task(company_id: int, channel: str):
    """Obrabatyvaet zayavku na podklyuchenie: generiruet QR, zhdyot skanirovaniya,
    posle uspeha - zapuskaet fonovye zadachi dlya etoi kompanii."""
    if channel != "telegram":
        report_qr_status(company_id, channel, "error", error="Kanal poka ne podderzhivaetsya")
        return

    session_path = os.path.join(SESSIONS_DIR, f"{company_id}")
    client = TelegramClient(session_path, API_ID, API_HASH)
    await client.connect()

    try:
        qr_login = await client.qr_login()
        report_qr_status(company_id, channel, "qr_ready", qr_url=qr_login.url)

        # QR u Telegram zhivyot ~30 sek - peregeneriruem do 4 raz (~2 minuty vsego),
        # poka pol'zovatel' ne otskaniruet ili poka ne isteklo obschee vremya ozhidaniya.
        authorized = False
        for _ in range(4):
            try:
                await qr_login.wait(timeout=30)
                authorized = True
                break
            except asyncio.TimeoutError:
                await qr_login.recreate()
                report_qr_status(company_id, channel, "qr_ready", qr_url=qr_login.url)
            except SessionPasswordNeededError:
                report_qr_status(company_id, channel, "error",
                                  error="Na akkaunte vklyuchyon parol' (2FA) - poka ne podderzhivaetsya, otklyuchite ego vremenno v Telegram i poprobuite snova")
                await client.disconnect()
                return

        if not authorized:
            report_qr_status(company_id, channel, "error", error="QR-kod ne byl otskanirovan vovremya")
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

        await asyncio.sleep(NEW_TASK_POLL_SEC)


async def main():
    print("[qr-worker] zapushchen, ozhidayu zayavki na podklyuchenie ot CRM...")
    await main_loop()


if __name__ == "__main__":
    asyncio.run(main())