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
    # PUBLIC_APP_URL includes the basePath (/app) — use it if set
    return (os.getenv("PUBLIC_APP_URL") or os.getenv("APP_URL") or "http://localhost:3000").rstrip("/")


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

LOGO_HTML = """
<div style="text-align:center;padding:24px 0 16px;background:#0F172A;border-radius:12px 12px 0 0;margin:-32px -32px 24px;">
  <div style="display:inline-flex;align-items:center;gap:10px;">
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" stroke="#FF0A78" stroke-width="2"/>
      <circle cx="16" cy="16" r="10" stroke="#FF0A78" stroke-width="1.5" stroke-dasharray="3 2"/>
      <circle cx="16" cy="16" r="5" fill="#FF0A78"/>
    </svg>
    <span style="font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;">Test<span style="color:#FF0A78;">Surge</span></span>
  </div>
</div>
"""


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
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;border:1px solid #e2e8f0;">
      {LOGO_HTML}
      <h2 style="color:#0F172A;font-size:20px;margin-bottom:8px;">Verify your email address</h2>
      <p style="color:#64748B;font-size:14px;line-height:1.7;">Confirm your email address to finish setting up your TestSurge account.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="{link}" style="display:inline-block;background:#FF0A78;color:#fff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;">Verify Email →</a>
      </div>
      <p style="color:#94A3B8;font-size:12px;text-align:center;">This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.</p>
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
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;border:1px solid #e2e8f0;">
      {LOGO_HTML}
      <h2 style="color:#0F172A;font-size:20px;margin-bottom:8px;">Reset your password</h2>
      <p style="color:#64748B;font-size:14px;line-height:1.7;">Click below to choose a new password for your TestSurge account.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="{link}" style="display:inline-block;background:#FF0A78;color:#fff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;">Reset Password →</a>
      </div>
      <p style="color:#94A3B8;font-size:12px;text-align:center;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>"""
    return send_email(to_email, subject, text, html)


