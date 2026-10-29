# Relay Business Management Portal (BMP) — System Specification

## 1. Product Overview
Relay BMP is an internal operations portal for Relay employees (Account Managers, Finance, Compliance, Sales Operations, Customer Support, and Leadership) to manage B2B customer accounts. Relay provides SMS, RCS, and WhatsApp messaging, CDP / customer data analytics, and developer APIs to Indian businesses.

### Account Hierarchy
- **Organization**: Top-level customer entity (e.g., Zomato, Blinkit, Razorpay).
- **Workspace**: Independent operational unit under an organization (e.g., brand or business unit), each having its own:
  - Users and role-based permissions (Owner, Admin, User).
  - Billing setup: **Prepaid** (wallet balance deducted per message) or **Postpaid** (credit limit + monthly invoices).
  - Indian GSTIN registration for invoicing.
  - Compliance state: MCA KYC, TRAI DLT Sender IDs, and Message Templates.

## 2. Technical Stack
- **Framework**: Next.js 14+ App Router, TypeScript (strict).
- **Database & ORM**: SQLite via `better-sqlite3` (with WAL mode enabled) and `Drizzle ORM`.
- **Database Seeding**: `npm run seed` runs `tsx lib/db/seed.ts` to reset and seed sample accounts.
- **Validation**: Zod for end-to-end type safety and mutation input validation.
- **Forms**: `react-hook-form` with Zod resolvers.
- **Tables**: `@tanstack/react-table` (sortable, filterable, paginated, column visibility).
- **Charts**: Recharts & custom SVG Sparklines.
- **AI Integration**: Google Gemini via `@google/genai` (configured via `GEMINI_API_KEY` and `GEMINI_MODEL`, defaulting to `gemini-2.5-flash`).
- **Icons**: Lucide React.
- **Styling**: Tailwind CSS with custom design tokens.

## 3. Design System & Design Tokens
Dark mode only, minimalist, dense but calm, adhering to Linear and Vercel dashboard aesthetics.

| Token | CSS Variable | Hex / Value | Description |
|---|---|---|---|
| Background | `--background` | `#0A0A0B` | Deep neutral background |
| Surface | `--surface` | `#111113` | Primary card / container surface |
| Surface 2 | `--surface-2` | `#17171A` | Secondary surface / subtle inputs |
| Surface Hover | `--surface-hover` | `#1E1E22` | Hover state background |
| Border | `--border` | `#232328` | 1px border lines (no heavy drop shadows) |
| Text | `--text` | `#EDEDEF` | High-contrast body and heading text |
| Text Muted | `--text-muted` | `#8B8B93` | Secondary labels and helper text |
| Accent | `--accent` | `#7C7CFF` | Soft indigo used sparingly |
| Success | `--success` | `#3FB68B` | Positive states, active badges, healthy metrics |
| Warning | `--warning` | `#E0A93B` | Approvals pending, credit near limit |
| Danger | `--danger` | `#E5534B` | Overdue invoices, suspended accounts |
| Info | `--info` | `#5B9DFF` | Informational callouts |

### Visual Principles
- **No Large Color Fills**: Status colors (`success`, `warning`, `danger`, `info`) are strictly used as small indicator dots or subtle badges, never large background blocks.
- **Fonts**: Inter for UI text; JetBrains Mono for IDs, amounts, dates, and code. Tabular figures (`tabular-nums`) for all numbers, monetary amounts, and counters.
- **Borders**: 1px borders everywhere instead of drop shadows.
- **Corner Radius**: 8px standard radius (`rounded-lg`).
- **Typography Density**: 13px base font for data tables, dense table rows, generous spacing in page margins.
- **Localization**:
  - Currency: Indian Rupee (INR) with Indian grouping (`₹12,50,000` via `Intl.NumberFormat('en-IN')`) and compact representations (`₹12.5L`, `₹1.2Cr`).
  - Timezone: Indian Standard Time (IST, UTC+5:30) with format `12 Mar 2026` or `12 Mar 2026, 04:30 PM`.

