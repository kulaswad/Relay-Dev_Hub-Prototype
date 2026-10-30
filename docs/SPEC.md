# Relay Developer Hub — System Specification

## 1. Product Overview & Purpose
**Relay Developer Hub** is the customer-facing developer portal for Relay, an Indian B2B SaaS platform that enables businesses (banks, insurers, D2C brands, edtech) to:
1. **Send omnichannel messages** over SMS, RCS, and WhatsApp with automated TRAI DLT template validation.
2. **Ingest web, mobile, and CRM behavioral events** into a unified Customer Data Platform (CDP) identity graph.
3. **Query unified customer profiles** and trigger context-aware communication flows.

### Core Product Goal
> **A developer goes from sign-up to their first successful API call in UNDER 15 MINUTES.**

### Two Distinct Personas
- **The Evaluating Engineer (Prospect)**: Needs immediate access to an interactive sandbox without business friction (no waiting for MCA KYC, PAN verification, or TRAI DLT header approvals). Uses `rk_test_...` sandbox keys with simulated carrier delivery receipts and simulated webhooks.
- **The Production Developer (Active Customer)**: Needs rock-solid credentials management, scoped keys (`rk_live_...`), TRAI DLT template validation, webhook retries with HMAC SHA-256 verification, and visibility into quota limits and costs.

---

## 2. Technical Stack
- **Framework**: Next.js 14+ App Router, TypeScript (strict mode enabled).
- **Styling**: Tailwind CSS with custom design tokens, dark mode only.
- **Components**: Reusable developer experience library (`CodeBlock`, `EndpointHeader`, `ParamTable`, `ResponseTabs`, `StatusPill`, `CopyField`, `EmptyState`, `Callout`, `Stepper`, `Timeline`, `JsonViewer`, `DiffBadge`).
- **Icons**: Lucide React.
- **Database & ORM**: SQLite via `better-sqlite3` with WAL mode + Drizzle ORM (`npm run seed` and `npm run seed:reset`).
- **Validation**: Zod for all request schemas and database boundary validations.
- **Syntax Highlighting**: Shiki for accurate dark-theme code blocks with persistent multi-language tabs.
- **Port**: `3001` (configured in `package.json` dev and start scripts).
- **AI Integration**: Google Gemini via `@google/genai` (configured via `GEMINI_API_KEY` and `GEMINI_MODEL`, default `gemini-2.5-flash`).

---

## 3. Design Tokens & Visual Principles
Dark mode only, minimalist, dense and crisp, inspired by Stripe Docs, Linear, and Vercel.

| Token | CSS Variable | Hex Value | Semantic Role |
|---|---|---|---|
| Background | `--background` | `#09090B` | Deepest dark root background |
| Surface | `--surface` | `#0F0F12` | Primary container & card surface |
| Surface-2 | `--surface-2` | `#16161A` | Secondary surface, inputs, tab highlights |
| Border | `--border` | `#222228` | 1px clean crisp hairline borders |
| Text | `--text` | `#ECECEF` | High-contrast readable body & headings |
| Text Muted | `--text-muted` | `#8A8A94` | Helper text, secondary labels, metadata |
| Accent | `--accent` | `#7C7CFF` | Electric indigo for focus & primary CTAs |
| Success | `--success` | `#3FB68B` | Positive states, active badges, live dot |
| Warning | `--warning` | `#E0A93B` | Test sandbox indicator, KYC alerts |
| Danger | `--danger` | `#E5534B` | Errors, delivery failures, revoked keys |
| Info | `--info` | `#5B9DFF` | Informational callouts & tooltips |

### Typography & Badges
- **UI Font**: `Inter` for all UI controls, labels, and documentation prose.
- **Code Font**: `JetBrains Mono` for code snippets, endpoints, HTTP methods, IDs, and secrets.
- **HTTP Method Badges**:
  - `GET`: Green (`#3FB68B` / `bg-[#3FB68B]/15`)
  - `POST`: Accent Indigo (`#7C7CFF` / `bg-[#7C7CFF]/15`)
  - `PUT` / `PATCH`: Amber (`#E0A93B` / `bg-[#E0A93B]/15`)
  - `DELETE`: Red (`#E5534B` / `bg-[#E5534B]/15`)
- **Environment Switcher**: Persistent pill in top bar with amber dot for **Test Sandbox** (`rk_test_...`) and green pulsing dot for **Live Production** (`rk_live_...`).
- **Version Selector**: Fixed version selector (default `v2025-10-01`) reflecting active schema.
- **Command Palette**: `Cmd+K` or `Ctrl+K` searchable modal for docs, endpoints, error codes, and navigation.

