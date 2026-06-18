from celery_app import celery
from app.services.email_service import get_email_service
import os

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_verify_email(self, to_email, name, verification_token):
    try:
        service = get_email_service()
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        verification_url = f"{frontend_url}/verify-email?token={verification_token}"
        
        service.render_and_send(
            template_name="verify_email.html",
            to_addresses=to_email,
            subject="Verify your Kynetropo email address",
            name=name,
            verification_url=verification_url
        )
    except Exception as exc:
        raise self.retry(exc=exc)

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_welcome_email(self, to_email, name):
    try:
        service = get_email_service()
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        dashboard_url = f"{frontend_url}/dashboard"
        
        service.render_and_send(
            template_name="welcome.html",
            to_addresses=to_email,
            subject="Welcome to Kynetropo!",
            name=name,
            dashboard_url=dashboard_url
        )
    except Exception as exc:
        raise self.retry(exc=exc)

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_invite_user(self, to_email, inviter_name, invite_token):
    try:
        service = get_email_service()
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        invite_url = f"{frontend_url}/invite/{invite_token}"
        
        service.render_and_send(
            template_name="invite_user.html",
            to_addresses=to_email,
            subject=f"{inviter_name} invited you to join Kynetropo",
            inviter_name=inviter_name,
            invite_url=invite_url
        )
    except Exception as exc:
        raise self.retry(exc=exc)

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_forgot_password(self, to_email, name, reset_token):
    try:
        service = get_email_service()
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        
        service.render_and_send(
            template_name="forgot_password.html",
            to_addresses=to_email,
            subject="Reset your Kynetropo password",
            name=name,
            reset_url=reset_url
        )
    except Exception as exc:
        raise self.retry(exc=exc)

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_trial_ending(self, to_email, name):
    try:
        service = get_email_service()
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        billing_url = f"{frontend_url}/settings/billing"
        
        service.render_and_send(
            template_name="trial_ending.html",
            to_addresses=to_email,
            subject="Your Kynetropo trial is ending soon",
            name=name,
            billing_url=billing_url
        )
    except Exception as exc:
        raise self.retry(exc=exc)

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_payment_failed(self, to_email, name):
    try:
        service = get_email_service()
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        billing_url = f"{frontend_url}/settings/billing"
        
        service.render_and_send(
            template_name="payment_failed.html",
            to_addresses=to_email,
            subject="Action Required: Payment Failed",
            name=name,
            billing_url=billing_url
        )
    except Exception as exc:
        raise self.retry(exc=exc)

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_subscription_renewed(self, to_email, name, plan_name, amount):
    try:
        service = get_email_service()
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        billing_url = f"{frontend_url}/settings/billing"
        
        service.render_and_send(
            template_name="subscription_renewed.html",
            to_addresses=to_email,
            subject="Kynetropo Subscription Renewed",
            name=name,
            plan_name=plan_name,
            amount=amount,
            billing_url=billing_url
        )
    except Exception as exc:
        raise self.retry(exc=exc)
