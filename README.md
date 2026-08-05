# FWCUT — Factory Warranty Claims Underwriting Tool

Vehicle warranty claims intake, document upload, and automated policy underwriting.

**Stack:** Next.js 16 · React 19 · Vercel Postgres (Neon) · Vercel Blob · JWT Auth · Grok AI · GitHub Actions · Vercel

---

## Features

| Feature | Description |
|---------|-------------|
| **Claim intake** | Staff-only form at `/submit` with document upload |
| **Claim workspace** | Shareable claim detail at `/claims/[id]` (queue + full underwriting) |
| **Staff auth** | Password-protected dashboard and underwriting (Reviewer / Supervisor) |
| **Rate limiting** | 10 claim submissions per hour per IP |
| **Structured logging** | JSON logs (visible in Vercel Runtime Logs) |
| **Screenshot autofill** | Upload a portal screenshot — AI extracts and fills the claim form |
| **Policy lookup** | Contract type resolved from policy number prefix (FWCL, FWVL, FWDR, FWCP, FWCPM) |
| **Contract-aware underwriting** | Rule engine + Grok AI use plan-specific waiting periods, coverage model, and limits |
| **Component coverage pre-check** | Section 2 keyword rules from plan contracts (stated vs exclusionary; FWCPM 1b exception) |
| **Aggregate LOL** | Policy-level sum of prior approved claims vs plan max aggregate |
| **Auto-approve guardrails** | Final approve only when AI risk ≤ 4, confidence ≥ 80%, no fraud/info gaps |
| **Document reading** | Extracts text from attached PDFs/text into AI underwriting context |
| **Request info** | Adjuster checklist → `needs_info` status; clear when received |
| **Manual decision** | Approve / deny / review with required reason + audit trail |
| **Activity history** | Claim timeline of submit, AI, underwrite, info, manual decisions |
| **Labor rate rules** | Parse $/hr and diagnostic hours; hold when over class caps |
| **Multi-user auth** | Named staff users (seeded from env); shared password fallback |
| **Document OCR** | Image attachments read via Grok vision into AI context |
| **Claim status portal** | Public `/status` lookup by tracking code + last name |
| **FWIS intake** | Primary path: contract # + claim # import from FWIS (screenshots are fallback only) |
| **AI underwriting** | Grok risk scoring, fraud detection, smart recommendations |
| **Auto analysis** | Background AI scan on every new claim submission |
| **Staff tutorial** | In-app guide (header Tutorial toggle) for queue, AI, intake/FWIS, and supervisor tools — not public |

---

## Local development (Codespaces)

Requires **Node.js 20.9+**.

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

```bash
npm test          # unit tests (vitest)
npm run lint      # ESLint flat config
npm run build     # production build (Turbopack)
```

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
| `FWIS_API_KEY` | Freedom Warranty FWIS API key | No (until live) |
| `FWIS_BASE_URL` | Default `https://fwis.freedomwarranty.com` | No |
| `FWIS_AUTH_STYLE` | `bearer` (default), `api_key_header`, or `raw_authorization` | No |
| `FWIS_PUSH_DECISIONS` | `true` to push manual decisions back to FWIS | No |

`POSTGRES_URL` and `BLOB_READ_WRITE_TOKEN` are set automatically by Vercel Storage.

### User roles

| Role | Access |
|------|--------|
| **Public** | Check claim status at `/status` with tracking code + last name |
| **Reviewer** (adjuster) | Named user or shared password — queue, claim workspace, underwriting |
| **Supervisor** | Same as reviewer **plus** Admin Tools (users, knowledge, toolbox) |

---

## API routes (selected)

| Route | Auth | Description |
|-------|------|-------------|
| `POST /api/claims` | Public (rate limited) | Submit claim |
| `POST /api/claims/lookup-policy` | Public (rate limited) | Resolve contract type from policy number |
| `POST /api/claims/extract` | Public (rate limited) | Extract form data from portal screenshot |
| `GET /api/claims` | Adjuster | List claims |
| `GET /api/claims/:id` | Adjuster | Single claim detail |
| `GET /api/claims/stats` | Adjuster | Queue stats for dashboard |
| `POST /api/claims/:id/underwrite` | Adjuster | AI + rule-based underwriting |
| `POST /api/claims/:id/analyze` | Adjuster | Run/re-run AI analysis |
| `POST /api/claims/:id/decide` | Adjuster | Manual approve / deny / review |
| `POST /api/claims/:id/request-info` | Adjuster | Request more info from claimant |
| `GET /api/claims/:id/events` | Adjuster | Claim activity timeline |
| `POST /api/fwis/import` | Adjuster | Import claim from FWIS |
| `GET /api/public/claim-status` | Public | Status lookup by tracking code + last name |
| `POST /api/auth/login` | Public | Sign in |
| `POST /api/auth/logout` | Public | Sign out |
| `GET /api/auth/session` | Public | Check session |
| `GET /api/health` | Public | Health check |
| `/api/admin/*` | Supervisor | Users, knowledge, toolbox, sandbox |

---

## Project structure

```
app/              Pages + API routes
components/       ClaimForm, ClaimsDashboard, LoginForm, AppNav, …
lib/              auth, claims-store, contract-rules, client-api, fwis, underwrite
contracts/        Freedom Warranty plan registration HTML (reference)
proxy.ts          Auth gate for /claims, /submit, /admin, and staff APIs
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
| 6 — Multi-user, OCR, public status, FWIS intake | ✅ |
| 7 — Next.js 16 + React 19 | ✅ |