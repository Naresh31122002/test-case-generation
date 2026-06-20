# TestSurge VPS Deployment

This project is deployed as a single Docker Compose stack on the existing VPS.

Expected public URLs:

```text
https://testsurge.kynetropo.com       -> portfolio / marketing site
https://testsurge.kynetropo.com/app   -> TestSurge app frontend
https://testsurge.kynetropo.com/app/api/* -> Flask backend API
```

The project is expected to already exist on the VPS at:

```text
/home/ubuntu/test-case-generation
```

Do not recreate the project under `/opt` unless you intentionally want a new deployment location.

## 1. DNS

In Hostinger DNS, point the main domain to the VPS public IP:

```text
A     @      3.81.221.119
A     www    3.81.221.119
```

`app.testsurge.kynetropo.com` is optional. The current deployment uses `testsurge.kynetropo.com/app`.

## 2. Build The Deploy Archive Locally

Run this from your local machine:

```bash
cd /home/karthikeyan/vscode/api-EcoSudar/test-case-generation

tar \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.next-verify' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='Backend/.env' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  -czf /tmp/test-case-generation-deploy.tgz .
```

Copy it to the existing VPS:

```bash
scp -i /home/karthikeyan/Downloads/testgen.pem \
  /tmp/test-case-generation-deploy.tgz \
  ubuntu@3.81.221.119:/home/ubuntu/
```

## 3. Update The Existing VPS Folder

SSH into the VPS:

```bash
ssh -i /home/karthikeyan/Downloads/testgen.pem ubuntu@3.81.221.119
```

Go to the existing project folder:

```bash
cd /home/ubuntu/test-case-generation
```

Stop the current stack without deleting volumes:

```bash
docker compose --env-file .env.production down
```
Extract the latest code into the same folder:

```bash
tar -xzf /home/ubuntu/test-case-generation-deploy.tgz -C .
```

Do not run `docker compose down -v`. The `-v` flag deletes Docker volumes, including Postgres data.

## 4. Production Environment File

The VPS should have:

```text
/home/ubuntu/test-case-generation/.env.production
```

If it does not exist:

```bash
cp docker.env.production.example .env.production
nano .env.production
```

Required values:

```env
JWT_SECRET_KEY=replace-with-a-strong-random-secret
GROQ_API_KEY=your_groq_key
GROQ_API_KEY_IMPACT=your_groq_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_gemini_key

PUBLIC_APP_URL=https://testsurge.kynetropo.com/app
FRONTEND_ORIGIN=https://testsurge.kynetropo.com

POSTGRES_DB=test_case_gen
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace-with-strong-password
```

Generate a strong JWT secret:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## 5. Start The Stack

From `/home/ubuntu/test-case-generation`:

```bash
docker compose --env-file .env.production up -d --build
```

Check containers:

```bash
docker compose --env-file .env.production ps
```

Check backend logs:

```bash
docker compose --env-file .env.production logs -f backend
```

## 6. Verify From VPS

Run these on the VPS:

```bash
curl -I http://localhost/
curl -I http://localhost/app
curl http://localhost/app/api/health
```

Expected:

```text
http://localhost/              -> portfolio response
http://localhost/app           -> app frontend response
http://localhost/app/api/health -> backend health JSON
```

## 7. Verify From Browser

Open:

```text
http://testsurge.kynetropo.com
http://testsurge.kynetropo.com/app
```

If HTTPS is already configured by an outer reverse proxy, use:

```text
https://testsurge.kynetropo.com
https://testsurge.kynetropo.com/app
```

## 8. Useful Docker Commands

View all containers:

```bash
docker compose --env-file .env.production ps
```

Restart only backend:

```bash
docker compose --env-file .env.production restart backend
```

Restart everything:

```bash
docker compose --env-file .env.production restart
```

View logs:

```bash
docker compose --env-file .env.production logs -f
```

View backend logs:

```bash
docker compose --env-file .env.production logs -f backend
```

Enter backend container:

```bash
docker compose --env-file .env.production exec backend sh
```

Enter Postgres:

```bash
docker compose --env-file .env.production exec postgres psql -U postgres -d test_case_gen
```

## 9. Troubleshooting

If the app loads but API calls fail:

```bash
curl http://localhost/app/api/health
docker compose --env-file .env.production logs -f backend
```

If portfolio links go to the wrong app URL, confirm:

```bash
grep PUBLIC_APP_URL .env.production
```

It should be:

```env
PUBLIC_APP_URL=https://testsurge.kynetropo.com/app
```

If backend exits immediately, check `JWT_SECRET_KEY`:

```bash
docker compose --env-file .env.production logs backend
```

Production backend will not start without a strong `JWT_SECRET_KEY`.

If Postgres data must be preserved, never run:

```bash
docker compose down -v
```

Use this instead:

```bash
docker compose --env-file .env.production down
```
