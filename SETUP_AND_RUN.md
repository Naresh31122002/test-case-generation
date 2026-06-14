# Test-Forge-AI — Local Setup & Run Guide

This guide gets the full app running on your machine: **Flask backend** (port 5000), an optional **scheduler service** (port 5001), and the **Next.js frontend** (port 3000).

---

## 1. Prerequisites

Install these first:

| Tool | Version | Notes |
|------|---------|-------|
| **Python** | **3.10 – 3.12** | Do **not** use 3.13. The pinned deps (`numpy 1.26.4`, `pandas 2.2.1`, `lancedb 0.5.3`, `sentence-transformers 2.5.1`) don't build on 3.13 yet. |
| **PostgreSQL** | 13+ | Must be running locally on port 5432. |
| **Node.js** | 18+ | For the Next.js frontend. |
| **Groq API key** | — | Free at https://console.groq.com/keys |

First run downloads the `all-mpnet-base-v2` embedding model (~400 MB) and PyTorch — expect a slow first start.

---

## 2. Backend setup

Open a terminal in the `Backend` folder.

### 2a. Create the environment file
Copy the template and fill in your values:
```bat
copy .env.example .env
```
At minimum, set `GROQ_API_KEY` and your Postgres credentials (`POSTGRES_USER`, `POSTGRES_PASSWORD`) in `.env`.

### 2b. Create a virtual environment & install deps
```bat
python -m venv venv
venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```
> A `venv` folder already exists in the repo, but recreating it cleanly avoids path/version mismatches.

### 2c. Make sure PostgreSQL is running
Confirm you can connect with the user/password you put in `.env`. The next step creates the database for you if it doesn't exist.

### 2d. Create the database schema and vector table
```bat
python app\models\create_dbs.py
```
This creates the `test_case_generator` database, the `test_cases`, `test_case_impacts`, and `impact_history` tables, the `impact_metrics` / `test_case_impact_summary` views, and the LanceDB `user_stories` table. **The app will not work until this runs successfully.**

### 2e. Create the data folders
```bat
python setup_project_folders.py
```

### 2f. Start the backend API
```bat
python run.py
```
Backend is now live at **http://127.0.0.1:5000** (the frontend expects this exact address).

---

## 3. Scheduler service (optional but recommended)

The frontend's home page calls port **5001** for the auto-reload/refresh feature. In a **second** terminal (with the venv activated):
```bat
cd Backend
venv\Scripts\activate
python standalone_scheduler.py
```
This serves `http://127.0.0.1:5001` and runs the ingest pipeline every 5 minutes.

> `scheduler.py` is the heavier, blocking version that also does Jira sync + embeddings + test generation on a loop. Use `standalone_scheduler.py` for the lightweight endpoint the UI needs; use `scheduler.py` if you want the full background pipeline.

---

## 4. Frontend setup

Open a **third** terminal in `frontend/test-case-generator`:
```bat
npm install
npm run dev
```
Open **http://localhost:3000**.

The frontend already has the backend URLs hardcoded (`127.0.0.1:5000` and `127.0.0.1:5001`), so no API-URL env var is needed.

---

## 5. Quick smoke test

1. Backend up on 5000, scheduler on 5001, frontend on 3000.
2. In the UI, upload a user story (paste text or a PDF/DOCX/TXT) with a Project ID and Story ID.
3. The backend extracts text → embeds it into LanceDB → generates test cases via Groq → stores them in Postgres → runs impact analysis.
4. The story should appear in the list with a test-case count and a download (Excel) link.

If upload returns `test_cases_generated: false`, check the backend terminal — it's almost always a bad/empty `GROQ_API_KEY` or a Postgres connection error.

---

## 6. Things to fix before this is production-ready

These don't block local running, but you flagged "make a product," so note them:

1. **Hardcoded API key (security).** `frontend/test-case-generator/app/api/generate-test-cases/route.ts` (~line 264) contains a hardcoded Google Gemini API key. Move it to an env var (`GOOGLE_GENERATIVE_AI_API_KEY`) and **rotate/revoke the exposed key**.
2. **Groq vs. Gemini confusion.** `requirements.txt` and the frontend deps reference Google Generative AI, but the backend actually runs on **Groq** (`config.py`). Comments saying "Gemini" are misleading. Pick one provider and clean up the unused deps.
3. **Hardcoded backend URLs.** The frontend hardcodes `127.0.0.1:5000/5001`. Replace with `NEXT_PUBLIC_API_BASE_URL` so it can be deployed.
4. **Flask in debug mode** binding `0.0.0.0:5000` — switch to a production WSGI server (gunicorn/waitress) and `debug=False` for deployment.
5. **No auth, no Dockerfile, no tests, no top-level README** despite the project name. Worth adding for shipping.

---

## Architecture at a glance

```
Next.js 15 (3000)  ──HTTP──▶  Flask API (5000)  ──▶  Groq LLM (llama-3.1-8b-instant)
 React 19 / shadcn            /api/stories/*          PostgreSQL  (test cases + impacts)
                                                       LanceDB     (story embeddings, RAG)
                              Scheduler (5001) ──▶ Jira sync → embed → generate → impact
```
