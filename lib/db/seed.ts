import Database from "better-sqlite3";
import path from "path";
import { createHash } from "crypto";

const dbPath = process.env.DATABASE_URL
  ? path.resolve(process.cwd(), process.env.DATABASE_URL)
  : path.resolve(process.cwd(), "relay.db");

const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = OFF");

console.log("🌱 Starting Relay BMP database migration & rich seed...");
console.log("📍 Target SQLite database:", dbPath);

// ---------------------------------------------------------------------------
// 1. Drop existing tables
// ---------------------------------------------------------------------------
const tablesToDrop = [
  "approval_policies",
  "tasks",
  "alerts",
  "ai_runs",
  "audit_log",
  "change_requests",
  "templates",
  "sender_ids",
  "kyc_cases",
  "tickets",
  "credit_history",
  "invoices",
  "wallet_transactions",
  "usage_daily",
  "workspace_addons",
  "addon_catalog",
  "subscriptions",
  "workspace_users",
  "workspaces",
  "organizations",
  "plans",
  "internal_users",
  // Old legacy table names
  "audit_logs",
  "approvals",
  "billing_invoices",
  "credit_transactions",
  "message_templates",
  "kyc_records",
];

for (const t of tablesToDrop) {
  sqlite.exec(`DROP TABLE IF EXISTS ${t};`);
}

// ---------------------------------------------------------------------------
// 2. Create Schema with Indexes
// ---------------------------------------------------------------------------
sqlite.exec(`
  CREATE TABLE internal_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#7C7CFF',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    billing_model TEXT NOT NULL DEFAULT 'both',
    base_fee_monthly REAL NOT NULL DEFAULT 0,
    included_seats INTEGER NOT NULL DEFAULT 3,
    per_message_rates TEXT NOT NULL,
    throughput_mps INTEGER NOT NULL DEFAULT 50,
    features TEXT NOT NULL,
    price_floors TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    industry TEXT NOT NULL,
    city TEXT NOT NULL,
    owner_am_id TEXT NOT NULL REFERENCES internal_users(id),
    status TEXT NOT NULL DEFAULT 'active',
    billing_model TEXT NOT NULL DEFAULT 'prepaid',
    plan_id TEXT NOT NULL REFERENCES plans(id),
    contract_start INTEGER,
    contract_end INTEGER,
    tags TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX org_status_idx ON organizations(status);
  CREATE INDEX org_owner_am_idx ON organizations(owner_am_id);
  CREATE INDEX org_billing_model_idx ON organizations(billing_model);

  CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    gstin TEXT NOT NULL,
    billing_state TEXT NOT NULL,
    wallet_balance REAL NOT NULL DEFAULT 0,
    credit_limit REAL NOT NULL DEFAULT 0,
    credit_used REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX ws_org_id_idx ON workspaces(org_id);
  CREATE INDEX ws_status_idx ON workspaces(status);

  CREATE TABLE workspace_users (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'user',
    custom_role_name TEXT,
    last_login_at INTEGER,
    seat_active INTEGER NOT NULL DEFAULT 1,
    is_seat_paid INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX wu_workspace_id_idx ON workspace_users(workspace_id);

  CREATE TABLE subscriptions (
    workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    custom_price_overrides TEXT,
    discount_pct REAL NOT NULL DEFAULT 0,
    discount_reason TEXT,
    discount_end_date INTEGER,
    effective_from INTEGER NOT NULL
  );

  CREATE TABLE addon_catalog (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    price REAL NOT NULL
  );

  CREATE TABLE workspace_addons (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    addon_id TEXT NOT NULL REFERENCES addon_catalog(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    start_date INTEGER NOT NULL,
    end_date INTEGER
  );
  CREATE INDEX ws_addons_ws_idx ON workspace_addons(workspace_id);

  CREATE TABLE usage_daily (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    sms_count INTEGER NOT NULL DEFAULT 0,
    rcs_count INTEGER NOT NULL DEFAULT 0,
    whatsapp_count INTEGER NOT NULL DEFAULT 0,
    delivered_pct REAL NOT NULL DEFAULT 98.5,
    cost REAL NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX ud_ws_date_unique_idx ON usage_daily(workspace_id, date);
  CREATE INDEX ud_date_idx ON usage_daily(date);

  CREATE TABLE wallet_transactions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance_after REAL NOT NULL,
    reference TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX wt_workspace_id_idx ON wallet_transactions(workspace_id);

  CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    amount REAL NOT NULL,
    gst_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'issued',
    issued_at INTEGER NOT NULL,
    due_at INTEGER NOT NULL,
    paid_at INTEGER,
    line_items TEXT NOT NULL
  );
  CREATE INDEX inv_workspace_id_idx ON invoices(workspace_id);
  CREATE INDEX inv_status_idx ON invoices(status);

  CREATE TABLE credit_history (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    old_limit REAL NOT NULL,
    new_limit REAL NOT NULL,
    reason TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    approved_by TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX ch_workspace_id_idx ON credit_history(workspace_id);

  CREATE TABLE tickets (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    category TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    resolved_at INTEGER
  );
  CREATE INDEX tkt_org_id_idx ON tickets(org_id);
  CREATE INDEX tkt_status_idx ON tickets(status);

  CREATE TABLE kyc_cases (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'submitted',
    submitted_at INTEGER,
    assigned_to TEXT REFERENCES internal_users(id),
    documents TEXT,
    declared_data TEXT,
    sla_due_at INTEGER,
    notes TEXT
  );
  CREATE INDEX kyc_workspace_id_idx ON kyc_cases(workspace_id);
  CREATE INDEX kyc_status_idx ON kyc_cases(status);

  CREATE TABLE sender_ids (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    header TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    submitted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    approved_at INTEGER,
    rejection_reason TEXT
  );
  CREATE INDEX sid_workspace_id_idx ON sender_ids(workspace_id);
  CREATE INDEX sid_status_idx ON sender_ids(status);

  CREATE TABLE templates (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    body TEXT NOT NULL,
    dlt_template_id TEXT,
    status TEXT NOT NULL DEFAULT 'submitted',
    submitted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX tmpl_workspace_id_idx ON templates(workspace_id);

  CREATE TABLE change_requests (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by TEXT NOT NULL REFERENCES internal_users(id),
    approver_role_needed TEXT NOT NULL,
    approved_by TEXT REFERENCES internal_users(id),
    reason TEXT NOT NULL,
    decision_note TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    decided_at INTEGER,
    expires_at INTEGER
  );
  CREATE INDEX cr_status_idx ON change_requests(status);
  CREATE INDEX cr_target_idx ON change_requests(target_type, target_id);

  CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    org_id TEXT,
    before TEXT,
    after TEXT,
    reason TEXT NOT NULL,
    change_request_id TEXT REFERENCES change_requests(id),
    ai_assisted INTEGER NOT NULL DEFAULT 0,
    ip TEXT NOT NULL DEFAULT '10.14.0.24',
    prev_hash TEXT,
    hash TEXT,
    is_denied INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX al_timestamp_idx ON audit_log(timestamp);
  CREATE INDEX al_target_idx ON audit_log(target_type, target_id);
  CREATE INDEX al_org_id_idx ON audit_log(org_id);

  CREATE TABLE ai_runs (
    id TEXT PRIMARY KEY,
    feature TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES internal_users(id),
    input_hash TEXT NOT NULL,
    output TEXT NOT NULL,
    model TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    accepted INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX air_feature_idx ON ai_runs(feature);
  CREATE INDEX air_user_idx ON ai_runs(user_id);

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    assigned_to TEXT NOT NULL REFERENCES internal_users(id),
    title TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'pending',
    due_at INTEGER
  );
  CREATE INDEX tsk_org_id_idx ON tasks(org_id);
  CREATE INDEX tsk_assigned_to_idx ON tasks(assigned_to);
  CREATE INDEX tsk_status_idx ON tasks(status);

  CREATE TABLE approval_policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    action_type TEXT NOT NULL,
    threshold_type TEXT NOT NULL,
    threshold_value REAL,
    approver_role TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX IF NOT EXISTS alerts_ws_idx ON alerts(workspace_id);
  CREATE INDEX IF NOT EXISTS alerts_type_idx ON alerts(type);
  CREATE INDEX IF NOT EXISTS alerts_created_idx ON alerts(created_at);
`);

sqlite.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// 3. Seeded Deterministic PRNG (Mulberry32)
// ---------------------------------------------------------------------------
function createRNG(seed = 133742) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRNG(421337);
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function randomFloat(min: number, max: number, decimals = 2): number {
  const val = rng() * (max - min) + min;
  return Number(val.toFixed(decimals));
}

// ---------------------------------------------------------------------------
// 4. Seed Internal Users (at least 2 per role)
// ---------------------------------------------------------------------------
const internalUsersList = [
  // Account Managers
  { id: "usr_am_priya", name: "Priya Sharma", email: "priya.sharma@relay.in", role: "account_manager", avatarColor: "#7C7CFF" },
  { id: "usr_am_rohan", name: "Rohan Verma", email: "rohan.verma@relay.in", role: "account_manager", avatarColor: "#5B9DFF" },
  { id: "usr_am_ananya", name: "Ananya Iyer", email: "ananya.iyer@relay.in", role: "account_manager", avatarColor: "#3FB68B" },
  // Finance
  { id: "usr_fin_vikram", name: "Vikram Mehta", email: "vikram.mehta@relay.in", role: "finance", avatarColor: "#E0A93B" },
  { id: "usr_fin_sneha", name: "Sneha Kulkarni", email: "sneha.kulkarni@relay.in", role: "finance", avatarColor: "#E5534B" },
  // Finance Head
  { id: "usr_fin_rajesh", name: "Rajesh Nair", email: "rajesh.nair@relay.in", role: "finance_head", avatarColor: "#D97706" },
  { id: "usr_fin_sunita", name: "Sunita Rao", email: "sunita.rao@relay.in", role: "finance_head", avatarColor: "#B45309" },
  // Compliance
  { id: "usr_comp_kavita", name: "Kavita Nair", email: "kavita.nair@relay.in", role: "compliance", avatarColor: "#10B981" },
  { id: "usr_comp_suresh", name: "Suresh Menon", email: "suresh.menon@relay.in", role: "compliance", avatarColor: "#059669" },
  // Sales Ops
  { id: "usr_ops_amit", name: "Amit Bansal", email: "amit.bansal@relay.in", role: "sales_ops", avatarColor: "#8B5CF6" },
  { id: "usr_ops_divya", name: "Divya Nair", email: "divya.nair@relay.in", role: "sales_ops", avatarColor: "#6366F1" },
  // Customer Support
  { id: "usr_sup_rahul", name: "Rahul Sen", email: "rahul.sen@relay.in", role: "support", avatarColor: "#EC4899" },
  { id: "usr_sup_pooja", name: "Pooja Patel", email: "pooja.patel@relay.in", role: "support", avatarColor: "#F43F5E" },
  // Admin
  { id: "usr_adm_kabir", name: "Kabir Anand", email: "kabir.anand@relay.in", role: "admin", avatarColor: "#7C7CFF" },
  { id: "usr_adm_meera", name: "Meera Joshi", email: "meera.joshi@relay.in", role: "admin", avatarColor: "#9333EA" },
];