## 4. Engineering Architecture & Folder Structure
```
/
├── app/                      # Next.js App Router (pages, layout, globals.css)
├── components/
│   ├── layout/               # AppShell, Sidebar, TopBar, RoleContext, CommandPalette
│   ├── ui/                   # Reusable components: PageHeader, DataTable, StatusBadge,
│   │                         # MoneyText, StatCard, Sparkline, ConfirmDialog, ReasonDialog,
│   │                         # EmptyState, Timeline, KeyValueList, Toaster
│   └── dashboard/            # Dashboard Client Views
├── lib/
│   ├── ai/                   # Gemini client initialization (@google/genai)
│   ├── db/                   # Drizzle schema, better-sqlite3 client, seed script
│   ├── permissions/          # Role definitions (AM, Finance, Compliance, etc.) and permission matrix
│   ├── services/             # Service layer: accounts, kyc, plans, credit, billing, approvals, audit, ai
│   └── utils.ts              # Currency formatting (INR), IST date formatting, cn()
├── docs/
│   └── SPEC.md               # Architecture and design specifications
└── README.md                 # Setup and run instructions
```

## 5. Reusable Component Standards
1. **PageHeader**: Standardized header with breadcrumbs, title, status pill, and action buttons.
2. **DataTable**: TanStack Table implementation with global search, column visibility toggle, sorting, and pagination.
3. **StatusBadge**: Minimalist badge featuring a small colored dot and surface background.
4. **MoneyText**: Tabular number display in Indian numbering format (`₹12,50,000` / `₹12.5L`).
5. **StatCard**: KPI metric tile with title, value, percentage delta, and micro-sparkline.
6. **Sparkline**: SVG trend line without axis clutter.
7. **ConfirmDialog**: Accessible modal required for destructive or financial operations.
8. **ReasonDialog**: Modal enforcing a minimum character justification for audit-logged actions.
9. **EmptyState**: Standardized icon, heading, and action for zero-data views.
10. **Timeline**: Vertical event trace displaying IST timestamps, actor names, and roles.
11. **KeyValueList**: 1-column or 2-column key-value summary list for metadata.
12. **Toast**: Sonner-based notification toasts styled to match the dark mode palette.

## 6. Audit & Dual-Approval Rules
- Every state mutation requires an audit entry recording: `entityType`, `entityId`, `action`, `actorName`, `actorRole`, `reason`, and timestamp in IST.
- High-risk operations (e.g. credit limit increases above threshold, account suspensions/reactivations, KYC approvals) require secondary approval via the Approvals queue.


## 7. AI and Data Handling Architecture

### 7.1 Data Minimization Principles
- **No PII Shared**: The AI subsystem enforces strict data minimization. Full customer emails, phone numbers, individual user names, and banking credentials are never passed to the LLM inference prompt.
- **Sanitized Facts**: Only synthetic identifiers, sanitized business entity legal names, GSTIN registrations, and aggregated mathematical metrics (such as 30-day message totals, channel volumes, and delivery ratios) are provided to the model.
- **Data Minimization Audits**: Every AI prompt payload is hashed using SHA-256 and stored in the `ai_runs.input_hash` column for auditing and compliance verification.

### 7.2 Maker-Checker Boundary
- **AI Never Mutates State**: GenAI models produce recommendations, structured queries, drafts, or extracted slot previews. No model output ever directly writes or updates database records.
- **Human In The Loop**: A qualified human reviewer must review, edit, or approve recommendations through the standard `requestChange` or approval policy pipeline.
- **Auditing**: Every mutation initiated from an AI suggestion is permanently logged with `ai_assisted: true` and an explicit list of overridden or verified fields in the cryptographically chained `audit_log`.

### 7.3 Graceful Degradation & Amber Fallbacks
- **Zero Page Breakages**: In the event that `GEMINI_API_KEY` is not set or network timeouts (>20s) occur, the application seamlessly switches to deterministic rule-based calculation engines.
- **Amber Warning Banners**: The UI visibly displays an amber indicator (*"AI unavailable, showing rule-based result"*) and continues full operational workflows without interruption.
