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
RUN pip install gunicorn

# Copy app source
COPY . .

# Create LanceDB data directory
RUN mkdir -p /app/data/lance_db

EXPOSE 5000

# Gunicorn: 2 workers, 120s timeout (LLM calls can be slow)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "--access-logfile", "-", "run:app"]
