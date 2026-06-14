FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg2, sentence-transformers, PyMuPDF
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    libmupdf-dev \
    mupdf-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY . .

# Create LanceDB data directory
RUN mkdir -p /app/data/lance_db

EXPOSE 5000

# Use shell form so $PORT env var is expanded — Railway injects PORT at runtime
CMD gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 120 --access-logfile - run:app