---

## 4. Architecture & Folder Structure
```
├── app/
│   ├── (marketing)/         # Public marketing & informational pages
│   │   ├── page.tsx         # Styled DevHub home page placeholder
│   │   ├── changelog/       # Versioned changelog & deprecation notices
│   │   ├── status/          # Real-time carrier & API gateway uptime
│   │   ├── support/         # Self-serve diagnostic tools & support path
│   │   └── layout.tsx       # Marketing layout with PublicNavbar & Footer
│   ├── docs/                # Comprehensive documentation
│   │   ├── quickstart/      # 15-Minute interactive quickstart guide
│   │   ├── authentication/  # API key management & scopes
│   │   ├── compliance-guide/# TRAI DLT registration & Indian KYC guide
│   │   ├── endpoints/       # REST API endpoint reference
│   │   │   ├── messages-send/
│   │   │   ├── messages-status/
│   │   │   ├── events-ingest/
│   │   │   ├── customer-profile/
│   │   │   └── channels/
│   │   ├── webhooks/        # HMAC verification & retry mechanics
│   │   ├── errors/          # Standardized error codes catalogue
│   │   ├── limits/          # Rate limits, quotas & HTTP headers
│   │   ├── sdks/            # Official SDKs (Node, Python, Go)
│   │   └── layout.tsx       # Docs layout with DocsSidebar
│   ├── console/             # Customer-facing developer console
│   │   ├── page.tsx         # Console Overview & quickstart status
│   │   ├── api-keys/        # Key creation, scoping, rotation, revocation
│   │   ├── webhooks/        # Webhook registration, logs, replay tool
│   │   ├── events/          # Real-time event log & payload inspector
│   │   ├── usage/           # TPS metrics, daily breakdown, wallet balance
│   │   ├── playground/      # Interactive API request runner
│   │   ├── settings/        # GSTIN, MCA KYC & DLT headers
│   │   └── layout.tsx       # Console layout with ConsoleSidebar & Header
│   └── api/v1/              # Real working Sandbox API routes
├── components/
│   ├── devhub/              # Reusable DevHub component library
│   │   ├── CodeBlock.tsx    # Multi-language synchronized tabs & copy
│   │   ├── EndpointHeader.tsx
│   │   ├── ParamTable.tsx
│   │   ├── ResponseTabs.tsx
│   │   ├── StatusPill.tsx
│   │   ├── CopyField.tsx    # Masked secret field with reveal toggle
│   │   ├── EmptyState.tsx
│   │   ├── Callout.tsx
│   │   ├── Stepper.tsx      # Onboarding guide stepper
│   │   ├── Timeline.tsx     # Message lifecycle & retry timeline
│   │   ├── JsonViewer.tsx   # Collapsible payload tree inspector
│   │   ├── DiffBadge.tsx
│   │   ├── EnvironmentSwitcher.tsx
│   │   ├── VersionSelector.tsx
│   │   ├── PublicNavbar.tsx
│   │   ├── DocsSidebar.tsx
│   │   ├── ConsoleSidebar.tsx
│   │   ├── ConsoleHeader.tsx
│   │   └── CommandPalette.tsx
│   └── providers/
│       └── DevHubContext.tsx # Context for environment, language & modal state
├── lib/
│   ├── db/
│   │   ├── schema.ts        # Drizzle SQLite schema
│   │   ├── index.ts         # DB client
│   │   └── seed.ts          # Migration & seed script
│   ├── sandbox/             # Telecom sandbox simulator & response generator
│   ├── webhooks/            # Webhook signature computation & replay logic
│   ├── docs/                # Typed documentation content modules
│   └── ai/                  # Gemini AI client & troubleshooting assistant
└── docs/
    └── SPEC.md              # This specification document
```

---

## 5. Data Model & Database Schema

### 1. `workspaces`
Represents an operating business unit with its own GSTIN, billing model (prepaid/postpaid), wallet, and compliance status.
- `id`: Text PK (e.g. `ws_meridian_retail`)
- `org_id`: References `organizations.id`
- `status`: `'kyc_pending' | 'kyc_in_review' | 'active' | 'suspended'`
- `gstin`: 15-character Indian State GST format
- `wallet_balance`: Real (INR prepaid balance)
- `credit_limit`: Real (INR postpaid credit line)
- `credit_used`: Real (INR accrued usage)

