# Deployment Guide — testforge.kynetropo.com

## Architecture
```
testforge.kynetropo.com     → Vercel (Next.js frontend)
api.kynetropo.com           → Railway (Flask API, port 5000)
scheduler.kynetropo.com     → Railway (Flask Scheduler, port 5001)
Database                    → Neon (PostgreSQL)
```

---

## Step 1 — Neon Database (5 minutes)

1. Go to https://neon.tech → Sign up free
2. Create new project → name it "testforge"
3. Select region: **Singapore** (closest to your Hostinger India server)
4. Once created, click "Connection Details"
5. Select "Connection string" → copy the string that looks like:
   ```
   postgresql://username:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
6. Keep this tab open — you'll need these values

### Run database setup against Neon:
```bash
# In your local terminal, set the Neon credentials temporarily
set POSTGRES_HOST=ep-xxx.ap-southeast-1.aws.neon.tech
set POSTGRES_DB=neondb
set POSTGRES_USER=your_neon_user
set POSTGRES_PASSWORD=your_neon_password
set POSTGRES_PORT=5432

cd Backend
python app/models/create_dbs.py
```

---

## Step 2 — Railway Backend (10 minutes)

### Deploy Flask API

1. Go to https://railway.app → Sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repo → set **Root Directory** to `Backend`
4. Railway will detect the Dockerfile automatically
5. Add these environment variables in Railway dashboard:

```
POSTGRES_HOST        = ep-xxx.ap-southeast-1.aws.neon.tech
POSTGRES_DB          = neondb
POSTGRES_USER        = your_neon_user
POSTGRES_PASSWORD    = your_neon_password
POSTGRES_PORT        = 5432
GROQ_API_KEY         = your_groq_key
GROQ_API_KEY_IMPACT  = your_groq_key
GOOGLE_GENERATIVE_AI_API_KEY = your_gemini_key
LANCE_DB_PATH        = /app/data/lance_db
TABLE_NAME_LANCE     = user_stories
FRONTEND_URL         = https://testforge.kynetropo.com
FLASK_ENV            = production
FLASK_DEBUG          = 0
```

6. After deploy, Railway gives you a URL like `https://backend-production-xxxx.up.railway.app`
7. In Railway → Settings → Domains → Add custom domain: `api.kynetropo.com`

### Deploy Scheduler (second Railway service)

1. In the same Railway project → "New Service" → "GitHub repo"
2. Same repo, same root directory `Backend`
3. Go to Settings → change Dockerfile path to `Dockerfile.scheduler`
4. Add same environment variables as above
5. Custom domain: `scheduler.kynetropo.com`

---

## Step 3 — Vercel Frontend (5 minutes)

1. Go to https://vercel.com → Sign up with GitHub
2. "New Project" → import your GitHub repo
3. Set **Root Directory** to `frontend/test-case-generator`
4. Add environment variables:

```
NEXT_PUBLIC_API_URL              = https://api.kynetropo.com
NEXT_PUBLIC_SCHEDULER_API_URL    = https://scheduler.kynetropo.com
GOOGLE_GENERATIVE_AI_API_KEY     = AQ.Ab8RN6ICoVfMg2DWMeoZFWYwHm_Lpl_NUW-ecgMgQtWa6fK5lQ
```

5. Deploy → Vercel gives you `testforge-xxx.vercel.app`
6. Go to Settings → Domains → Add `testforge.kynetropo.com`

---

## Step 4 — DNS in Hostinger (5 minutes)

Go to Hostinger → Domains → kynetropo.com → DNS Zone

Add these records:

| Type  | Name        | Value                          | TTL  |
|-------|-------------|--------------------------------|------|
| CNAME | testforge   | cname.vercel-dns.com           | 3600 |
| CNAME | api         | your-railway-api.up.railway.app | 3600 |
| CNAME | scheduler   | your-railway-sched.up.railway.app | 3600 |

> Vercel will verify the domain automatically. Railway also has a "verify domain" button.

DNS propagation takes 5–30 minutes.

---

## Step 5 — Verify everything works

```
https://testforge.kynetropo.com          → Should load the dashboard
https://api.kynetropo.com/api/stories/projects  → Should return {"projects": [...]}
https://scheduler.kynetropo.com/api/scheduler/next-reload → Should return a timestamp
```

---

## Troubleshooting

**CORS error in browser:**
- Make sure `FRONTEND_URL=https://testforge.kynetropo.com` is set in Railway

**Database connection error:**
- Neon connection strings require `?sslmode=require` at the end
- Check that `create_dbs.py` was run against Neon successfully

**LanceDB missing:**
- It initializes automatically on first run — just upload a story

**Cold start (first request is slow):**
- Railway free tier spins down after inactivity. First request takes ~10s to wake up.
- This is normal for free tier.
