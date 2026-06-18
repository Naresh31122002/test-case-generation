FROM python:3.10-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --user --no-cache-dir -r requirements.txt gunicorn

FROM python:3.10-slim

WORKDIR /app

# Install runtime system dependencies for PostgreSQL and others
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python dependencies
COPY --from=builder /root/.local /root/.local

# Ensure the local bin is on PATH
ENV PATH=/root/.local/bin:$PATH

# Copy backend application code
COPY . .

# Set environment variables for production
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Expose port for Gunicorn
EXPOSE 5000

CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:create_app()"]