### 2. `api_keys`
API credentials created by developers for authentication.
- `id`: Text PK (e.g. `key_test_01JB...`)
- `workspace_id`: References `workspaces.id`
- `name`: Text label (e.g. "Primary Backend Key")
- `environment`: `'test' | 'live'`
- `prefix`: Text (`rk_test_` or `rk_live_`)
- `key_hash`: SHA-256 hash for secure server-side lookup
- `secret_masked`: Text (e.g. `rk_test_••••••••9a2f`)
- `full_key_for_dev`: Revealed in developer console
- `scopes`: JSON array of allowed permissions (`messages:send`, `events:write`, `profiles:read`)
- `status`: `'active' | 'revoked' | 'expired'`
- `last_used_at`, `expires_at`, `created_at`

### 3. `messages`
Log of API messages dispatched.
- `id`: Text PK (`msg_01JB...`)
- `workspace_id`: References `workspaces.id`
- `environment`: `'test' | 'live'`
- `channel`: `'sms' | 'rcs' | 'whatsapp'`
- `recipient`: E.164 phone number (`+919876543210`)
- `sender_id`: 6-character TRAI DLT header (`RELAYI`)
- `template_id`: DLT registered template (`dlt_tmpl_otp_login`)
- `body`: Text
- `status`: `'queued' | 'sent' | 'delivered' | 'failed'`
- `failure_reason`: Text (if status is failed)
- `cost`: Real (in INR)
- `metadata`: JSON string
- `created_at`, `delivered_at`

### 4. `customer_profiles` (CDP)
Unified identity records for end-customers.
- `id`: Text PK (`prf_...`)
- `workspace_id`: References `workspaces.id`
- `environment`: `'test' | 'live'`
- `external_id`: Unique customer ID from client's CRM/App
- `phone`: Mobile number
- `email`: Customer email
- `name`: Full name
- `traits`: JSON object of computed attributes (LTV, city, VIP flag)
- `first_seen_at`, `last_seen_at`

### 5. `events_log`
Chronological stream of ingested user actions.
- `id`: Text PK (`evt_...`)
- `workspace_id`: References `workspaces.id`
- `profile_id`: References `customer_profiles.id`
- `environment`: `'test' | 'live'`
- `event_name`: Action identifier (e.g. `order_placed`)
- `properties`: JSON payload
- `source`: `'api' | 'webhook' | 'sdk'`
- `timestamp`: Integer (epoch)

### 6. `webhook_endpoints`
Customer registered webhook receivers.
- `id`: Text PK (`wh_...`)
- `workspace_id`: References `workspaces.id`
- `environment`: `'test' | 'live'`
- `url`: Destination HTTPS endpoint
- `secret`: Signing secret (`whsec_...`)
- `events_subscribed`: JSON array (e.g. `["message.delivered", "message.failed"]`)
- `status`: `'active' | 'disabled' | 'failing'`
- `failure_count`: Integer

### 7. `webhook_deliveries`
History of webhook attempts with replay capability.
- `id`: Text PK (`del_...`)
- `endpoint_id`: References `webhook_endpoints.id`
- `workspace_id`: References `workspaces.id`
- `event_type`: Event name
- `payload`: JSON
- `status`: `'success' | 'failed' | 'retrying'`
- `status_code`: HTTP status returned
- `latency_ms`: Response time
- `attempt_count`: Delivery attempts
- `created_at`: Timestamp

---

## 6. Indian Regulatory Compliance Architecture
1. **TRAI TCCCPR Regulations**:
   - All commercial and transactional SMS sent to Indian recipients must carry an approved 6-character alphabetic Header (e.g. `RELAYI`) registered on a telecom DLT platform (Jio, Airtel, Vilpower).
   - Message text must match an approved Content Template with placeholders `{#var#}`.
2. **Ministry of Corporate Affairs (MCA) KYC**:
   - Businesses must submit Certificate of Incorporation (MCA) and valid GSTIN.
   - **Sandbox Isolation**: In the `test` sandbox environment, KYC is bypassed so evaluating engineers can test immediately. In `live`, requests without approved KYC return `403 ERR_KYC_REQUIRED`.

---

## 7. Webhook Security & Signatures
Every webhook request sent by Relay includes:
- `X-Relay-Signature`: `t=TIMESTAMP,v1=HMAC_SHA256_HEX`
- Computed as `HMAC_SHA256(secret, "${timestamp}.${payload}")`.
- Mitigates replay attacks by validating timestamp drift within 5 minutes.
