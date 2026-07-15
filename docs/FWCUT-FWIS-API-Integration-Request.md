# FWCUT ↔ FWIS API Integration Request

**Prepared for:** Freedom Warranty — FWIS Technical / Partner Integrations  
**System:** https://fwis.freedomwarranty.com  
**Date:** July 15, 2026  
**Purpose:** Enable secure API access so FWCUT can load contract and claim data from FWIS (replacing manual portal screenshots) and optionally return underwriting decisions.

---

## 1. Executive summary

We are building **FWCUT** (Factory Warranty Claims Underwriting Tool) for Freedom Warranty adjusters and supervisors. Staff currently enter claims manually or from portal screenshots. We are ready to integrate directly with **FWIS** so that:

- Adjusters enter a **contract (policy) number** and **claim number**
- FWCUT retrieves the full claim package from FWIS via API
- Underwriting rules and AI run on that authoritative data
- Optionally, final decisions (approve / deny / needs information) are written back to FWIS

Our client layer is already implemented and configurable. We need confirmed **authentication**, **endpoint URLs**, and **sample JSON** from your team to complete go-live wiring.

---

## 2. What we need from Freedom Warranty

### 2.1 Credentials

| Item | Request |
|------|---------|
| API key or client credentials | Production and/or sandbox key for FWCUT |
| Authentication method | Confirm: Bearer token, `X-API-Key` header, or other |
| Environment base URL | Confirm if production is `https://fwis.freedomwarranty.com` (or a dedicated API host) |
| IP allowlisting | If required, we will provide hosting egress IPs (e.g. Vercel) |
| Sandbox / test claims | 2–3 sample contract + claim number pairs with known data |

### 2.2 Required API capabilities (priority order)

**Priority 1 — Claim intake (blocks replacing screenshots)**

| Capability | Input | Why we need it |
|------------|--------|----------------|
| Get contract / policy by number | Contract or policy number (e.g. `FWVL041518`) | Effective/expiration dates, plan type, vehicle, start mileage |
| Get claim by claim number | Claim number (and contract number if required) | Claimant, loss, repair estimate, shop, status, odometer |
| Combined search (preferred) | `contractNumber` + `claimNumber` | Single call to load full intake package |

**Priority 2 — Decision sync (after underwriting)**

| Capability | Direction | Why we need it |
|------------|-----------|----------------|
| Post underwriting decision | FWCUT → FWIS | Write approve / deny / under review / needs info + reason |
| Optional: attach notes / info checklist | FWCUT → FWIS | When adjuster requests documents from claimant |

**Priority 3 — Operational**

| Capability | Notes |
|------------|--------|
| Health or version endpoint | Connection monitoring (optional but helpful) |
| Error format documentation | How 401 / 403 / 404 / 422 are returned |
| Rate limits | Requests per minute/hour if enforced |

---

## 3. Data fields we consume for claim intake

Please confirm field names (or provide a sample payload).

### 3.1 Contract / policy

| Business field | Example | Required? |
|----------------|---------|-----------|
| Contract / policy number | FWVL041518 | Yes |
| Plan / product name | Freedom Vital | Preferred |
| Contract type / plan code | vital / classic / drive / complete | Preferred |
| Effective date | 2024-01-01 | Yes |
| Expiration date | 2028-01-01 | Yes |
| VIN | 1HGCM… | Yes if on contract |
| Vehicle make / model / year | Honda Accord 2020 | Yes if on contract |
| Odometer at contract start | 40000 | Preferred (waiting-period miles) |
| Contract status | Active | Preferred |

### 3.2 Claim

| Business field | Example | Required? |
|----------------|---------|-----------|
| Claim number / claim ID | CLM-100 or internal UUID | Yes |
| Linked contract number | FWVL041518 | Yes |
| Claim status | Open / Pending | Preferred |
| Claimant full name | Jane Smith | Yes |
| Contact (phone or email) | jane@… | Yes |
| Relationship to vehicle | Owner | Preferred |
| Date of loss | 2025-06-01 | Yes |
| Incident / failure description | Engine noise… | Yes |
| Location of loss | Atlanta, GA | Preferred |
| Current odometer | 45000 | Yes |
| Repair estimate amount | 1500.00 | Yes |
| Repair / component description | Alternator replacement | Yes |
| Repair facility / shop | City Auto | Preferred |

---

## 4. Suggested endpoint shapes (for discussion)

These are **placeholders** our client already supports via configuration. We will adopt your official paths.

```
GET  {base}/api/v1/policies/{policyNumber}
GET  {base}/api/v1/claims/by-number/{claimNumber}
GET  {base}/api/v1/claims?contractNumber={contractNumber}&claimNumber={claimNumber}
POST {base}/api/v1/claims/{claimId}/decisions
GET  {base}/api/health   (optional)
```

Example decision body we can send (flexible to your schema):

```json
{
  "localClaimId": "uuid",
  "fwisClaimId": "…",
  "decision": "approved | denied | under_review | needs_info",
  "reason": "Waiting period not met…",
  "source": "ai | manual",
  "decidedBy": "adjuster@company.com",
  "decidedAt": "2026-07-15T12:00:00Z",
  "riskScore": 3
}
```

---

## 5. Authentication we can support today

| Style | How we send the key |
|-------|---------------------|
| Bearer (default) | `Authorization: Bearer <API_KEY>` |
| API key header | `X-API-Key: <API_KEY>` (header name configurable) |
| Raw Authorization | `Authorization: <API_KEY>` |

Please tell us which style FWIS expects and whether the key is scoped (read-only vs read/write for decisions).

---

## 6. Security & operational notes

- API keys stored only in server environment variables (never in the browser or source control)
- Staff access to FWCUT is authenticated (named users + JWT sessions)
- Public claimants only see a limited status view via tracking code + last name — **not** the FWIS API
- Outbound calls use HTTPS with configurable timeouts
- Decision push to FWIS remains **off** until you confirm the write endpoint (feature flag)

---

## 7. Implementation status on our side

| Component | Status |
|-----------|--------|
| FWIS HTTP client + env configuration | Complete |
| Flexible JSON field mappers | Complete |
| Health / connection test (supervisor UI) | Complete |
| Import UI: contract # + claim # → claim form | Complete |
| Screenshot intake demoted to legacy fallback | Complete |
| Underwriting rules + AI on imported data | Complete |
| Live paths / auth against production FWIS | **Waiting on your API details** |
| Decision write-back enabled | **Waiting on write endpoint confirmation** |

---

## 8. Ask — please provide

1. API base URL (production and sandbox if available)  
2. API key (or OAuth client credentials) and authentication method  
3. Official endpoint list for policy-by-number and claim-by-number (OpenAPI or Postman preferred)  
4. One sample JSON response for a **policy** and one for a **claim** (with field names)  
5. Whether decision write-back is supported; if yes, the request schema  
6. Any rate limits, IP allowlist process, or partner agreement terms  

---

## 9. Contact / next step

Once the items in Section 8 are available, we can complete endpoint configuration, run a supervised connection test, and validate a full intake cycle (import → underwrite → optional decision sync) within a short integration window.

Please reply with technical contact information for FWIS API support and preferred sandbox onboarding process.

---

*Document version 1.0 · FWCUT FWIS Integration Request*  
*Confidential — for Freedom Warranty technical review*