def send_workspace_invite_email(to_email: str, inviter_name: str, workspace_name: str, role: str, invite_link: str):
    """Send workspace invitation email via SMTP."""
    role_label = {'owner': 'Owner', 'admin': 'Admin', 'editor': 'Editor', 'viewer': 'Viewer'}.get(role, role.title())
    subject = f"{inviter_name} invited you to {workspace_name} on TestSurge"
    text = (
        f"{inviter_name} has invited you to join {workspace_name} on TestSurge as a {role_label}.\n\n"
        f"Accept your invitation here:\n{invite_link}\n\n"
        f"This invitation expires in 7 days. If you didn't expect this, ignore this email."
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;border:1px solid #e2e8f0">
      {LOGO_HTML}
      <h2 style="color:#0F172A;font-size:20px;margin-bottom:8px">You've been invited to join {workspace_name}</h2>
      <p style="color:#64748B;font-size:14px;line-height:1.6">
        <strong style="color:#0F172A">{inviter_name}</strong> has invited you to join
        <strong style="color:#0F172A">{workspace_name}</strong> on TestSurge as a <strong>{role_label}</strong>.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="{invite_link}" style="display:inline-block;background:#FF0A78;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">
          Accept Invitation
        </a>
      </div>
      <p style="color:#94A3B8;font-size:12px;text-align:center">This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>
      <p style="color:#94A3B8;font-size:11px;text-align:center">Or copy this link: {invite_link}</p>
    </div>
    """
    return send_email(to_email, subject, text, html)


def send_welcome_google_email(to_email: str, display_name: str):
    name = display_name or to_email.split('@')[0]
    subject = f"Welcome to TestSurge, {name}!"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;border:1px solid #e2e8f0;">
      {LOGO_HTML}
      <h2 style="color:#0F172A;font-size:20px;margin-bottom:8px;">Welcome aboard, {name}! 🎉</h2>
      <p style="color:#64748B;font-size:14px;line-height:1.7;">
        You're now part of TestSurge — the AI-powered requirement intelligence platform trusted by QA teams to generate, manage, and track test cases automatically.
      </p>
      <div style="background:#F8FAFC;border-radius:10px;padding:20px;margin:20px 0;border:1px solid #E2E8F0;">
        <p style="color:#0F172A;font-size:13px;font-weight:700;margin-bottom:12px;">🚀 Get started in 3 steps:</p>
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
          <span style="min-width:24px;height:24px;background:#FF0A78;color:#fff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">1</span>
          <div><p style="margin:0;font-size:13px;color:#0F172A;font-weight:600;">Upload a user story</p><p style="margin:0;font-size:12px;color:#64748B;">Paste text or upload PDF, Word, or TXT files</p></div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
          <span style="min-width:24px;height:24px;background:#FF0A78;color:#fff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">2</span>
          <div><p style="margin:0;font-size:13px;color:#0F172A;font-weight:600;">Generate test cases with AI</p><p style="margin:0;font-size:12px;color:#64748B;">Functional, Negative, Boundary, Security & Performance tests in seconds</p></div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <span style="min-width:24px;height:24px;background:#FF0A78;color:#fff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">3</span>
          <div><p style="margin:0;font-size:13px;color:#0F172A;font-weight:600;">Review, approve & export</p><p style="margin:0;font-size:12px;color:#64748B;">Export to TestRail, Jira, Playwright, Cypress, or PyTest</p></div>
        </div>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://testsurge.kynetropo.com/app/stories" style="display:inline-block;background:#FF0A78;color:#fff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;">Open TestSurge →</a>
      </div>
      <p style="color:#94A3B8;font-size:12px;text-align:center;margin-top:20px;">Questions? Reply to this email — we read every message.</p>
    </div>
    """
    text = f"Welcome to TestSurge, {name}! Open the app at https://testsurge.kynetropo.com/app/stories"
    return send_email(to_email, subject, text, html)


def send_workspace_activity_email(to_email: str, display_name: str, event_type: str,
                                   workspace_name: str, detail: str, link: str = None):
    """Generic workspace activity email via SMTP."""
    subject_map = {
        'story_uploaded': f'New story uploaded in {workspace_name}',
        'tests_generated': f'Test cases ready in {workspace_name}',
        'member_joined': f'New member joined {workspace_name}',
        'impact_detected': f'Impact detected in {workspace_name}',
        'kanban_assigned': f'You were assigned a task in {workspace_name}',
    }
    subject = subject_map.get(event_type, f'Activity in {workspace_name}')
    link_line = f"\nView it here: {link}" if link else ""
    text = f"Hi {display_name or 'there'},\n\n{detail}{link_line}\n\nYou're receiving this because you're a member of {workspace_name}."
    link_btn = f'<div style="text-align:center;margin:24px 0"><a href="{link}" style="display:inline-block;background:#06B6D4;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none">View in TestSurge</a></div>' if link else ''
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;border:1px solid #e2e8f0">
      {LOGO_HTML}
      <h2 style="color:#0F172A;font-size:18px">{subject}</h2>
      <p style="color:#64748B;font-size:14px;line-height:1.6">Hi {display_name or 'there'},</p>
      <p style="color:#64748B;font-size:14px;line-height:1.6">{detail}</p>
      {link_btn}
      <p style="color:#94A3B8;font-size:11px;text-align:center">You're receiving this because you're a member of {workspace_name}.</p>
    </div>
    """
    return send_email(to_email, subject, text, html)


def send_kanban_assignment_email(to_email: str, assignee_name: str, assigner_name: str,
                                  story_title: str, workspace_name: str, link: str = None):
    """Send email when user is assigned a story in Kanban via SMTP."""
    subject = f"You've been assigned: {story_title}"
    link_line = f"\nView it here: {link}" if link else ""
    text = f"Hi {assignee_name},\n\n{assigner_name} assigned you to '{story_title}' in {workspace_name}.{link_line}"
    link_btn = f'<div style="text-align:center;margin:24px 0"><a href="{link}" style="display:inline-block;background:#FF0A78;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none">View Story</a></div>' if link else ''
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;border:1px solid #e2e8f0">
      {LOGO_HTML}
      <h2 style="color:#0F172A;font-size:18px">You've been assigned to a story</h2>
      <p style="color:#64748B;font-size:14px;line-height:1.6">
        Hi <strong>{assignee_name}</strong>, <strong>{assigner_name}</strong> assigned you to:
      </p>
      <div style="background:#F8FAFC;border-left:4px solid #FF0A78;padding:16px;margin:16px 0;border-radius:0 8px 8px 0">
        <p style="color:#0F172A;font-size:14px;font-weight:600;margin:0">{story_title}</p>
        <p style="color:#64748B;font-size:12px;margin:4px 0 0">Workspace: {workspace_name}</p>
      </div>
      {link_btn}
    </div>
    """
    return send_email(to_email, subject, text, html)
