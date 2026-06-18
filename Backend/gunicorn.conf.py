import multiprocessing
import os

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
# Use sync workers but scale up threads to handle concurrency
workers = int(os.environ.get("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = 'gthread'
threads = int(os.environ.get("GUNICORN_THREADS", 4))

# Timeout
# Increase timeout because LLM generation / vector queries can take time
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 300))
keepalive = 2

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Process naming
proc_name = "test-case-generator-backend"
