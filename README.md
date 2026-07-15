# FWCUT — Factory Warranty Claims Underwriting Tool

Vehicle warranty claims intake, document upload, and automated policy underwriting.

**Stack:** Next.js 14 · Vercel Postgres (Neon) · Vercel Blob · JWT Auth · GitHub Actions · Vercel

---

## Features

| Feature | Description |
|---------|-------------|
| **Claim submission** | Public form at `/submit` with document upload |
| **Adjuster auth** | Password-protected dashboard and underwriting |
| **Rate limiting** | 10 claim submissions per hour per IP |
| **Structured logging** | JSON logs (visible in Vercel Runtime Logs) |
| **Screenshot autofill** | Upload a portal screenshot — AI extracts and fills the claim form |
| **Policy lookup** | Contract type resolved from policy number prefix (FWCL, FWVL, FWDR, FWCP, FWCPM) |
| **Contract-aware underwriting** | Rule engine + Grok AI use plan-specific waiting periods, coverage model, and limits |
| **Component coverage pre-check** | Keyword rules for stated vs exclusionary plans (hard deny on clear non-covered items) |
| **Aggregate LOL** | Policy-level sum of prior approved claims vs plan max aggregate |
| **Auto-approve guardrails** | Final approve only when AI risk ≤ 4, confidence ≥ 80%, no fraud/info gaps |
| **AI underwriting** | Grok risk scoring, fraud detection, smart recommendations |
| **Auto analysis** | Background AI scan on every new claim submission |

---

## Local development (Codespaces)

```bash
docker compose up -d postgres
cp .env.example .env.local
npm install
npm run dev
```

| Variable | Purpose |
|----------|---------|
| `POSTGRES_URL` | Local Docker Postgres |
| `AUTH_SECRET` | JWT signing key (32+ chars) |
| `ADJUSTER_PASSWORD` | Login password for adjusters |
| `SUPERVISOR_PASSWORD` | Optional supervisor password |

**Default local login:** password from `ADJUSTER_PASSWORD` in `.env.local`

---

## Deploy to Vercel

### Storage (if not already added)
1. **Storage → Postgres** — sets `POSTGRES_URL`
2. **Storage → Blob** — sets `BLOB_READ_WRITE_TOKEN`

### Environment variables

| Key | Value | Required |
|-----|-------|----------|
| `NEXT_PUBLIC_USE_BLOB_UPLOAD` | `true` | Yes |
| `AUTH_SECRET` | Random 32+ char string (`openssl rand -base64 32`) | Yes |
| `ADJUSTER_PASSWORD` | Strong production password | Yes |
| `SUPERVISOR_PASSWORD` | Supervisor password (optional) | No |
| `GROK_API_KEY` | Grok API key from [console.x.ai](https://console.x.ai) | Yes (prod) |
| `AI_MODEL` | Text model (default `grok-3-mini`) | No |
| `AI_VISION_MODEL` | Vision model for screenshot autofill (default `grok-3`) | No |

`POSTGRES_URL` and `BLOB_READ_WRITE_TOKEN` are set automatically by Vercel Storage.

### User roles

| Role | Access |
|------|--------|
| **Public** | Submit claims at `/submit` |
| **Adjuster** | View dashboard, run underwriting |
| **Supervisor** | Same as adjuster (separate password) |

---

## API routes

| Route | Auth | Description |
|-------|------|-------------|
| `POST /api/claims` | Public (rate limited) | Submit claim |
| `POST /api/claims/lookup-policy` | Public (rate limited) | Resolve contract type from policy number |
| `POST /api/claims/extract` | Public (rate limited) | Extract form data from portal screenshot |
| `GET /api/claims` | Adjuster | List claims |
| `POST /api/claims/:id/underwrite` | Adjuster | AI + rule-based underwriting |
| `POST /api/claims/:id/analyze` | Adjuster | Run/re-run AI analysis |
| `POST /api/auth/login` | Public | Sign in |
| `POST /api/auth/logout` | Public | Sign out |
| `GET /api/auth/session` | Public | Check session |
| `GET /api/health` | Public | Health check |

---

## Project structure

```
app/              Pages + API routes
components/       ClaimForm, ClaimsDashboard, LoginForm, Nav
lib/              auth, claims-store, contract-rules, policy-lookup, underwrite
contracts/        Freedom Warranty plan registration HTML (reference)
middleware.ts     Protects /claims and adjuster API routes
```

---

## Migration history

| Phase | Status |
|-------|--------|
| 1 — Next.js foundation | ✅ |
| 2 — API + database | ✅ |
| 3 — Frontend | ✅ |
| 4 — Vercel + Postgres + Blob | ✅ |
| 5 — Auth, rate limits, logging | ✅ |