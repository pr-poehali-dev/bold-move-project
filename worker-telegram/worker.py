"""
Telegram-vorker dlya CRM "Kasaniya".
Slushaet lichnyi Telegram-akkaunt (cherez Telethon) i peresylaet vhodyashchie
soobshcheniya v nashu CRM (crm-manager, resource=channel-webhook).

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

client = TelegramClient("session", API_ID, API_HASH)


def send_to_crm(payload: dict):
    """Otpravlyaet normalizovannoe soobshchenie v CRM. Ne brosaet isklyucheniya
    naruzhu - vorker dolzhen prodolzhat rabotat, dazhe esli CRM nedostupna."""
    try:
        resp = requests.post(
            f"{CRM_WEBHOOK_URL}?r=channel-webhook&company_id={CRM_COMPANY_ID}",
            json=payload,
            headers={"X-Webhook-Key": CRM_WEBHOOK_KEY, "Content-Type": "application/json"},
            timeout=15,
        )
        print(f"[crm] -> {payload.get('external_id')}: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        print(f"[crm] oshibka otpravki: {e}")


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
    print(f"[tg] vhodyashchee ot {name or phone or event.chat_id}: {preview}")
    send_to_crm(payload)


async def main():
    await client.start()
    me = await client.get_me()
    print(f"[tg] vorker zapushchen, akkaunt: {me.first_name} (+{me.phone})")
    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
