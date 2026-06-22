# TestSurge — Full Deployment Guide

---

## What You Need Before Starting
- The project folder on your computer (e.g. `C:\Users\Naresh\test-case-generation`)
- The `testgen.pem` file (the SSH key) — ask Karthik for it if you don't have it
- Windows PowerShell or Terminal

---

## PART 1 — On YOUR Computer (PowerShell)

### Step 1: Open PowerShell
Press `Win + X` → click **Terminal** or **PowerShell**

### Step 2: Go to your project folder
```powershell
cd C:\Users\YOUR_USERNAME\test-case-generation
```
Replace `YOUR_USERNAME` with your actual Windows username (e.g. `Naresh`)

### Step 3: Build the deploy archive
Copy-paste this entire block:
```powershell
tar --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='.next-verify' --exclude='__pycache__' --exclude='*.pyc' -czf C:\Users\YOUR_USERNAME\tcg-deploy.tgz .
```
Wait 1-2 minutes. You'll see the prompt return when it's done.

### Step 4: Copy the archive to the server
```powershell
scp -i C:\Users\YOUR_USERNAME\Downloads\testgen.pem C:\Users\YOUR_USERNAME\tcg-deploy.tgz ubuntu@3.81.221.119:/home/ubuntu/
```
You'll see a progress bar. Wait for it to reach 100%.

---

## PART 2 — On THE SERVER (VPS)

### Step 5: Connect to the server
```powershell
ssh -i C:\Users\YOUR_USERNAME\Downloads\testgen.pem ubuntu@3.81.221.119
```
If it asks "Are you sure you want to continue connecting?" — type `yes` and press Enter.

Your prompt will change to:
```
ubuntu@ip-172-31-46-52:~$
```
That means you're now ON the server.

### Step 6: Go to the project folder
```bash
cd /home/ubuntu/test-case-generation
```

### Step 7: Stop the running app
```bash
docker compose --env-file .env.production down
```
Wait for all containers to say `Removed`.

### Step 8: Extract the new code
```bash
tar -xzf /home/ubuntu/tcg-deploy.tgz -C .
```
This takes 10-20 seconds.

### Step 9: Build and start everything
```bash
docker compose --env-file .env.production up -d --build 2>&1 | tee /tmp/deploy.log
```
⚠️ **This takes 10-15 minutes.** You'll see lots of output. Wait for the prompt to return.

### Step 10: Check that everything started
```bash
docker compose --env-file .env.production ps
```
All containers should show `Up` or `Up (healthy)`.

### Step 11: Verify the site works
```bash
curl -sk https://testsurge.kynetropo.com/app/api/health
```
You should see:
```json
{"db":"ok","lancedb":"ok","status":"ok"}
```

### Step 12: Leave the server
```bash
exit
```

---

## ✅ Done! Open the browser and check:
- `https://testsurge.kynetropo.com` → Marketing site
- `https://testsurge.kynetropo.com/app` → Main app (login page)
- `https://testsurge.kynetropo.com/app/admin/login` → Admin dashboard

---

## 🚨 If Something Goes Wrong

**Check what's wrong with backend:**
```bash
docker compose --env-file .env.production logs backend --tail=30
```

**Rebuild only backend (faster than full rebuild):**
```bash
docker compose --env-file .env.production build --no-cache backend
docker compose --env-file .env.production up -d backend
```

**Rebuild only frontend:**
```bash
docker compose --env-file .env.production build --no-cache app_frontend
docker compose --env-file .env.production up -d app_frontend
```

**See all running containers:**
```bash
docker compose --env-file .env.production ps
```

**View live logs:**
```bash
docker compose --env-file .env.production logs -f
```

**⛔ NEVER run this — it deletes your database:**
```bash
docker compose down -v   # DO NOT USE -v FLAG
```

---

## Important Notes
- Replace `YOUR_USERNAME` with your actual Windows username in every command
- The `.env.production` file already exists on the server — don't overwrite it
- Run Steps 1-4 on your own computer, Steps 5-12 on the server

---

## Credentials
- **Admin dashboard:** `https://testsurge.kynetropo.com/app/admin/login`
  - Email: `admin@kynetropo.com`
  - Password: `Adm-17wvsBKSDg1p8q`
- **Server IP:** `3.81.221.119`
- **SSH key:** `testgen.pem` (keep this safe, never share publicly)