const insertUser = sqlite.prepare(`
  INSERT INTO internal_users (id, name, email, role, avatar_color)
  VALUES (?, ?, ?, ?, ?)
`);
for (const u of internalUsersList) {
  insertUser.run(u.id, u.name, u.email, u.role, u.avatarColor);
}

// ---------------------------------------------------------------------------
// 5. Seed Pricing Plans
// ---------------------------------------------------------------------------
const plansList = [
  {
    id: "plan_starter",
    name: "Starter",
    billingModel: "prepaid",
    baseFeeMonthly: 5000,
    includedSeats: 3,
    perMessageRates: JSON.stringify({ sms: 0.18, rcs: 0.28, whatsapp: 0.45 }),
    throughputMps: 30,
    features: JSON.stringify(["Prepaid only", "Single Workspace", "Standard SMS & WhatsApp API", "Community Support"]),
    priceFloors: JSON.stringify({ sms: 0.15, rcs: 0.24, whatsapp: 0.38 }),
  },
  {
    id: "plan_growth",
    name: "Growth",
    billingModel: "both",
    baseFeeMonthly: 25000,
    includedSeats: 8,
    perMessageRates: JSON.stringify({ sms: 0.14, rcs: 0.22, whatsapp: 0.38 }),
    throughputMps: 100,
    features: JSON.stringify(["Prepaid or Postpaid", "Up to 5 Workspaces", "DLT Header Support", "Webhooks & Retry Logs"]),
    priceFloors: JSON.stringify({ sms: 0.11, rcs: 0.18, whatsapp: 0.30 }),
  },
  {
    id: "plan_scale",
    name: "Scale",
    billingModel: "postpaid",
    baseFeeMonthly: 75000,
    includedSeats: 20,
    perMessageRates: JSON.stringify({ sms: 0.11, rcs: 0.18, whatsapp: 0.32 }),
    throughputMps: 350,
    features: JSON.stringify(["Postpaid with Credit Line", "Unlimited Workspaces", "Dedicated AM", "Priority DLT Verification"]),
    priceFloors: JSON.stringify({ sms: 0.08, rcs: 0.14, whatsapp: 0.25 }),
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    billingModel: "postpaid",
    baseFeeMonthly: 150000,
    includedSeats: 50,
    perMessageRates: JSON.stringify({ sms: 0.09, rcs: 0.15, whatsapp: 0.28 }),
    throughputMps: 1000,
    features: JSON.stringify(["Custom SLA 99.99%", "Custom Rate Cards", "Bespoke DLT routing", "24/7 Phone & Slack Support"]),
    priceFloors: JSON.stringify({ sms: 0.06, rcs: 0.10, whatsapp: 0.20 }),
  },
];

