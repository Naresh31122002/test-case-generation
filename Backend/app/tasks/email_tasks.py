from celery_app import celery
from app.utils.mailer import send_email
import os

FRONTEND_URL = os.environ.get("APP_URL", "http://localhost:3000")


def _render(template_name: str, **ctx) -> str:
    """Render an email HTML template via Flask's template engine."""
    from flask import current_app, render_template
    # Celery workers run outside a request context; push an app context
    # so render_template can locate the templates folder.
    with current_app.app_context():
        return render_template(f"emails/{template_name}", **ctx)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_verify_email(self, to_email, name, verification_token):
    try:
        url = f"{FRONTEND_URL}/verify-email?token={verification_token}"
        html = _render("verify_email.html", name=name, verification_url=url)
        send_email(to_email, "Verify your TestSurge email address", text_body=url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_welcome_email(self, to_email, name):
    try:
        url = f"{FRONTEND_URL}/stories"
        html = _render("welcome.html", name=name, dashboard_url=url)
        send_email(to_email, "Welcome to TestSurge!", text_body=url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_invite_user(self, to_email, inviter_name, invite_token):
    try:
        url = f"{FRONTEND_URL}/onboarding/workspace?invite={invite_token}"
        html = _render("invite_user.html", inviter_name=inviter_name, invite_url=url)
        send_email(to_email, f"{inviter_name} invited you to join TestSurge", text_body=url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_forgot_password(self, to_email, name, reset_token):
    try:
        url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
        html = _render("forgot_password.html", name=name, reset_url=url)
        send_email(to_email, "Reset your TestSurge password", text_body=url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_trial_ending(self, to_email, name):
    try:
        url = f"{FRONTEND_URL}/settings/billing"
        html = _render("trial_ending.html", name=name, billing_url=url)
        send_email(to_email, "Your TestSurge trial is ending soon", text_body=url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_payment_failed(self, to_email, name):
    try:
        url = f"{FRONTEND_URL}/settings/billing"
        html = _render("payment_failed.html", name=name, billing_url=url)
        send_email(to_email, "Action Required: Payment Failed", text_body=url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_subscription_renewed(self, to_email, name, plan_name, amount):
    try:
        url = f"{FRONTEND_URL}/settings/billing"
        html = _render("subscription_renewed.html", name=name, plan_name=plan_name, amount=amount, billing_url=url)
        send_email(to_email, "TestSurge Subscription Renewed", text_body=url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)
