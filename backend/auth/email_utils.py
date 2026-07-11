import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_verification_code(to_email: str, code: str, name: str = "") -> bool:
    """Отправляет код подтверждения email через Gmail SMTP.
    Возвращает True при успехе, False если SMTP не настроен или произошла ошибка."""
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        return False

    greeting = f"Здравствуйте, {name}!" if name else "Здравствуйте!"
    subject = "Код подтверждения регистрации"
    text = f"{greeting}\n\nВаш код подтверждения: {code}\n\nКод действителен 15 минут. Если вы не регистрировались — просто проигнорируйте это письмо."
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#f97316;">{greeting}</h2>
      <p>Ваш код подтверждения регистрации:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:6px;background:#f3f4f6;padding:16px 24px;border-radius:12px;text-align:center;margin:16px 0;">{code}</div>
      <p style="color:#666;font-size:13px;">Код действителен 15 минут. Если вы не регистрировались — просто проигнорируйте это письмо.</p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, [to_email], msg.as_string())
        return True
    except Exception:
        return False