const insertPlan = sqlite.prepare(`
  INSERT INTO plans (id, name, billing_model, base_fee_monthly, included_seats, per_message_rates, throughput_mps, features, price_floors)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const p of plansList) {
  insertPlan.run(p.id, p.name, p.billingModel, p.baseFeeMonthly, p.includedSeats, p.perMessageRates, p.throughputMps, p.features, p.priceFloors);
}

// ---------------------------------------------------------------------------
// 6. Seed Addon Catalog
// ---------------------------------------------------------------------------
const addonsList = [
  { id: "addon_extra_tps_50", name: "Extra throughput 50 MPS", type: "recurring", price: 15000 },
  { id: "addon_seat", name: "Additional seat", type: "recurring", price: 1200 },
  { id: "addon_dedicated_number", name: "Dedicated sender number", type: "recurring", price: 8000 },
  { id: "addon_priority_support", name: "Priority support", type: "recurring", price: 25000 },
];

const insertAddon = sqlite.prepare(`
  INSERT INTO addon_catalog (id, name, type, price)
  VALUES (?, ?, ?, ?)
`);
for (const a of addonsList) {
  insertAddon.run(a.id, a.name, a.type, a.price);
}

// ---------------------------------------------------------------------------
// 7. Generate 42 Organizations (Invented Indian Companies)
// Mix: 24 prepaid, 18 postpaid; ~25 healthy active, 9 at-risk, 5 suspended, 3 onboarding
// ---------------------------------------------------------------------------
const indianCities = [
  { city: "Mumbai", state: "Maharashtra", stateCode: "27" },
  { city: "Bengaluru", state: "Karnataka", stateCode: "29" },
  { city: "New Delhi", state: "Delhi", stateCode: "07" },
  { city: "Hyderabad", state: "Telangana", stateCode: "36" },
  { city: "Chennai", state: "Tamil Nadu", stateCode: "33" },
  { city: "Pune", state: "Maharashtra", stateCode: "27" },
  { city: "Gurugram", state: "Haryana", stateCode: "06" },
  { city: "Noida", state: "Uttar Pradesh", stateCode: "09" },
  { city: "Ahmedabad", state: "Gujarat", stateCode: "24" },
  { city: "Jaipur", state: "Rajasthan", stateCode: "08" },
  { city: "Kolkata", state: "West Bengal", stateCode: "19" },
];

function generateGSTIN(stateCode: string, panChars: string): string {
  return `${stateCode}${panChars}1Z${randomChoice(["A", "B", "C", "5", "8", "9"])}`;
}

interface RawOrgConfig {
  id: string;
  name: string;
  legalName: string;
  slug: string;
  industry: "BFSI" | "Insurance" | "D2C" | "Edtech" | "Fintech" | "Healthcare" | "Travel" | "Logistics";
  city: string;
  ownerAmId: string;
  status: "onboarding" | "active" | "at_risk" | "suspended" | "offboarded";
  billingModel: "prepaid" | "postpaid";
  planId: string;
  tags: string[];
  workspacesCount: number;
  churnProfile?: "steep_drop" | "normal" | "rising";
  creditBurnProfile?: "dangerous_high" | "normal" | "low";
  hasWastedSeats?: boolean;
  hasOverdueInvoice?: boolean;
  hasDisputedInvoice?: boolean;
  hasZeroPrepaidBalance?: boolean;
}

// 42 defined org configurations:
const rawOrgs: RawOrgConfig[] = [
  // --- HERO ORG ---
  {
    id: "org_meridian_finserv",
    name: "Meridian Finserv",
    legalName: "MERIDIAN FINANCIAL SERVICES PRIVATE LIMITED",
    slug: "meridian-finserv",
    industry: "BFSI",
    city: "Mumbai",
    ownerAmId: "usr_am_rohan",
    status: "at_risk",
    billingModel: "postpaid",
    planId: "plan_enterprise",
    tags: ["hero-demo", "enterprise-tier1", "credit-warning", "churn-risk"],
    workspacesCount: 3,
    churnProfile: "steep_drop", // -36% drop over 30d
    creditBurnProfile: "dangerous_high", // 88% credit used on SME workspace
    hasWastedSeats: true, // 4 of 10 paid seats inactive for 52 days
    hasOverdueInvoice: true, // 38 days overdue
  },

  // --- 17 OTHER POSTPAID ORGS ---
  {
    id: "org_payvantage",
    name: "PayVantage Technologies",
    legalName: "PAYVANTAGE SOLUTIONS INDIA PVT LTD",
    slug: "payvantage",
    industry: "Fintech",
    city: "Bengaluru",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_enterprise",
    tags: ["fintech-pg", "high-volume"],
    workspacesCount: 2,
    creditBurnProfile: "dangerous_high", // 92% credit used
    churnProfile: "normal",
  },
  {
    id: "org_kubermf",
    name: "Kuber Microfinance Ltd",
    legalName: "KUBER GRAMIN MICROFINANCE LIMITED",
    slug: "kuber-microfinance",
    industry: "BFSI",
    city: "Pune",
    ownerAmId: "usr_am_ananya",
    status: "at_risk",
    billingModel: "postpaid",
    planId: "plan_scale",
    tags: ["rural-loans", "collections-burst"],
    workspacesCount: 2,
    creditBurnProfile: "dangerous_high", // 94% credit used
    churnProfile: "steep_drop",
  },
  {
    id: "org_surakshabima",
    name: "Suraksha Bima Broking",
    legalName: "SURAKSHA GENERAL INSURANCE BROKERS LTD",
    slug: "suraksha-bima",
    industry: "Insurance",
    city: "New Delhi",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_scale",
    tags: ["insurtech", "claim-alerts"],
    workspacesCount: 2,
    creditBurnProfile: "dangerous_high", // 78% credit used
  },
  {
    id: "org_zenithlogistics",
    name: "Zenith Express Logistics",
    legalName: "ZENITH LOGISTICS CLOUD INDIA PRIVATE LIMITED",
    slug: "zenith-logistics",
    industry: "Logistics",
    city: "Bengaluru",
    ownerAmId: "usr_am_rohan",
    status: "at_risk",
    billingModel: "postpaid",
    planId: "plan_growth",
    tags: ["kyc-mismatch", "tracking-sms"],
    workspacesCount: 1,
    creditBurnProfile: "dangerous_high", // 84% credit used
    hasOverdueInvoice: true, // 22 days late
  },
  {
    id: "org_fintrack",
    name: "FinTrack Lending",
    legalName: "FINTRACK CAPITAL INDIA PVT LTD",
    slug: "fintrack-lending",
    industry: "Fintech",
    city: "Hyderabad",
    ownerAmId: "usr_am_ananya",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_enterprise",
    tags: ["instant-loans", "tier-1"],
    workspacesCount: 2,
    hasWastedSeats: true,
  },
  {
    id: "org_bharathealth",
    name: "BharatHealth Diagnostics",
    legalName: "BHARAT HEALTHCARE LABS PVT LTD",
    slug: "bharat-health",
    industry: "Healthcare",
    city: "Chennai",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_scale",
    tags: ["health-reports", "whatsapp-verified"],
    workspacesCount: 2,
    hasDisputedInvoice: true, // Disputed seat count
  },
  {
    id: "org_insurenest",
    name: "InsureNest Wealth",
    legalName: "INSURENEST BROKING INDIA LTD",
    slug: "insurenest",
    industry: "Insurance",
    city: "Gurugram",
    ownerAmId: "usr_am_rohan",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_scale",
    tags: ["term-life", "rcs-carousels"],
    workspacesCount: 2,
  },
  {
    id: "org_swiftcargo",
    name: "SwiftCargo Express",
    legalName: "SWIFT CARGO SUPPLY CHAIN SOLUTIONS LTD",
    slug: "swift-cargo",
    industry: "Logistics",
    city: "Ahmedabad",
    ownerAmId: "usr_am_ananya",
    status: "at_risk",
    billingModel: "postpaid",
    planId: "plan_growth",
    tags: ["fleet-alerts", "churn-risk"],
    workspacesCount: 2,
    churnProfile: "steep_drop", // >30% decline
    hasOverdueInvoice: true, // 54 days late
  },
  {
    id: "org_rupeebridge",
    name: "RupeeBridge SME Finance",
    legalName: "RUPEE BRIDGE CREDIT SERVICES PVT LTD",
    slug: "rupee-bridge",
    industry: "BFSI",
    city: "Mumbai",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_scale",
    tags: ["invoice-discounting"],
    workspacesCount: 2,
  },
  {
    id: "org_yatrawings",
    name: "YatraWings Global",
    legalName: "YATRA WINGS TRAVEL NETWORK INDIA LTD",
    slug: "yatrawings",
    industry: "Travel",
    city: "New Delhi",
    ownerAmId: "usr_am_rohan",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_growth",
    tags: ["flight-otp", "whatsapp-tickets"],
    workspacesCount: 1,
    hasDisputedInvoice: true, // Disputed seat count
  },
  {
    id: "org_aarogya",
    name: "Aarogya Lifecare Hospitals",
    legalName: "AAROGYA LIFECARE CLINICS PVT LTD",
    slug: "aarogya-lifecare",
    industry: "Healthcare",
    city: "Hyderabad",
    ownerAmId: "usr_am_ananya",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_scale",
    tags: ["opd-reminders", "enterprise"],
    workspacesCount: 2,
    hasWastedSeats: true,
  },
  {
    id: "org_nexakart",
    name: "NexaKart Retail",
    legalName: "NEXAKART COMMERCE SERVICES PVT LTD",
    slug: "nexakart",
    industry: "D2C",
    city: "Bengaluru",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_enterprise",
    tags: ["omnichannel", "flash-sale"],
    workspacesCount: 2,
  },
  {
    id: "org_gurukuled",
    name: "Gurukul Edutech",
    legalName: "GURUKUL LEARNING SYSTEMS PVT LTD",
    slug: "gurukul-edutech",
    industry: "Edtech",
    city: "Noida",
    ownerAmId: "usr_am_rohan",
    status: "at_risk",
    billingModel: "postpaid",
    planId: "plan_growth",
    tags: ["live-classes", "churn-risk"],
    workspacesCount: 1,
    churnProfile: "steep_drop", // >30% drop
  },
  {
    id: "org_vyaparflow",
    name: "VyaparFlow Technologies",
    legalName: "VYAPARFLOW B2B NETWORK LTD",
    slug: "vyaparflow",
    industry: "Fintech",
    city: "Jaipur",
    ownerAmId: "usr_am_ananya",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_growth",
    tags: ["merchant-pos"],
    workspacesCount: 2,
  },
  {
    id: "org_logiprime",
    name: "LogiPrime Multimodal",
    legalName: "LOGIPRIME FREIGHT CORRIDORS INDIA LTD",
    slug: "logiprime",
    industry: "Logistics",
    city: "Kolkata",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_scale",
    tags: ["cold-chain", "status-updates"],
    workspacesCount: 2,
  },
  {
    id: "org_dhanaseva",
    name: "DhanaSeva Rural Credit",
    legalName: "DHANASEVA COOPERATIVE FINCORP LTD",
    slug: "dhanaseva",
    industry: "BFSI",
    city: "Ahmedabad",
    ownerAmId: "usr_am_rohan",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_scale",
    tags: ["shg-loans"],
    workspacesCount: 1,
  },
  {
    id: "org_carepulse",
    name: "CarePulse Healthtech",
    legalName: "CAREPULSE TELEHEALTH INDIA PVT LTD",
    slug: "carepulse",
    industry: "Healthcare",
    city: "Bengaluru",
    ownerAmId: "usr_am_ananya",
    status: "active",
    billingModel: "postpaid",
    planId: "plan_growth",
    tags: ["doctor-booking"],
    workspacesCount: 1,
    hasWastedSeats: true,
  },

  // --- 24 PREPAID ORGS ---
  {
    id: "org_zippymart",
    name: "ZippyMart Hyperlocal",
    legalName: "ZIPPYMART RETAIL PRIVATE LIMITED",
    slug: "zippymart",
    industry: "D2C",
    city: "Bengaluru",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_growth",
    tags: ["10min-delivery", "otp-high"],
    workspacesCount: 2,
    hasZeroPrepaidBalance: true, // Balance: ₹140
  },
  {
    id: "org_urbansprout",
    name: "UrbanSprout Organic Foods",
    legalName: "URBAN SPROUT AGRO RETAIL PVT LTD",
    slug: "urban-sprout",
    industry: "D2C",
    city: "Mumbai",
    ownerAmId: "usr_am_rohan",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["organic-farm", "direct-to-consumer"],
    workspacesCount: 1,
  },
  {
    id: "org_vedicnaturals",
    name: "Vedic Naturals Wellness",
    legalName: "VEDIC NATURALS AYURVEDA PVT LTD",
    slug: "vedic-naturals",
    industry: "D2C",
    city: "Jaipur",
    ownerAmId: "usr_am_ananya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_growth",
    tags: ["ayurveda", "whatsapp-promos"],
    workspacesCount: 2,
    hasWastedSeats: true,
  },
  {
    id: "org_shikshasetu",
    name: "ShikshaSetu Learning",
    legalName: "SHIKSHA SETU DIGITAL FOUNDATION",
    slug: "shiksha-setu",
    industry: "Edtech",
    city: "Pune",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["gov-exams", "mock-tests"],
    workspacesCount: 1,
  },
  {
    id: "org_yoddhaclasses",
    name: "Yoddha Defense Academy",
    legalName: "YODDHA CAREER ACADEMY PVT LTD",
    slug: "yoddha-classes",
    industry: "Edtech",
    city: "New Delhi",
    ownerAmId: "usr_am_rohan",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["nda-cds", "sms-broadcast"],
    workspacesCount: 1,
  },
  {
    id: "org_travelsaathi",
    name: "TravelSaathi Tours",
    legalName: "TRAVEL SAATHI HOLIDAYS INDIA PVT LTD",
    slug: "travel-saathi",
    industry: "Travel",
    city: "Mumbai",
    ownerAmId: "usr_am_ananya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_growth",
    tags: ["custom-itineraries"],
    workspacesCount: 1,
  },
  {
    id: "org_quickdrop",
    name: "QuickDrop Courier",
    legalName: "QUICKDROP EXPRESS SERVICES PVT LTD",
    slug: "quickdrop",
    industry: "Logistics",
    city: "Chennai",
    ownerAmId: "usr_am_priya",
    status: "suspended", // Suspended
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["negative-wallet", "suspended"],
    workspacesCount: 1,
    hasZeroPrepaidBalance: true, // Balance: -₹3,450
  },
  {
    id: "org_mediease",
    name: "MediEase Pharma Online",
    legalName: "MEDIEASE HEALTHCARE PLATFORMS LTD",
    slug: "mediease",
    industry: "Healthcare",
    city: "Hyderabad",
    ownerAmId: "usr_am_rohan",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_growth",
    tags: ["e-pharmacy", "refill-alerts"],
    workspacesCount: 1,
  },
  {
    id: "org_pureglow",
    name: "PureGlow Botanicals",
    legalName: "PUREGLOW DERMA CONSUMER PVT LTD",
    slug: "pureglow",
    industry: "D2C",
    city: "Bengaluru",
    ownerAmId: "usr_am_ananya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_growth",
    tags: ["skincare", "meta-catalog"],
    workspacesCount: 1,
  },
  {
    id: "org_parikshaprep",
    name: "ParikshaPrep Hub",
    legalName: "PARIKSHA PREP TEST SERVICES PVT LTD",
    slug: "pariksha-prep",
    industry: "Edtech",
    city: "Noida",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["gate-cat-prep"],
    workspacesCount: 1,
  },
  {
    id: "org_cargoexpress",
    name: "CargoExpress Hub",
    legalName: "CARGO EXPRESS INLAND FREIGHTERS PVT LTD",
    slug: "cargo-express",
    industry: "Logistics",
    city: "Kolkata",
    ownerAmId: "usr_am_rohan",
    status: "suspended", // Suspended
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["suspended", "zero-credit"],
    workspacesCount: 1,
    hasZeroPrepaidBalance: true, // Balance: -₹8,120
  },
  {
    id: "org_safarholiday",
    name: "SafarHoliday Travels",
    legalName: "SAFAR HOLIDAY DESTINATIONS LTD",
    slug: "safar-holiday",
    industry: "Travel",
    city: "Jaipur",
    ownerAmId: "usr_am_ananya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["rajasthan-tours"],
    workspacesCount: 1,
  },
  {
    id: "org_dentacare",
    name: "DentaCare Aligners",
    legalName: "DENTACARE SMILES INDIA PVT LTD",
    slug: "dentacare",
    industry: "Healthcare",
    city: "Mumbai",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_growth",
    tags: ["dental-leads"],
    workspacesCount: 1,
    hasWastedSeats: true,
  },
  {
    id: "org_kaushalsetu",
    name: "KaushalSetu Skills",
    legalName: "KAUSHAL SETU VOCATIONAL TRAINING LTD",
    slug: "kaushal-setu",
    industry: "Edtech",
    city: "Pune",
    ownerAmId: "usr_am_rohan",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["skill-india"],
    workspacesCount: 1,
  },
  {
    id: "org_snackpop",
    name: "SnackPop Munchies",
    legalName: "SNACKPOP FOOD AND BEVERAGES PVT LTD",
    slug: "snackpop",
    industry: "D2C",
    city: "Ahmedabad",
    ownerAmId: "usr_am_ananya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["healthy-snacks"],
    workspacesCount: 1,
  },
  {
    id: "org_flyocean",
    name: "FlyOcean Charters",
    legalName: "FLY OCEAN AVIATION CHARTERS LTD",
    slug: "fly-ocean",
    industry: "Travel",
    city: "Mumbai",
    ownerAmId: "usr_am_priya",
    status: "at_risk",
    billingModel: "prepaid",
    planId: "plan_growth",
    tags: ["vip-charters", "churn-risk"],
    workspacesCount: 1,
    churnProfile: "steep_drop",
  },
  {
    id: "org_freshbasket",
    name: "FreshBasket Greens",
    legalName: "FRESH BASKET HYDROPONIC FARMS PVT LTD",
    slug: "fresh-basket",
    industry: "D2C",
    city: "Bengaluru",
    ownerAmId: "usr_am_rohan",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["hydroponics"],
    workspacesCount: 1,
  },
  {
    id: "org_edupulse",
    name: "EduPulse K12",
    legalName: "EDUPULSE CURRICULUM TECH PVT LTD",
    slug: "edupulse",
    industry: "Edtech",
    city: "Gurugram",
    ownerAmId: "usr_am_ananya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_growth",
    tags: ["cbse-icse-math"],
    workspacesCount: 1,
  },
  {
    id: "org_healthnest",
    name: "HealthNest ElderCare",
    legalName: "HEALTHNEST SENIOR LIVING & CARE LTD",
    slug: "healthnest",
    industry: "Healthcare",
    city: "Chennai",
    ownerAmId: "usr_am_priya",
    status: "active",
    billingModel: "prepaid",
    planId: "plan_growth",
    tags: ["home-care-alerts"],
    workspacesCount: 1,
  },
  {
    id: "org_routehaul",
    name: "RouteHaul Logistics",
    legalName: "ROUTEHAUL TRUCKING FREIGHT SERVICES PVT LTD",
    slug: "routehaul",
    industry: "Logistics",
    city: "New Delhi",
    ownerAmId: "usr_am_rohan",
    status: "suspended", // Suspended
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["suspended", "failed-recharge"],
    workspacesCount: 1,
  },
  {
    id: "org_bluewave",
    name: "BlueWave Cruises",
    legalName: "BLUEWAVE OFFSHORE LEISURE PVT LTD",
    slug: "bluewave-cruises",
    industry: "Travel",
    city: "Kochi",
    ownerAmId: "usr_am_ananya",
    status: "suspended", // Suspended
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["suspended", "seasonal"],
    workspacesCount: 1,
  },
  // 3 Onboarding Orgs:
  {
    id: "org_omniinsure",
    name: "OmniInsure Tech",
    legalName: "OMNIINSURE UNDERWRITERS INDIA PVT LTD",
    slug: "omni-insure",
    industry: "Insurance",
    city: "Bengaluru",
    ownerAmId: "usr_am_priya",
    status: "onboarding", // Onboarding
    billingModel: "postpaid",
    planId: "plan_scale",
    tags: ["onboarding", "kyc-in-progress"],
    workspacesCount: 1,
  },
  {
    id: "org_ayurlife",
    name: "AyurLife Organics",
    legalName: "AYURLIFE WELLNESS LABS PVT LTD",
    slug: "ayurlife",
    industry: "D2C",
    city: "Pune",
    ownerAmId: "usr_am_rohan",
    status: "onboarding", // Onboarding
    billingModel: "prepaid",
    planId: "plan_starter",
    tags: ["onboarding", "dlt-registration"],
    workspacesCount: 1,
  },
  {
    id: "org_skoolbox",
    name: "SkoolBox Robotics",
    legalName: "SKOOLBOX STEM INNOVATIONS PVT LTD",
    slug: "skoolbox",
    industry: "Edtech",
    city: "Hyderabad",
    ownerAmId: "usr_am_ananya",
    status: "onboarding", // Onboarding
    billingModel: "prepaid",
    planId: "plan_growth",
    tags: ["onboarding", "stem-kits"],
    workspacesCount: 1,
  },
];

console.log(`Configuring ${rawOrgs.length} Organizations...`);

// Insert Organizations
const insertOrg = sqlite.prepare(`
  INSERT INTO organizations (
    id, name, legal_name, slug, industry, city, owner_am_id, status, billing_model, plan_id, contract_start, contract_end, tags
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const nowSeconds = Math.floor(Date.now() / 1000);
const oneYearAgo = nowSeconds - 365 * 86400;
const oneYearLater = nowSeconds + 365 * 86400;

for (const o of rawOrgs) {
  insertOrg.run(
    o.id,
    o.name,
    o.legalName,
    o.slug,
    o.industry,
    o.city,
    o.ownerAmId,
    o.status,
    o.billingModel,
    o.planId,
    oneYearAgo,
    oneYearLater,
    JSON.stringify(o.tags)
  );
}

// ---------------------------------------------------------------------------
// 8. Generate Workspaces (58 Workspaces across the 42 Orgs)
// ---------------------------------------------------------------------------
interface WorkspaceData {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  status: "kyc_pending" | "kyc_in_review" | "active" | "suspended";
  gstin: string;
  billingState: string;
  walletBalance: number;
  creditLimit: number;
  creditUsed: number;
  churnProfile: "steep_drop" | "normal" | "rising";
  hasWastedSeats: boolean;
}

const workspacesList: WorkspaceData[] = [];
let wsGlobalIdx = 1;

for (const o of rawOrgs) {
  const cityInfo = indianCities.find((c) => c.city === o.city) || indianCities[0];

  for (let i = 0; i < o.workspacesCount; i++) {
    const wsId = `ws_${o.slug.replace(/-/g, "_")}${o.workspacesCount > 1 ? `_${i === 0 ? "core" : i === 1 ? "sme" : "wealth"}` : ""}`;
    let wsName = o.name;
    if (o.workspacesCount === 3 && o.id === "org_meridian_finserv") {
      wsName = i === 0 ? "Meridian Retail Lending" : i === 1 ? "Meridian SME Credit" : "Meridian Wealth & Insurance";
    } else if (o.workspacesCount > 1) {
      wsName = `${o.name} - ${i === 0 ? "Consumer" : "Enterprise Hub"}`;
    }

    let wsStatus: "kyc_pending" | "kyc_in_review" | "active" | "suspended" = "active";
    if (o.status === "suspended") wsStatus = "suspended";
    else if (o.status === "onboarding") wsStatus = i === 0 ? "kyc_in_review" : "kyc_pending";

    // Billing metrics
    let walletBalance = 0;
    let creditLimit = 0;
    let creditUsed = 0;

    if (o.billingModel === "prepaid") {
      if (o.hasZeroPrepaidBalance) {
        walletBalance = o.status === "suspended" ? -randomInt(3000, 15000) : randomInt(100, 950);
      } else {
        walletBalance = randomInt(25000, 850000);
      }
    } else {
      // Postpaid
      if (o.id === "org_meridian_finserv") {
        if (i === 1) {
          // SME workspace has 88% credit used!
          creditLimit = 2500000;
          creditUsed = 2200000; // 88%
        } else if (i === 0) {
          creditLimit = 3500000;
          creditUsed = 1450000; // 41%
        } else {
          creditLimit = 1500000;
          creditUsed = 620000;
        }
      } else if (o.creditBurnProfile === "dangerous_high") {
        creditLimit = randomChoice([1000000, 2000000, 4000000, 6000000]);
        // 70% to 95% used
        const pct = randomFloat(0.72, 0.94);
        creditUsed = Math.round(creditLimit * pct);
      } else {
        creditLimit = randomChoice([1000000, 2500000, 5000000, 8000000]);
        creditUsed = Math.round(creditLimit * randomFloat(0.2, 0.55));
      }
    }

    const panChars = `AABC${String.fromCharCode(65 + (wsGlobalIdx % 26))}${randomInt(1000, 9999)}${String.fromCharCode(65 + ((wsGlobalIdx * 3) % 26))}`;
    const gstin = generateGSTIN(cityInfo.stateCode, panChars);

    workspacesList.push({
      id: wsId,
      orgId: o.id,
      name: wsName,
      slug: `${o.slug}-${i === 0 ? "prod" : i === 1 ? "sme" : "sec"}`,
      status: wsStatus,
      gstin,
      billingState: cityInfo.state,
      walletBalance,
      creditLimit,
      creditUsed,
      churnProfile: o.churnProfile || "normal",
      hasWastedSeats: Boolean(o.hasWastedSeats && i === 0),
    });

    wsGlobalIdx++;
  }
}

console.log(`Generated ${workspacesList.length} total Workspaces across 42 Organizations.`);

const insertWs = sqlite.prepare(`
  INSERT INTO workspaces (
    id, org_id, name, slug, status, gstin, billing_state, wallet_balance, credit_limit, credit_used
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const w of workspacesList) {
  insertWs.run(
    w.id,
    w.orgId,
    w.name,
    w.slug,
    w.status,
    w.gstin,
    w.billingState,
    w.walletBalance,
    w.creditLimit,
    w.creditUsed
  );
}

// ---------------------------------------------------------------------------
// 9. Subscriptions & Workspace Addons
// ---------------------------------------------------------------------------
const insertSub = sqlite.prepare(`
  INSERT INTO subscriptions (workspace_id, plan_id, custom_price_overrides, discount_pct, discount_reason, effective_from)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertWsAddon = sqlite.prepare(`
  INSERT INTO workspace_addons (id, workspace_id, addon_id, quantity, status, start_date, end_date)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const w of workspacesList) {
  const org = rawOrgs.find((o) => o.id === w.orgId)!;
  const hasDiscount = w.orgId === "org_meridian_finserv" || w.creditLimit > 3000000;
  const discountPct = hasDiscount ? (w.orgId === "org_meridian_finserv" ? 12 : 8) : 0;
  const discountReason = hasDiscount ? "Enterprise strategic renewal discount" : null;

  insertSub.run(
    w.id,
    org.planId,
    hasDiscount ? JSON.stringify({ sms: 0.10, rcs: 0.16 }) : null,
    discountPct,
    discountReason,
    oneYearAgo
  );

  // Addons for some workspaces
  if (w.creditLimit > 2000000 || w.name.includes("Retail") || w.name.includes("Consumer")) {
    insertWsAddon.run(
      `wsa_${w.id}_tps`,
      w.id,
      "addon_extra_tps_50",
      randomChoice([1, 2, 4]),
      "active",
      oneYearAgo,
      null
    );
  }
}

// ---------------------------------------------------------------------------
// 10. Workspace Users (3-14 per workspace, with wasted seat scenarios)
// 6 workspaces with 30-50% of paid seats inactive for >45 days
// ---------------------------------------------------------------------------
const insertWsUser = sqlite.prepare(`
  INSERT INTO workspace_users (id, workspace_id, name, email, tier, custom_role_name, last_login_at, seat_active, is_seat_paid)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const firstNames = ["Aarav", "Vihaan", "Aditi", "Isha", "Rohan", "Neha", "Kunal", "Tanvi", "Siddharth", "Megha", "Varun", "Pooja", "Arjun", "Anika"];
const lastNames = ["Deshmukh", "Patil", "Agarwal", "Bansal", "Chopra", "Reddy", "Singhania", "Kapoor", "Joshi", "Bhatia", "Saxena", "Iyer"];

const FIFTY_DAYS_AGO = nowSeconds - 52 * 86400;
const THREE_DAYS_AGO = nowSeconds - 3 * 86400;

for (const w of workspacesList) {
  const isHero = w.orgId === "org_meridian_finserv";
  const userCount = isHero ? 10 : randomInt(3, 12);

  // Wasted seat scenario check: 6 specific workspaces have 30-50% inactive seats >45 days
  const hasWaste = w.hasWastedSeats || (isHero && w.id.includes("sme"));
  const wasteCount = hasWaste ? Math.ceil(userCount * 0.4) : 0; // 40% waste

  for (let uIdx = 0; uIdx < userCount; uIdx++) {
    const fn = randomChoice(firstNames);
    const ln = randomChoice(lastNames);
    const fullName = `${fn} ${ln}`;
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@${w.slug.split("-")[0]}.in`;

    let tier: "owner" | "admin" | "user" | "custom" = "user";
    let customRole: string | null = null;
    if (uIdx === 0) tier = "owner";
    else if (uIdx === 1) tier = "admin";
    else if (uIdx === userCount - 1 && userCount > 5) {
      tier = "custom";
      customRole = randomChoice(["Campaign Specialist", "DLT Operations Lead", "Billing Analyst"]);
    }

    const isWasted = uIdx >= userCount - wasteCount;
    const seatActive = isWasted ? 0 : 1;
    const isSeatPaid = 1;
    const lastLogin = isWasted ? FIFTY_DAYS_AGO : randomInt(THREE_DAYS_AGO, nowSeconds);

    insertWsUser.run(
      `usr_${w.id}_${uIdx + 1}`,
      w.id,
      fullName,
      email,
      tier,
      customRole,
      lastLogin,
      seatActive,
      isSeatPaid
    );
  }
}

// ---------------------------------------------------------------------------
// 11. Daily Usage (90 Days per workspace = 5,220 rows)
// Features weekday/weekend seasonality, festival peaks, and specific trend curves:
// - 4-5 orgs with declining usage trend >30% over the last 30 days
// - 5 postpaid workspaces with rising daily burn near credit limit
// ---------------------------------------------------------------------------
console.log("Generating 90 days of daily usage history per workspace...");

const insertUsage = sqlite.prepare(`
  INSERT INTO usage_daily (id, workspace_id, date, sms_count, rcs_count, whatsapp_count, delivered_pct, cost)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const dates90: string[] = [];
const today = new Date();
for (let d = 89; d >= 0; d--) {
  const dt = new Date(today);
  dt.setDate(today.getDate() - d);
  dates90.push(dt.toISOString().split("T")[0]);
}

for (const w of workspacesList) {
  const isDeclining = w.churnProfile === "steep_drop";
  const isRising = w.creditLimit > 0 && w.creditUsed / (w.creditLimit || 1) >= 0.75;

  const baseSms = randomInt(5000, 60000);
  const baseRcs = randomInt(1000, 15000);
  const baseWa = randomInt(2000, 25000);

  for (let dayIdx = 0; dayIdx < 90; dayIdx++) {
    const curDateStr = dates90[dayIdx];
    const curDate = new Date(curDateStr);
    const dayOfWeek = curDate.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Weekend factor (lower B2B usage)
    const weekendMultiplier = isWeekend ? randomFloat(0.45, 0.65) : 1.0;

    // Trend multiplier:
    let trendMultiplier = 1.0;
    if (isDeclining) {
      if (dayIdx < 60) {
        trendMultiplier = 1.05;
      } else {
        // Last 30 days: linear decline down to ~55-60% of baseline (severe >30% churn signal)
        const dropFraction = (dayIdx - 60) / 30; // 0 to 1
        trendMultiplier = 1.05 - dropFraction * 0.48; // drops to ~0.57
      }
    } else if (isRising) {
      if (dayIdx >= 60) {
        // Rapid growth in last 30 days (surging burn)
        const surgeFraction = (dayIdx - 60) / 30;
        trendMultiplier = 1.0 + surgeFraction * 0.65;
      }
    }

    const noise = randomFloat(0.88, 1.12);

    const smsCount = Math.round(baseSms * weekendMultiplier * trendMultiplier * noise);
    const rcsCount = Math.round(baseRcs * weekendMultiplier * trendMultiplier * noise);
    const waCount = Math.round(baseWa * weekendMultiplier * trendMultiplier * noise);

    const deliveredPct = randomFloat(98.1, 99.9);
    // Cost calculation (SMS @ ₹0.12, RCS @ ₹0.20, WA @ ₹0.35)
    const cost = Math.round(smsCount * 0.12 + rcsCount * 0.20 + waCount * 0.35);

    insertUsage.run(
      `ud_${w.id}_${curDateStr}`,
      w.id,
      curDateStr,
      smsCount,
      rcsCount,
      waCount,
      deliveredPct,
      cost
    );
  }
}

// ---------------------------------------------------------------------------
// 12. Invoices & Wallet Transactions
// - 3 postpaid orgs with overdue invoices (15-60 days late)
// - 2 with disputed invoices caused by seat count mismatch
// - Wallet transactions for prepaid workspaces
// ---------------------------------------------------------------------------
const insertInvoice = sqlite.prepare(`
  INSERT INTO invoices (id, workspace_id, period, amount, gst_amount, status, issued_at, due_at, paid_at, line_items)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertWalletTx = sqlite.prepare(`
  INSERT INTO wallet_transactions (id, workspace_id, type, amount, balance_after, reference, created_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let invCounter = 1001;

for (const w of workspacesList) {
  const org = rawOrgs.find((o) => o.id === w.orgId)!;

  if (org.billingModel === "postpaid") {
    // Generate 3 past months invoices
    const periods = ["Jul 2026", "Aug 2026", "Sep 2026"];

    for (let pIdx = 0; pIdx < periods.length; pIdx++) {
      const p = periods[pIdx];
      const invId = `inv_${invCounter++}`;
      const amount = randomInt(180000, 1450000);
      const gst = Math.round(amount * 0.18);

      const issuedAt = nowSeconds - (3 - pIdx) * 30 * 86400;
      const dueAt = issuedAt + 15 * 86400;

      let status: "issued" | "paid" | "overdue" | "disputed" = "paid";
      let paidAt: number | null = dueAt - randomInt(1, 5) * 86400;

      if (pIdx === 2) {
        // Most recent invoice (Sep 2026)
        if (org.hasOverdueInvoice) {
          status = "overdue";
          paidAt = null;
        } else if (org.hasDisputedInvoice) {
          status = "disputed";
          paidAt = null;
        } else {
          status = "issued";
          paidAt = null;
        }
      }

      const lineItems = JSON.stringify([
        { desc: "Transactional & OTP SMS Delivery", amount: Math.round(amount * 0.6) },
        { desc: "WhatsApp Cloud API Messaging", amount: Math.round(amount * 0.3) },
        { desc: "Platform Base Fee & User Seats", amount: Math.round(amount * 0.1) },
      ]);

      insertInvoice.run(invId, w.id, p, amount, gst, status, issuedAt, dueAt, paidAt, lineItems);
    }
  } else {
    // Prepaid wallet history
    const topupAmount = randomInt(50000, 200000);
    insertWalletTx.run(
      `wt_${w.id}_1`,
      w.id,
      "topup",
      topupAmount,
      w.walletBalance + 45000,
      "NEFT/RAZORPAY_RECHARGE_9901",
      "Auto-Billing Daemon",
      nowSeconds - 14 * 86400
    );
    insertWalletTx.run(
      `wt_${w.id}_2`,
      w.id,
      "usage",
      -45000,
      w.walletBalance,
      "Daily Message Consumption Cutoff",
      "System Daemon",
      nowSeconds - 1 * 86400
    );
  }
}

// ---------------------------------------------------------------------------
// 13. Credit History
// ---------------------------------------------------------------------------
const insertCreditHist = sqlite.prepare(`
  INSERT INTO credit_history (id, workspace_id, old_limit, new_limit, reason, changed_by, approved_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const meridianSmeWs = workspacesList.find((w) => w.orgId === "org_meridian_finserv" && w.id.includes("sme")) || workspacesList[0];
const payvantageWs = workspacesList.find((w) => w.orgId === "org_payvantage") || workspacesList[1];

insertCreditHist.run(
  "ch_101",
  meridianSmeWs.id,
  1500000,
  2500000,
  "Diwali MSME festive disbursal campaign capacity ramp-up",
  "Rohan Verma (Account Manager)",
  "Rajesh Nair (Finance Head)",
  nowSeconds - 45 * 86400
);

insertCreditHist.run(
  "ch_102",
  payvantageWs.id,
  3000000,
  5000000,
  "Contract renewal with 66% limit expansion",
  "Priya Sharma (Account Manager)",
  "Rajesh Nair (Finance Head)",
  nowSeconds - 60 * 86400
);

// ---------------------------------------------------------------------------
// 14. Support & Operations Tickets (2-8 per org, open & breached)
// ---------------------------------------------------------------------------
const insertTicket = sqlite.prepare(`
  INSERT INTO tickets (id, org_id, subject, priority, status, category, created_at, resolved_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const ticketTemplates = [
  { subj: "Delivery drop on Vodafone-Idea (Vi) DLT circle", cat: "api_delivery", prio: "high" },
  { subj: "Overdue payment grace period extension request", cat: "billing", prio: "urgent" },
  { subj: "Dispute over unallocated seats charged on Sep invoice", cat: "seat_dispute", prio: "high" },
  { subj: "Request for urgent credit limit buffer expansion", cat: "credit_limit", prio: "urgent" },
  { subj: "DLT Principal Entity header approval delay", cat: "dlt_compliance", prio: "medium" },
  { subj: "Webhook signature verification HMAC failure", cat: "general", prio: "medium" },
];

let tktCounter = 2001;
for (const o of rawOrgs) {
  const count = o.id === "org_meridian_finserv" ? 6 : randomInt(2, 5);

  for (let t = 0; t < count; t++) {
    const tmpl = randomChoice(ticketTemplates);
    const isHero = o.id === "org_meridian_finserv";
    const status = isHero && t === 0 ? "open" : randomChoice(["open", "in_progress", "resolved", "closed"]);
    const prio = isHero && t === 0 ? "urgent" : tmpl.prio;
    const createdAt = nowSeconds - randomInt(2, 35) * 86400;
    const resolvedAt = status === "resolved" || status === "closed" ? createdAt + randomInt(1, 4) * 86400 : null;

    insertTicket.run(
      `tkt_${tktCounter++}`,
      o.id,
      t === 0 && isHero ? "Seat mismatch dispute on September invoice #INV-1001" : tmpl.subj,
      prio,
      status,
      t === 0 && isHero ? "seat_dispute" : tmpl.cat,
      createdAt,
      resolvedAt
    );
  }
}

// ---------------------------------------------------------------------------
// 15. KYC Cases (6 cases in different states, 2 SLA breached >5 days)
// References the generated sample docs in /sample-docs/
// ---------------------------------------------------------------------------
const insertKyc = sqlite.prepare(`
  INSERT INTO kyc_cases (id, workspace_id, status, submitted_at, assigned_to, documents, declared_data, sla_due_at, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const meridianCoreWs = workspacesList.find((w) => w.orgId === "org_meridian_finserv")!;
const zenithWs = workspacesList.find((w) => w.orgId === "org_zenithlogistics")!;
const omniWs = workspacesList.find((w) => w.orgId === "org_omniinsure")!;
const ayurlifeWs = workspacesList.find((w) => w.orgId === "org_ayurlife")!;
const skoolboxWs = workspacesList.find((w) => w.orgId === "org_skoolbox")!;
const carepulseWs = workspacesList.find((w) => w.orgId === "org_carepulse")!;

// Case 1: Meridian Finserv (Approved, verified against MCA)
insertKyc.run(
  "kyc_101",
  meridianCoreWs.id,
  "approved",
  nowSeconds - 12 * 86400,
  "usr_comp_kavita",
  JSON.stringify([
    {
      type: "gst_certificate",
      filename: "/sample-docs/gst_certificate_meridian.pdf",
      extractedData: { gstin: "27AABCM8822K1Z9", legalName: "MERIDIAN FINANCIAL SERVICES PRIVATE LIMITED" },
    },
    {
      type: "pan_card",
      filename: "/sample-docs/pan_card_meridian.pdf",
      extractedData: { pan: "AABCM8822K", category: "Company" },
    },
  ]),
  JSON.stringify({
    legalName: "MERIDIAN FINANCIAL SERVICES PRIVATE LIMITED",
    gstin: "27AABCM8822K1Z9",
    pan: "AABCM8822K",
    state: "Maharashtra",
    directorName: "Siddharth Deshmukh",
  }),
  nowSeconds - 9 * 86400,
  "Verified against MCA21 and GST portal. All documents match."
);

// Case 2: Zenith Express Logistics (REJECTED due to deliberate name mismatch in doc 3!)
insertKyc.run(
  "kyc_102",
  zenithWs.id,
  "rejected",
  nowSeconds - 8 * 86400,
  "usr_comp_suresh",
  JSON.stringify([
    {
      type: "incorporation_cert",
      filename: "/sample-docs/incorporation_certificate_zenith.pdf",
      extractedData: {
        legalName: "ZENITH LOGISTICS CLOUD INDIA PRIVATE LIMITED",
        cin: "U72900KA2021PTC148892",
      },
    },
  ]),
  JSON.stringify({
    legalName: "Zenith Express Logistics Ltd", // MISMATCH!
    gstin: "29AAFCZ4491J1Z8",
    pan: "AAFCZ4491J",
    state: "Karnataka",
    directorName: "Rohan Kapoor",
  }),
  nowSeconds - 5 * 86400,
  "REJECTED: Declared entity name 'Zenith Express Logistics Ltd' does not match Certificate of Incorporation legal name 'ZENITH LOGISTICS CLOUD INDIA PRIVATE LIMITED'."
);

// Case 3: OmniInsure Tech (In Review, SLA BREACHED > 7 days!)
insertKyc.run(
  "kyc_103",
  omniWs.id,
  "in_review",
  nowSeconds - 7 * 86400, // 7 days ago!
  "usr_comp_kavita",
  JSON.stringify([
    {
      type: "gst_certificate",
      filename: "/sample-docs/gst_certificate_meridian.pdf",
      extractedData: { state: "Karnataka" },
    },
  ]),
  JSON.stringify({
    legalName: "OMNIINSURE UNDERWRITERS INDIA PVT LTD",
    gstin: "29AABCO9911K1Z2",
    pan: "AABCO9911K",
    state: "Karnataka",
    directorName: "Aditi Chopra",
  }),
  nowSeconds - 2 * 86400, // SLA breached by 2 days!
  "SLA BREACHED: Waiting on internal compliance review for WABA Business verification."
);

// Case 4: AyurLife Organics (In Review, SLA BREACHED > 6 days!)
insertKyc.run(
  "kyc_104",
  ayurlifeWs.id,
  "in_review",
  nowSeconds - 6 * 86400, // 6 days ago!
  "usr_comp_suresh",
  JSON.stringify([]),
  JSON.stringify({
    legalName: "AYURLIFE WELLNESS LABS PVT LTD",
    gstin: "27AABCA3311E1Z4",
    pan: "AABCA3311E",
    state: "Maharashtra",
    directorName: "Vihaan Patil",
  }),
  nowSeconds - 1 * 86400, // SLA breached!
  "SLA BREACHED: FSSAI registration cert submitted; awaiting tax verification."
);

// Case 5: SkoolBox Robotics (Needs Info)
insertKyc.run(
  "kyc_105",
  skoolboxWs.id,
  "needs_info",
  nowSeconds - 3 * 86400,
  "usr_comp_kavita",
  JSON.stringify([]),
  JSON.stringify({
    legalName: "SKOOLBOX STEM INNOVATIONS PVT LTD",
    gstin: "36AABCS7711N1Z5",
    pan: "AABCS7711N",
    state: "Telangana",
    directorName: "Kunal Bansal",
  }),
  nowSeconds + 2 * 86400,
  "Director PAN card signature blurred. Requested high-resolution re-upload."
);

// Case 6: CarePulse Healthtech (Approved)
insertKyc.run(
  "kyc_106",
  carepulseWs.id,
  "approved",
  nowSeconds - 18 * 86400,
  "usr_comp_suresh",
  JSON.stringify([]),
  JSON.stringify({
    legalName: "CAREPULSE TELEHEALTH INDIA PVT LTD",
    gstin: "29AABCC1122M1Z9",
    pan: "AABCC1122M",
    state: "Karnataka",
    directorName: "Megha Reddy",
  }),
  nowSeconds - 15 * 86400,
  "Approved regular healthcare provider tier."
);

// ---------------------------------------------------------------------------
// 16. Sender IDs & Templates
// - At least 5 sender-IDs (including MRDFIN which is SLA breached)
// - At least 8 templates
// ---------------------------------------------------------------------------
const insertSenderId = sqlite.prepare(`
  INSERT INTO sender_ids (id, workspace_id, header, channel, status, submitted_at, approved_at, rejection_reason)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const kuberWs = workspacesList.find((w) => w.orgId === "org_kubermf")!;
const zippymartWs = workspacesList.find((w) => w.orgId === "org_zippymart")!;

insertSenderId.run(
  "sid_101",
  meridianCoreWs.id,
  "MRDFIN",
  "sms",
  "submitted",
  nowSeconds - 7 * 86400, // SLA breached (7 days ago!)
  null,
  null
);

insertSenderId.run(
  "sid_102",
  payvantageWs.id,
  "PAYVAN",
  "sms",
  "approved",
  nowSeconds - 25 * 86400,
  nowSeconds - 23 * 86400,
  null
);

insertSenderId.run(
  "sid_103",
  zenithWs.id,
  "ZENTHL",
  "sms",
  "rejected",
  nowSeconds - 10 * 86400,
  null,
  "DLT Principal Entity registration number invalid on Jio DLT portal"
);

insertSenderId.run(
  "sid_104",
  kuberWs.id,
  "KUBERM",
  "rcs",
  "in_review",
  nowSeconds - 2 * 86400,
  null,
  null
);

insertSenderId.run(
  "sid_105",
  zippymartWs.id,
  "ZIPPYM",
  "whatsapp",
  "approved",
  nowSeconds - 30 * 86400,
  nowSeconds - 28 * 86400,
  null
);

const insertTemplate = sqlite.prepare(`
  INSERT INTO templates (id, workspace_id, name, category, body, dlt_template_id, status, submitted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const sampleTemplates = [
  { name: "otp_login_v1", cat: "otp", body: "Your Meridian Finserv verification code is {#var#}. Valid for 10 minutes. Do not share.", dlt: "1107161234567890", status: "approved" },
  { name: "loan_disbursal_alert", cat: "transactional", body: "Dear {#var#}, your loan of Rs. {#var#} has been approved and credited to A/C ending {#var#}. Meridian Finserv.", dlt: "1107161234567891", status: "approved" },
  { name: "diwali_festive_offer", cat: "promotional", body: "Special Festive Offer! Get instant personal loans up to Rs 5 Lakhs at 10.5% interest. Apply now on Meridian App.", dlt: "1107161234567892", status: "submitted" },
  { name: "order_delivered_rcs", cat: "service", body: "Your order #{#var#} has been delivered. Rate your delivery partner here: {#var#}", dlt: "1107161234567893", status: "approved" },
  { name: "emi_payment_reminder", cat: "service", body: "Reminder: Your EMI of Rs {#var#} is due on {#var#}. Avoid late fees by paying via UPI: {#var#}", dlt: "1107161234567894", status: "approved" },
  { name: "password_reset_code", cat: "otp", body: "Your security OTP to reset password is {#var#}. Do not disclose to anyone. PayVantage.", dlt: "1107161234567895", status: "approved" },
  { name: "kyc_status_update", cat: "transactional", body: "Dear customer, your KYC verification status is {#var#}. Visit {#var#} to complete required actions.", dlt: "1107161234567896", status: "in_review" },
  { name: "flight_web_checkin", cat: "service", body: "Web check-in for flight {#var#} is now open. Confirm your seats at {#var#}. YatraWings.", dlt: "1107161234567897", status: "approved" },
];

sampleTemplates.forEach((t, idx) => {
  insertTemplate.run(
    `tmpl_${idx + 101}`,
    idx < 3 ? meridianCoreWs.id : workspacesList[idx].id,
    t.name,
    t.cat,
    t.body,
    t.dlt,
    t.status,
    nowSeconds - randomInt(4, 30) * 86400
  );
});

// ---------------------------------------------------------------------------
// 17. Change Requests (3 pending dual-approvals so approvals queue isn't empty)
// ---------------------------------------------------------------------------
const insertChangeReq = sqlite.prepare(`
  INSERT INTO change_requests (
    id, type, target_type, target_id, payload, status, requested_by, approver_role_needed, approved_by, reason, decision_note, created_at, decided_at, expires_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const fintrackWs = workspacesList.find((w) => w.orgId === "org_fintrack")!;

// 1. Credit Limit Raise: Meridian SME Credit from ₹25L to ₹45L
insertChangeReq.run(
  "cr_101",
  "credit_limit_increase",
  "workspace",
  meridianSmeWs.id,
  JSON.stringify({
    workspaceName: "Meridian SME Credit",
    currentCreditLimit: 2500000,
    requestedCreditLimit: 4500000,
    creditUsed: 2200000,
    increasePct: 80,
  }),
  "pending",
  "usr_am_rohan",
  "finance_head",
  null,
  "Meridian SME Credit has reached 88% credit utilization. Upcoming Diwali merchant advance campaigns will breach ceiling in 4 days. Requesting ₹45L limit hike.",
  null,
  nowSeconds - 1 * 86400,
  null,
  nowSeconds + 5 * 86400
);

// 2. Custom Discount: 15% discount for FinTrack Payments
insertChangeReq.run(
  "cr_102",
  "custom_discount",
  "workspace",
  fintrackWs.id,
  JSON.stringify({
    workspaceName: "FinTrack Lending",
    currentDiscountPct: 0,
    requestedDiscountPct: 15,
    projectedMonthlyVolume: 25000000,
  }),
  "pending",
  "usr_ops_amit",
  "finance",
  null,
  "Competitive defense against Exotel/Gupshup. Client promised 2.5 Crore monthly messaging commitment if 15% discount approved.",
  null,
  nowSeconds - 2 * 86400,
  null,
  nowSeconds + 4 * 86400
);

// 3. Account Suspension: QuickDrop Courier due to negative wallet balance
insertChangeReq.run(
  "cr_103",
  "account_suspension",
  "organization",
  "org_quickdrop",
  JSON.stringify({
    organizationName: "QuickDrop Courier",
    negativeBalance: -3450,
    unpaidInvoicesCount: 1,
  }),
  "pending",
  "usr_fin_vikram",
  "compliance",
  null,
  "Prepaid balance depleted and negative for 12 days. Client uncontactable on registered phone number.",
  null,
  nowSeconds - 12 * 3600,
  null,
  nowSeconds + 2 * 86400
);

// ---------------------------------------------------------------------------
// 18. Audit Log (~42 realistic entries with cryptographic hash chain)
// ---------------------------------------------------------------------------
const insertAuditLog = sqlite.prepare(`
  INSERT INTO audit_log (
    id, timestamp, actor_id, actor_role, action, target_type, target_id, org_id, before, after, reason, change_request_id, ai_assisted, ip, prev_hash, hash, is_denied
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function seedComputeAuditHash(
  prevHash: string,
  entry: {
    id: string;
    timestamp: number;
    actorId: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string;
    orgId?: string | null;
    before?: string | null;
    after?: string | null;
    reason: string;
    aiAssisted?: boolean | number;
    isDenied?: boolean | number;
  }
): string {
  const payload = [
    prevHash,
    entry.id,
    String(entry.timestamp),
    entry.actorId,
    entry.actorRole,
    entry.action,
    entry.targetType,
    entry.targetId,
    entry.orgId || "",
    entry.before || "",
    entry.after || "",
    entry.reason.trim(),
    entry.aiAssisted ? "1" : "0",
    entry.isDenied ? "1" : "0",
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}

const sampleAuditActions = [
  {
    action: "credit_limit_updated",
    type: "workspace",
    reason: "Annual enterprise contract renewal with 25% credit limit expansion",
    actor: "usr_fin_vikram",
    role: "finance",
    before: { creditLimit: 2000000, creditUsed: 1450000 },
    after: { creditLimit: 2500000, creditUsed: 1450000 },
    isDenied: 0,
  },
  {
    action: "kyc_document_verified",
    type: "workspace",
    reason: "Verified Certificate of Incorporation against Ministry of Corporate Affairs portal",
    actor: "usr_comp_kavita",
    role: "compliance",
    before: { kycStatus: "in_review", verifiedAt: null },
    after: { kycStatus: "approved", verifiedAt: "2026-10-28T10:00:00Z" },
    isDenied: 0,
  },
  {
    action: "plan_upgraded",
    type: "organization",
    reason: "Customer upgraded from Growth to Scale for higher throughput",
    actor: "usr_ops_amit",
    role: "sales_ops",
    before: { plan: "Starter", mps: 50 },
    after: { plan: "Scale", mps: 200 },
    isDenied: 0,
  },
  {
    action: "sender_id_approved",
    type: "workspace",
    reason: "DLT Principal Entity header verified on Airtel circle",
    actor: "usr_comp_suresh",
    role: "compliance",
    before: { status: "submitted" },
    after: { status: "approved" },
    isDenied: 0,
  },
  {
    action: "unauthorized_discount_override_denied",
    type: "organization",
    reason: "AM attempted 22% discount without Sales Ops Manager dual approval. Policy blocked mutation.",
    actor: "usr_am_priya",
    role: "account_manager",
    before: { discountPct: 0 },
    after: { error: "Maker-Checker Guard: Discount exceeds 10% maximum self-approval threshold" },
    isDenied: 1,
  },
  {
    action: "invoice_issued",
    type: "workspace",
    reason: "Monthly automated postpaid billing batch run for September consumption",
    actor: "usr_fin_sneha",
    role: "finance",
    before: { draftStatus: "draft" },
    after: { draftStatus: "issued", totalAmount: 476594 },
    isDenied: 0,
  },
  {
    action: "seat_count_adjusted",
    type: "workspace",
    reason: "Deactivated 3 unused developer seats upon customer request",
    actor: "usr_sup_rahul",
    role: "support",
    before: { activeSeats: 12 },
    after: { activeSeats: 9 },
    isDenied: 0,
  },
  {
    action: "custom_rate_card_applied",
    type: "workspace",
    reason: "Approved bulk SMS rate discount of 2 paise per message for high volume commitment",
    actor: "usr_ops_divya",
    role: "sales_ops",
    before: { smsRate: 0.14 },
    after: { smsRate: 0.12 },
    isDenied: 0,
  },
  {
    action: "unauthorized_credit_hike_denied",
    type: "workspace",
    reason: "Attempted credit hike of ₹8,00,000 on account with active overdue invoice. Maker-checker blocked.",
    actor: "usr_am_rohan",
    role: "account_manager",
    before: { creditLimit: 2500000 },
    after: { error: "Overdue Invoice Guard: Accounts with unpaid past-due invoices require Finance Head authorization" },
    isDenied: 1,
  },
  {
    action: "ticket_escalated",
    type: "organization",
    reason: "Urgent delivery drop ticket escalated to Tier 3 telecom NOC",
    actor: "usr_sup_pooja",
    role: "support",
    before: { priority: "medium", tier: 1 },
    after: { priority: "critical", tier: 3 },
    isDenied: 0,
  },
];

let runningPrevHash = "0000000000000000000000000000000000000000000000000000000000000000";

for (let aIdx = 0; aIdx < 42; aIdx++) {
  const item = sampleAuditActions[aIdx % sampleAuditActions.length];
  const targetWs = workspacesList[aIdx % workspacesList.length];
  const ts = nowSeconds - (42 - aIdx) * 18 * 3600;
  const id = `aud_${1000 + aIdx}`;
  const reason = aIdx === 0 ? "Initial system onboarding configuration audit baseline" : item.reason;
  const aiAssisted = aIdx % 5 === 0 ? 1 : 0;
  const isDenied = item.isDenied ? 1 : 0;
  const beforeStr = JSON.stringify(item.before);
  const afterStr = JSON.stringify(item.after);
  const ip = `10.14.0.${20 + (aIdx % 50)}`;

  const currentHash = seedComputeAuditHash(runningPrevHash, {
    id,
    timestamp: ts,
    actorId: item.actor,
    actorRole: item.role,
    action: item.action,
    targetType: item.type,
    targetId: targetWs.id,
    orgId: targetWs.orgId,
    before: beforeStr,
    after: afterStr,
    reason,
    aiAssisted,
    isDenied,
  });

  insertAuditLog.run(
    id,
    ts,
    item.actor,
    item.role,
    item.action,
    item.type,
    targetWs.id,
    targetWs.orgId,
    beforeStr,
    afterStr,
    reason,
    null,
    aiAssisted,
    ip,
    runningPrevHash,
    currentHash,
    isDenied
  );

  runningPrevHash = currentHash;
}

// ---------------------------------------------------------------------------
// 19. AI Runs & Tasks
// ---------------------------------------------------------------------------
const insertAiRun = sqlite.prepare(`
  INSERT INTO ai_runs (id, feature, user_id, input_hash, output, model, latency_ms, status, accepted, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertAiRun.run(
  "air_101",
  "health_summary",
  "usr_am_rohan",
  "hash_meridian_summary",
  JSON.stringify({
    summary: "Meridian Finserv shows significant churn risk (-36% usage drop) and high credit ceiling risk (88% on SME credit). Recommended immediate AM escalation.",
    confidence: 0.94,
  }),
  "gemini-2.5-flash",
  840,
  "success",
  1,
  nowSeconds - 2 * 86400
);

insertAiRun.run(
  "air_102",
  "churn_prediction",
  "usr_am_priya",
  "hash_churn_batch",
  JSON.stringify({
    highRiskOrgs: ["org_meridian_finserv", "org_kubermf", "org_swiftcargo", "org_gurukuled", "org_flyocean"],
    avgDropPct: 34.2,
  }),
  "gemini-2.5-flash",
  1250,
  "success",
  1,
  nowSeconds - 1 * 86400
);

const insertTask = sqlite.prepare(`
  INSERT INTO tasks (id, org_id, assigned_to, title, source, status, due_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertTask.run(
  "tsk_101",
  "org_meridian_finserv",
  "usr_am_rohan",
  "Conduct Quarterly Health Review with CFO regarding 36% volume drop",
  "ai_recommendation",
  "pending",
  nowSeconds + 3 * 86400
);

insertTask.run(
  "tsk_102",
  "org_meridian_finserv",
  "usr_fin_vikram",
  "Follow up on 38-day overdue invoice #INV-1001 (Rs. 4.85L)",
  "manual",
  "in_progress",
  nowSeconds + 1 * 86400
);

insertTask.run(
  "tsk_103",
  "org_zenithlogistics",
  "usr_comp_suresh",
  "Request corrected Certificate of Incorporation matching declared legal name",
  "manual",
  "pending",
  nowSeconds + 2 * 86400
);

// ---------------------------------------------------------------------------
// 20. Approval Policies (Maker-Checker Rules Table)
// ---------------------------------------------------------------------------
const insertPolicy = sqlite.prepare(`
  INSERT INTO approval_policies (
    id, name, description, action_type, threshold_type, threshold_value, approver_role, is_active
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

insertPolicy.run(
  "pol_credit_limit_amount",
  "Credit Limit Hike > ₹5,00,000",
  "Any postpaid credit limit increase exceeding ₹5,00,000 requires Finance Head second-level review.",
  "credit_limit_increase",
  "amount",
  500000,
  "finance_head",
  1
);

insertPolicy.run(
  "pol_credit_limit_pct",
  "Credit Limit Hike > 25%",
  "Any credit limit increase exceeding 25% of the current active limit requires Finance Head approval.",
  "credit_limit_increase",
  "percentage",
  25,
  "finance_head",
  1
);

insertPolicy.run(
  "pol_credit_overdue_invoice",
  "Credit Limit Hike with Overdue Invoices",
  "Any credit limit increase for an organization with overdue invoices requires Finance Head sign-off, regardless of amount.",
  "credit_limit_increase",
  "condition",
  0,
  "finance_head",
  1
);

insertPolicy.run(
  "pol_wallet_adjustment",
  "Manual Wallet Adjustment > ₹50,000",
  "Manual credits or debits exceeding ₹50,000 to prevent internal ledger drift require Finance Head approval.",
  "wallet_adjustment",
  "amount",
  50000,
  "finance_head",
  1
);

insertPolicy.run(
  "pol_discount_pct",
  "Discount > 15% or Sub-Floor Rates",
  "Discounts exceeding 15% or custom per-message rate overrides below plan floor require Admin approval.",
  "custom_discount",
  "percentage",
  15,
  "admin",
  1
);

insertPolicy.run(
  "pol_suspension_postpaid_due",
  "Postpaid Account Suspension with Outstanding Dues",
  "Suspending a postpaid account with unpaid/overdue invoices requires Finance Head confirmation.",
  "account_suspension",
  "condition",
  0,
  "finance_head",
  1
);

insertPolicy.run(
  "pol_offboarding",
  "Organization Offboarding & Data Deletion",
  "Customer offboarding, contract termination, and workspace deletion always require Admin approval.",
  "account_offboarding",
  "boolean",
  1,
  "admin",
  1
);

insertPolicy.run(
  "pol_kyc_approval",
  "KYC & DLT Sender-ID Verification",
  "KYC records and TRAI DLT sender IDs require Compliance approval. The submitter cannot approve.",
  "kyc_approval",
  "condition",
  0,
  "compliance",
  1
);

// ---------------------------------------------------------------------------
// 19.5 Seed Proactive System & Risk Alerts
// ---------------------------------------------------------------------------
const insertAlert = sqlite.prepare(`
  INSERT INTO alerts (id, workspace_id, org_id, type, severity, title, message, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

insertAlert.run(
  "alt_hero_meridian_util",
  "ws_meridian_finserv_sme",
  "org_meridian_finserv",
  "credit_utilization_80",
  "warning",
  "Credit Warning: Meridian SME Credit crossed 88%",
  "Workspace utilized ₹22,00,000 of ₹25,00,000 (88%). Dispatches will throttle at 100%. Consider proactive credit expansion.",
  nowSeconds - 14400
);

insertAlert.run(
  "alt_hero_zippymart_lowbal",
  "ws_zippymart_core",
  "org_zippymart",
  "prepaid_low_balance",
  "warning",
  "Low Wallet Runway: ZippyMart Hyperlocal",
  "Prepaid balance is ₹105 (less than 1 day of cover based on 14-day EWMA burn of ₹18,450/day). Immediate top-up recommended.",
  nowSeconds - 28800
);

insertAlert.run(
  "alt_hero_overdue_meridian",
  "ws_meridian_finserv_sme",
  "org_meridian_finserv",
  "invoice_overdue_30",
  "critical",
  "Collections Alert: ₹4,76,594 Overdue for Meridian Finserv",
  "Invoice inv_1003 is overdue by 12 days. High risk flag raised under collections protocol.",
  nowSeconds - 86400
);

// ---------------------------------------------------------------------------
// 20. Print Rich Summary & Verify Hero Scenarios
// ---------------------------------------------------------------------------
const countOrgs = (sqlite.prepare("SELECT COUNT(*) as c FROM organizations").get() as any).c;
const countPrepaid = (sqlite.prepare("SELECT COUNT(*) as c FROM organizations WHERE billing_model = 'prepaid'").get() as any).c;
const countPostpaid = (sqlite.prepare("SELECT COUNT(*) as c FROM organizations WHERE billing_model = 'postpaid'").get() as any).c;
const countWorkspaces = (sqlite.prepare("SELECT COUNT(*) as c FROM workspaces").get() as any).c;
const countUsers = (sqlite.prepare("SELECT COUNT(*) as c FROM workspace_users").get() as any).c;
const countUsageRows = (sqlite.prepare("SELECT COUNT(*) as c FROM usage_daily").get() as any).c;
const countInvoices = (sqlite.prepare("SELECT COUNT(*) as c FROM invoices").get() as any).c;
const countOverdueInv = (sqlite.prepare("SELECT COUNT(*) as c FROM invoices WHERE status = 'overdue'").get() as any).c;
const countDisputedInv = (sqlite.prepare("SELECT COUNT(*) as c FROM invoices WHERE status = 'disputed'").get() as any).c;
const countTickets = (sqlite.prepare("SELECT COUNT(*) as c FROM tickets").get() as any).c;
const countKyc = (sqlite.prepare("SELECT COUNT(*) as c FROM kyc_cases").get() as any).c;
const countSenderIds = (sqlite.prepare("SELECT COUNT(*) as c FROM sender_ids").get() as any).c;
const countTemplates = (sqlite.prepare("SELECT COUNT(*) as c FROM templates").get() as any).c;
const countChangeRequests = (sqlite.prepare("SELECT COUNT(*) as c FROM change_requests WHERE status = 'pending'").get() as any).c;
const countAuditLogs = (sqlite.prepare("SELECT COUNT(*) as c FROM audit_log").get() as any).c;

console.log("\n==========================================================================");
console.log("                  RELAY BMP DATABASE SEED SUMMARY                         ");
console.log("==========================================================================");
console.log(`🏢 Organizations total:         ${countOrgs} (Prepaid: ${countPrepaid}, Postpaid: ${countPostpaid})`);
console.log(`🌐 Workspaces total:            ${countWorkspaces}`);
console.log(`👥 Workspace Users total:       ${countUsers}`);
console.log(`📈 90-Day Usage Daily rows:     ${countUsageRows}`);
console.log(`🧾 Invoices total:              ${countInvoices} (Overdue: ${countOverdueInv}, Disputed: ${countDisputedInv})`);
console.log(`🎫 Support Tickets:             ${countTickets}`);
console.log(`📋 KYC Cases:                   ${countKyc}`);
console.log(`✉️  Sender IDs:                  ${countSenderIds}`);
console.log(`📝 Templates:                   ${countTemplates}`);
console.log(`⚖️  Pending Change Requests:     ${countChangeRequests}`);
console.log(`📜 Audit Log entries:           ${countAuditLogs}`);
console.log("==========================================================================\n");

// Verify Hero Scenarios
console.log("🔍 Verifying Hero Scenarios:");
const hero = sqlite.prepare("SELECT * FROM organizations WHERE id = 'org_meridian_finserv'").get() as any;
const heroWs = sqlite.prepare("SELECT * FROM workspaces WHERE org_id = 'org_meridian_finserv'").all() as any[];
const heroOverdue = sqlite.prepare("SELECT * FROM invoices WHERE workspace_id IN (SELECT id FROM workspaces WHERE org_id = 'org_meridian_finserv') AND status = 'overdue'").all() as any[];
const heroSender = sqlite.prepare("SELECT * FROM sender_ids WHERE workspace_id IN (SELECT id FROM workspaces WHERE org_id = 'org_meridian_finserv') AND header = 'MRDFIN'").get() as any;
const smeWs = heroWs.find((w: any) => w.id.includes("sme"));

console.log(`  ✓ Hero Organization: '${hero.name}' (${hero.legal_name})`);
console.log(`  ✓ Workspaces count: ${heroWs.length}`);
console.log(`  ✓ SME Workspace Credit Used: ₹${smeWs.credit_used.toLocaleString("en-IN")} / ₹${smeWs.credit_limit.toLocaleString("en-IN")} (${Math.round((smeWs.credit_used / smeWs.credit_limit) * 100)}% utilization)`);
console.log(`  ✓ Hero Overdue Invoices: ${heroOverdue.length} (${heroOverdue[0]?.id}, Period: ${heroOverdue[0]?.period})`);
console.log(`  ✓ Hero Breached Sender ID: ${heroSender?.header} (${heroSender?.status}, submitted ${Math.round((nowSeconds - heroSender?.submitted_at) / 86400)} days ago)`);

sqlite.close();
console.log("\n✅ Relay BMP Database seeded and verified successfully!");
