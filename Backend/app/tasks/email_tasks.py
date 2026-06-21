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


# ── Collaboration notifications (Sprint 1 Phase 5) ──────────────────────────────
# All callers pass already-resolved, workspace-scoped recipient emails. These
# tasks never look up membership themselves; tenant scoping is enforced at the
# dispatch site (only workspace members are ever passed in).

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_story_assigned(self, to_email, actor_name, workspace_name, story_id, story_title, story_url):
    try:
        html = _render(
            "story_assigned.html",
            actor_name=actor_name, workspace_name=workspace_name,
            story_id=story_id, story_title=story_title, link_url=story_url,
        )
        send_email(to_email, f"You were assigned {story_id} in {workspace_name}", text_body=story_url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_test_case_assigned(self, to_email, actor_name, workspace_name, test_case_id, test_case_title, link_url):
    try:
        html = _render(
            "test_case_assigned.html",
            actor_name=actor_name, workspace_name=workspace_name,
            test_case_id=test_case_id, test_case_title=test_case_title, link_url=link_url,
        )
        send_email(to_email, f"You were assigned {test_case_id} in {workspace_name}", text_body=link_url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_comment_added(self, to_email, actor_name, workspace_name, target_label, target_id, comment_body, link_url):
    try:
        html = _render(
            "comment_added.html",
            actor_name=actor_name, workspace_name=workspace_name,
            target_label=target_label, target_id=target_id,
            comment_body=comment_body, link_url=link_url,
        )
        send_email(to_email, f"New comment on {target_id} in {workspace_name}", text_body=link_url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_mention(self, to_email, actor_name, workspace_name, target_id, comment_body, link_url):
    try:
        html = _render(
            "mention.html",
            actor_name=actor_name, workspace_name=workspace_name,
            target_id=target_id, comment_body=comment_body, link_url=link_url,
        )
        send_email(to_email, f"{actor_name} mentioned you in {workspace_name}", text_body=link_url, html_body=html)
    except Exception as exc:
        raise self.retry(exc=exc)
