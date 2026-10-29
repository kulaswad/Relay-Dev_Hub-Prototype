# Relay Business Management Portal (BMP)

Internal operations portal for Relay employees to manage B2B customer accounts, workspaces, prepaid wallets, postpaid credit limits, KYC, TRAI DLT sender IDs, and compliance approvals.

## Tech Stack
- **Framework**: Next.js 14+ (App Router, Strict TypeScript)
- **Database**: SQLite via `better-sqlite3` with Drizzle ORM
- **Styling**: Tailwind CSS & custom design tokens (Dark mode only, Linear / Vercel density)
- **Tables**: `@tanstack/react-table`
- **Charts**: Recharts & micro-SVG Sparklines
- **AI**: Google Gemini via `@google/genai` (configurable model, default `gemini-2.5-flash`)
- **Port**: 3000

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Or in Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

Ensure your `.env` contains:
```env
DATABASE_URL=relay.db
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
NODE_ENV=development
```

### 3. Reset and Seed Database
Run the seed script to reset and populate the database with realistic sample organizations, workspaces, invoices, approvals, and audit logs:
```bash
npm run seed
```

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the portal.

---

## Design System Guidelines
- **Palette**: Background `#0A0A0B`, Surface `#111113`, Surface-2 `#17171A`, Border `#232328`, Text `#EDEDEF`, Accent `#7C7CFF`.
- **Status Indicators**: Status colors (`#3FB68B` success, `#E0A93B` warning, `#E5534B` danger) are strictly used as small dots/badges, never large fills.
- **Numbers & Money**: Tabular numbers (`tabular-nums font-mono`) formatted in INR with Indian grouping (`₹12,50,000` or `₹12.5L`).
- **Dates**: Indian Standard Time (IST, UTC+5:30) in format `12 Mar 2026`.

For full engineering rules and specifications, see [`docs/SPEC.md`](docs/SPEC.md).
