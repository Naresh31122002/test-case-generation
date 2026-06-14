FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    libmupdf-dev \
    mupdf-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data/lance_db

ENV PORT=5000
EXPOSE 5000

CMD gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 300 --access-logfile - run:app
