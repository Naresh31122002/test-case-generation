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

    # Register tasks by importing them
    import app.tasks.email_tasks
    import app.tasks.scheduler
    
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
