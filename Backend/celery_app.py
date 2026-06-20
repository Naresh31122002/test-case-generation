import os
from celery import Celery
from app import create_app
from celery.schedules import crontab

def make_celery(app=None):
    if app is None:
        app = create_app()

    celery = Celery(
        app.import_name,
        backend=os.environ.get('CELERY_RESULT_BACKEND', 'redis://redis:6379/0'),
        broker=os.environ.get('CELERY_BROKER_URL', 'redis://redis:6379/0')
    )
    celery.conf.update(app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask

    # Configure Celery Beat schedule
    celery.conf.beat_schedule = {
        'run-pipeline-every-5-minutes': {
            'task': 'app.tasks.scheduler.run_pipeline',
            'schedule': crontab(minute='*/5'),
        },
    }
    celery.conf.timezone = 'UTC'

    return celery

celery = make_celery()

# Register task modules AFTER `celery` is bound at module scope. Each task module
# does `from celery_app import celery`; importing them here (instead of inside
# make_celery(), which runs before `celery` is assigned) avoids the circular
# import: "cannot import name 'celery' from partially initialized module".
import app.tasks.email_tasks   # noqa: E402,F401
import app.tasks.scheduler     # noqa: E402,F401
