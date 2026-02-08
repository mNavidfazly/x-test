import aiosmtplib
from email.message import EmailMessage

from app.config import Settings


async def send_email(
    settings: Settings,
    to: str,
    subject: str,
    html_body: str,
) -> None:
    message = EmailMessage()
    message["From"] = settings.from_email
    message["To"] = to
    message["Subject"] = subject
    message.set_content(html_body, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username,
        password=settings.smtp_password,
        start_tls=True,
    )


async def check_smtp_connection(settings: Settings) -> bool:
    try:
        smtp = aiosmtplib.SMTP(
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            start_tls=True,
        )
        await smtp.connect()
        await smtp.login(settings.smtp_username, settings.smtp_password)
        await smtp.quit()
        return True
    except Exception:
        return False
