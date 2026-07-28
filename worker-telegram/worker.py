"""
Telegram-vorker dlya CRM "Kasaniya".

Delaet dve veshchi parallelno:
1. Slushaet lichnyi Telegram-akkaunt (Telethon) i peresylaet vhodyashchie
   soobshcheniya v CRM (crm-manager, resource=channel-webhook).
2. Kazhdye neskolko sekund oprashivaet CRM (resource=pending-messages) -
   net li soobshchenii "na otpravku", i otpravlyaet ih cherez Telegram,
   posle chego podtverzhdaet otpravku (resource=mark-sent).

Nastroika - cherez peremennye okruzheniya (fail .env ryadom):
  TG_API_ID        - iz https://my.telegram.org
  TG_API_HASH      - iz https://my.telegram.org
  CRM_WEBHOOK_URL  - adres funktsii crm-manager
  CRM_COMPANY_ID   - id kompanii v CRM
  CRM_WEBHOOK_KEY  - sekretnyi klyuch (iz vkladki "Integratsii")

Pervyi zapusk sprosit nomer telefona i kod iz Telegram - eto obychnyi
vhod v akkaunt, kak v Telegram Desktop. Sessiya sohranyaetsya v fail
session.session - povtorno kod vvodit ne nuzhno.
"""

import os
import asyncio
import requests
from telethon import TelegramClient, events
from dotenv import load_dotenv

load_dotenv()

API_ID = int(os.environ["TG_API_ID"])
API_HASH = os.environ["TG_API_HASH"]
CRM_WEBHOOK_URL = os.environ["CRM_WEBHOOK_URL"]
CRM_COMPANY_ID = os.environ["CRM_COMPANY_ID"]
CRM_WEBHOOK_KEY = os.environ["CRM_WEBHOOK_KEY"]
POLL_INTERVAL_SEC = int(os.environ.get("POLL_INTERVAL_SEC", "3"))

client = TelegramClient("session", API_ID, API_HASH)


def send_to_crm(payload: dict):
    """Otpravlyaet normalizovannoe vhodyashchee soobshchenie v CRM. Ne brosaet
    isklyucheniya naruzhu - vorker dolzhen prodolzhat rabotat, dazhe esli
    CRM vremenno nedostupna."""
    try:
        resp = requests.post(
            f"{CRM_WEBHOOK_URL}?r=channel-webhook&company_id={CRM_COMPANY_ID}",
            json=payload,
            headers={"X-Webhook-Key": CRM_WEBHOOK_KEY, "Content-Type": "application/json"},
            timeout=15,
        )
        print(f"[crm-in] -> {payload.get('external_id')}: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        print(f"[crm-in] oshibka otpravki: {e}")


def get_pending_messages():
    """Sprashivaet u CRM - est li soobshcheniya na otpravku dlya Telegram."""
    try:
        resp = requests.get(
            f"{CRM_WEBHOOK_URL}?r=pending-messages&company_id={CRM_COMPANY_ID}&channel=telegram",
            headers={"X-Webhook-Key": CRM_WEBHOOK_KEY},
            timeout=15,
        )
        if resp.status_code != 200:
            print(f"[crm-out] oshibka oprosa: {resp.status_code} {resp.text[:200]}")
            return []
        return resp.json().get("messages", [])
    except Exception as e:
        print(f"[crm-out] oshibka oprosa: {e}")
        return []


def mark_sent(touch_id: int, success: bool):
    try:
        requests.post(
            f"{CRM_WEBHOOK_URL}?r=mark-sent&company_id={CRM_COMPANY_ID}",
            json={"touch_id": touch_id, "success": success},
            headers={"X-Webhook-Key": CRM_WEBHOOK_KEY, "Content-Type": "application/json"},
            timeout=15,
        )
    except Exception as e:
        print(f"[crm-out] oshibka mark-sent: {e}")


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
    print(f"[tg-in] vhodyashchee ot {name or phone or event.chat_id}: {preview}")
    send_to_crm(payload)


async def poll_and_send_loop():
    """Fonovyi tsikl: kazhdye POLL_INTERVAL_SEC sekund sprashivaet CRM
    i otpravlyaet vse ozhidayushchie soobshcheniya cherez Telegram."""
    while True:
        try:
            messages = get_pending_messages()
            for msg in messages:
                touch_id = msg["touch_id"]
                chat_id = int(msg["external_chat_id"])
                text = msg["text"]
                try:
                    await client.send_message(chat_id, text)
                    print(f"[tg-out] otpravleno touch_id={touch_id} -> {chat_id}: {text[:60]}")
                    mark_sent(touch_id, True)
                except Exception as e:
                    print(f"[tg-out] oshibka otpravki touch_id={touch_id}: {e}")
                    mark_sent(touch_id, False)
        except Exception as e:
            print(f"[poll] neozhidannaya oshibka: {e}")
        await asyncio.sleep(POLL_INTERVAL_SEC)


async def main():
    await client.start()
    me = await client.get_me()
    print(f"[tg] vorker zapushchen, akkaunt: {me.first_name} (+{me.phone})")
    asyncio.create_task(poll_and_send_loop())
    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
