# FWCUT — Factory Warranty Claims Underwriting Tool

Vehicle warranty claims intake, document upload, and automated policy underwriting.

**Stack:** Next.js 14 · Vercel Postgres (Neon) · Vercel Blob · GitHub Actions · Vercel

---

## Local development (Codespaces)

```bash
docker compose up -d postgres
cp .env.example .env.local
npm install
npm run dev
```

Open **http://localhost:3000**

| Variable | Local value |
|----------|-------------|
| `POSTGRES_URL` | `postgresql://postgres:pass@localhost:5432/warranty_claims` |
| `NEXT_PUBLIC_USE_BLOB_UPLOAD` | `false` |

---

## Deploy to Vercel (step-by-step)

Repo: **https://github.com/Chrismiller122580/underwriter**

### 1. Push code to GitHub

```bash
git add .
git commit -m "FWCUT Next.js app with Vercel Postgres"
git push origin main
```

### 2. Create Vercel Postgres database

1. [vercel.com](https://vercel.com) → your project → **Storage** tab
2. Click **Create Database** → choose **Postgres** (powered by Neon)
3. Vercel automatically sets `POSTGRES_URL` for your project

### 3. Create Vercel Blob storage

1. Same **Storage** tab → **Create Database** → **Blob**
2. Vercel sets `BLOB_READ_WRITE_TOKEN` automatically

### 4. Add one manual env var

In **Settings → Environment Variables**, add:

| Key | Value | Environments |
|-----|-------|--------------|
| `NEXT_PUBLIC_USE_BLOB_UPLOAD` | `true` | Production + Preview |

`POSTGRES_URL` and `BLOB_READ_WRITE_TOKEN` are set automatically by Storage.

### 5. Redeploy

Vercel rebuilds on push. After adding Storage, click **Redeploy** on the latest deployment.

### 6. Verify

- `/` — home page loads
- `/submit` — submit a test claim with documents
- `/claims` — claim appears in dashboard
- Click **Underwrite** on a pending claim

---

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/claims` | GET | List all claims |
| `/api/claims` | POST | Submit claim (multipart or JSON) |
| `/api/claims/:id/underwrite` | POST | Run policy validation |
| `/api/upload` | POST | Blob upload handler (production) |
| `/api/health` | GET | Health check |

---

## Project structure

```
app/              Next.js pages + API routes
components/       ClaimForm, ClaimsDashboard, Nav
lib/              db, claims-store, underwrite, uploads
public/           Static assets + legacy form fallback
docker-compose.yml  Local Postgres (dev only)
vercel.json       Vercel build config
```

---

## Migration history

| Phase | Status |
|-------|--------|
| 1 — Next.js foundation | ✅ |
| 2 — API + database | ✅ |
| 3 — Frontend | ✅ |
| 4 — Vercel + Postgres + Blob | ✅ |
| 5 — Hardening (auth, rate limits) | Planned |