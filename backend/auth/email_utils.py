import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_verification_code(to_email: str, code: str, name: str = "", purpose: str = "registration") -> bool:
    """Отправляет код подтверждения email через Gmail SMTP.
    purpose: "registration" — код подтверждения регистрации, "password" — код для смены пароля.
    Возвращает True при успехе, False если SMTP не настроен или произошла ошибка."""
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        return False

    greeting = f"Здравствуйте, {name}!" if name else "Здравствуйте!"
    if purpose == "password":
        subject = "Код для смены пароля"
        purpose_text = "Ваш код для смены пароля"
        footer_text = "Код действителен 15 минут. Если вы не запрашивали смену пароля — просто проигнорируйте это письмо."
    else:
        subject = "Код подтверждения регистрации"
        purpose_text = "Ваш код подтверждения"
        footer_text = "Код действителен 15 минут. Если вы не регистрировались — просто проигнорируйте это письмо."
    text = f"{greeting}\n\n{purpose_text}: {code}\n\n{footer_text}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#f97316;">{greeting}</h2>
      <p>{purpose_text}:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:6px;background:#f3f4f6;padding:16px 24px;border-radius:12px;text-align:center;margin:16px 0;">{code}</div>
      <p style="color:#666;font-size:13px;">{footer_text}</p>
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


def send_team_password_email(to_email: str, name: str, password: str, login_url: str = "") -> bool:
    """Отправляет сотруднику логин и временный пароль после создания аккаунта
    (или сброса пароля). Возвращает True при успехе, False если SMTP не настроен
    или письмо не ушло — в этом случае пароль всё равно остаётся доступен
    в интерфейсе CRM, отправка на почту тут лишь дополнительный канал."""
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        return False

    greeting = f"Здравствуйте, {name}!" if name else "Здравствуйте!"
    subject = "Доступ к CRM"
    login_line = f'<p><a href="{login_url}">Войти в CRM</a></p>' if login_url else ""
    login_line_text = f"\nВход: {login_url}" if login_url else ""
    text = (f"{greeting}\n\nВам выдан доступ к CRM.\n\n"
            f"Логин: {to_email}\nПароль: {password}\n"
            f"{login_line_text}\n\n"
            f"Пароль временный — при первом входе рекомендуем сменить его в настройках профиля.")
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#7c3aed;">{greeting}</h2>
      <p>Вам выдан доступ к CRM.</p>
      <table style="font-size:14px;margin:16px 0;">
        <tr><td style="color:#666;padding:4px 12px 4px 0;">Логин:</td><td style="font-weight:bold;">{to_email}</td></tr>
        <tr><td style="color:#666;padding:4px 12px 4px 0;">Пароль:</td><td style="font-weight:bold;font-family:monospace;">{password}</td></tr>
      </table>
      {login_line}
      <p style="color:#666;font-size:13px;">Пароль временный — при первом входе рекомендуем сменить его в настройках профиля.</p>
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