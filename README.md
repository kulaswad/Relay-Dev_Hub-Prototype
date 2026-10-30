# Relay Developer Hub

**Customer-Facing Developer Portal & Sandbox for Relay** — India's enterprise communication and customer data platform.

Relay lets businesses send SMS, RCS, and WhatsApp messages, ingest web/app/CRM events into a unified customer profile (CDP), and query profiles via APIs. This developer hub enables customer engineers to go **from sign-up to their first successful API call in under 15 minutes**.

---

## Tech Stack
- **Framework**: Next.js 14+ (App Router, Strict TypeScript)
- **Database**: SQLite via `better-sqlite3` (WAL mode enabled) + Drizzle ORM
- **Syntax Highlighting**: Shiki
- **Tables & Charts**: `@tanstack/react-table`, Recharts
- **Validation**: Zod
- **AI Telemetry**: Google Gemini via `@google/genai` (default `gemini-2.5-flash`)
- **Port**: `3001`

---

## Design System & Tokens
Dark mode only, minimalist, dense and crisp, inspired by Stripe Docs, Linear, and Vercel.

| Token | Hex Value | Description |
|---|---|---|
| Background | `#09090B` | Deepest root background |
| Surface | `#0F0F12` | Primary container surface |
| Surface-2 | `#16161A` | Secondary surface / inputs |
| Border | `#222228` | Hairline border |
| Text | `#ECECEF` | Primary body and heading text |
| Text Muted | `#8A8A94` | Secondary text and labels |
| Accent | `#7C7CFF` | Electric indigo |
| Success | `#3FB68B` | Positive states & Live dot |
| Warning | `#E0A93B` | Test Sandbox dot & alerts |
| Danger | `#E5534B` | Errors & failed deliveries |
| Info | `#5B9DFF` | Info callouts |

- **Fonts**: `Inter` for UI, `JetBrains Mono` for code, IDs, endpoints, and keys.
- **HTTP Badges**: GET (`#3FB68B`), POST (`#7C7CFF`), PUT/PATCH (`#E0A93B`), DELETE (`#E5534B`).

---

## Key Features & Layouts

### 1. Global Navigation & Tooling
- **Persistent Environment Switcher**: Toggle between **Test Sandbox** (amber dot, `rk_test_...`) and **Live Production** (green dot, `rk_live_...`).
- **Fixed Version Selector**: Top bar version dropdown (`v2025-10-01`).
- **Command Palette (`Cmd+K` / `Ctrl+K`)**: Instant search across docs, endpoints, error codes, and console pages.
- **Synchronized Code Blocks**: Language switcher (cURL, Node.js, Python, Go) remembers preference across the entire hub via `localStorage`.

### 2. Layout Shells
- **Public & Marketing Shell (`/app/(marketing)`)**: Home page showcase, Changelog (`/changelog`), Status (`/status`), Support (`/support`).
- **Documentation Shell (`/app/docs`)**: Getting Started, 15-Minute Quickstart, Authentication, Messaging APIs (SMS, RCS, WhatsApp), CDP Event Ingestion, Webhooks, Error Catalogue, Rate Limits, and SDKs.
- **Console Shell (`/app/console`)**: Left sidebar with Overview, API Keys, Webhooks & Replay, Event Logs, Usage & Quotas, Playground, and Settings.

### 3. Reusable Component Library
Located in `@/components/devhub`:
- `CodeBlock`: Language tabs, localStorage memory, copy button, line highlighting.
- `EndpointHeader`: HTTP method badge, path, description, auth badge.
- `ParamTable`: Field name, type, required/optional badge, nested schemas.
- `ResponseTabs`: Status code tabs (200, 400, 403, 422) with JSON payloads.
- `StatusPill`: Test/Live environment pills and status badges.
- `CopyField`: Masked secrets with reveal toggle and clipboard copy.
- `EmptyState`: Clean empty states with icon and action button.
- `Callout`: Note, warn, deprecated, and info callouts.
- `Stepper`: Interactive numbered walkthrough stepper.
- `Timeline`: Message delivery and retry timeline.
- `JsonViewer`: Collapsible tree inspector for payloads.
- `DiffBadge`: Added, changed, removed, deprecated, and security badges.

---

## Setup & Running Locally

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Ensure `.env` contains:
```env
DATABASE_URL=relay.db
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
PORT=3001
NODE_ENV=development
```

### 3. Reset and Seed Database
```bash
npm run seed
# or to force reset:
npm run seed:reset
```

### 4. Start Development Server (Port 3001)
```bash
npm run dev
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## Regulatory Compliance Notes
- **TRAI DLT**: Under Indian telecom regulations, commercial SMS requires an approved 6-character header (`RELAYI`) and registered templates (`{#var#}`).
- **Sandbox Bypasses KYC**: To ensure developer speed, evaluating engineers can test immediately using `rk_test_...` sandbox keys without completing MCA or GSTIN verification.
- **Live KYC Gate**: Live message dispatching (`rk_live_...`) is gated on MCA incorporation approval and TRAI DLT verification.
