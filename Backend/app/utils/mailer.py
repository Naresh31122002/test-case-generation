"""
utils/mailer.py

Transactional email via SMTP, configured entirely through environment variables.

Required env to actually send:
    SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD
    SMTP_FROM        (default: SMTP_USER)
    SMTP_USE_TLS     ("1" default — STARTTLS) | SMTP_USE_SSL ("1" for implicit SSL)
    APP_URL          (frontend base url used to build links, e.g. http://localhost:3000)

If SMTP is not configured, send_email() logs the message (including any link) and
returns False instead of raising — so local dev and the signup flow keep working
without a mail server. Never block the request on email delivery.
"""

import os
import ssl
import smtplib
import logging
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))


def app_url() -> str:
    """Frontend base URL used to build verification / reset links."""
    return (os.getenv("APP_URL") or "http://localhost:3000").rstrip("/")


def send_email(to_email: str, subject: str, text_body: str, html_body: str = None) -> bool:
    """Send an email. Returns True if handed to the SMTP server, else False.

    On any failure (or when SMTP is unconfigured) the message is logged and False
    is returned — callers should treat email as best-effort.
    """
    if not smtp_configured():
        logger.warning(
            "SMTP not configured — email not sent.\n  To: %s\n  Subject: %s\n  Body:\n%s",
            to_email, subject, text_body,
        )
        return False

    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    from_addr = os.getenv("SMTP_FROM", user)
    use_ssl = os.getenv("SMTP_USE_SSL", "0") == "1"
    use_tls = os.getenv("SMTP_USE_TLS", "1") == "1"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(text_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    try:
        if use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                if use_tls:
                    server.starttls(context=ssl.create_default_context())
                server.login(user, password)
                server.send_message(msg)
        logger.info("Sent '%s' email to %s", subject, to_email)
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False


# ── Templated emails ──────────────────────────────────────────────────────────

def verification_link(token: str) -> str:
    return f"{app_url()}/verify-email?token={token}"


def password_reset_link(token: str) -> str:
    return f"{app_url()}/reset-password?token={token}"


def send_verification_email(to_email: str, token: str) -> bool:
    link = verification_link(token)
    subject = "Verify your TestSurge email"
    text = (
        f"Welcome to TestSurge!\n\n"
        f"Confirm your email address by opening this link:\n{link}\n\n"
        f"This link expires in 24 hours. If you didn't sign up, you can ignore this email."
    )
    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#FF0A78">Welcome to TestSurge</h2>
      <p>Confirm your email address to finish setting up your account.</p>
      <p><a href="{link}" style="display:inline-block;background:#FF0A78;color:#fff;
        padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">
        Verify email</a></p>
      <p style="color:#64748B;font-size:13px">This link expires in 24 hours.
      If you didn't sign up, ignore this email.</p>
    </div>"""
    return send_email(to_email, subject, text, html)


def send_password_reset_email(to_email: str, token: str) -> bool:
    link = password_reset_link(token)
    subject = "Reset your TestSurge password"
    text = (
        f"We received a request to reset your TestSurge password.\n\n"
        f"Reset it here:\n{link}\n\n"
        f"This link expires in 1 hour. If you didn't request this, ignore this email."
    )
    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#FF0A78">Reset your password</h2>
      <p>Click below to choose a new password.</p>
      <p><a href="{link}" style="display:inline-block;background:#FF0A78;color:#fff;
        padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">
        Reset password</a></p>
      <p style="color:#64748B;font-size:13px">This link expires in 1 hour.
      If you didn't request this, ignore this email.</p>
    </div>"""
    return send_email(to_email, subject, text, html)
