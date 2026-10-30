import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const dbPath = process.env.DATABASE_URL
  ? path.resolve(process.cwd(), process.env.DATABASE_URL)
  : path.resolve(process.cwd(), "relay.db");

const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = OFF");

console.log("🌱 Starting Relay Developer Hub database migration & seed...");
console.log("📍 Target SQLite database:", dbPath);

// ---------------------------------------------------------------------------
// 1. Drop existing tables
// ---------------------------------------------------------------------------
const tablesToDrop = [
  "known_issues",
  "incidents",
  "ai_runs",
  "limit_requests",
  "usage_alert_preferences",
  "solutions_inquiries",
  "doc_feedback",
  "changelog_subscriptions",
  "doc_chunks",
  "support_threads",
  "api_versions",
  "changelog_entries",
  "events_ingested",
  "events_log",
  "customers_profiles",
  "customer_profiles",
  "messages",
  "api_requests",
  "webhook_deliveries",
  "webhook_events",
  "webhook_endpoints",
  "api_key_audit_logs",
  "api_keys",
  "sessions",
  "users",
  // Legacy / internal BMP tables
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
];

for (const t of tablesToDrop) {
  sqlite.exec(`DROP TABLE IF EXISTS ${t};`);
}

// ---------------------------------------------------------------------------
// 2. Create Schema for Developer Hub & Core Operations
// ---------------------------------------------------------------------------
sqlite.exec(`
  -- Users
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    company TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Backend dev',
    intent TEXT NOT NULL DEFAULT 'Evaluating Relay',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Internal Users (for employee/admin references)
  CREATE TABLE internal_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#7C7CFF',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Pricing Plans
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

  -- Organizations
  CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT NOT NULL DEFAULT '',
    slug TEXT NOT NULL UNIQUE,
    industry TEXT NOT NULL DEFAULT 'Fintech',
    city TEXT NOT NULL DEFAULT 'Bengaluru',
    owner_am_id TEXT NOT NULL DEFAULT 'usr_priya_sharma',
    status TEXT NOT NULL DEFAULT 'active',
    billing_model TEXT NOT NULL DEFAULT 'prepaid',
    plan_id TEXT NOT NULL DEFAULT 'plan_starter',
    contract_start INTEGER,
    contract_end INTEGER,
    tags TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Workspaces
  CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id TEXT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    kyc_status TEXT NOT NULL DEFAULT 'not_started',
    sender_ids TEXT NOT NULL DEFAULT '[]',
    plan_tier TEXT NOT NULL DEFAULT 'sandbox',
    rate_limit_per_min INTEGER NOT NULL DEFAULT 60,
    monthly_quota INTEGER NOT NULL DEFAULT 10000,
    wallet_balance REAL NOT NULL DEFAULT 0,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER,
    gstin TEXT NOT NULL DEFAULT '29ABCDE1234F1Z5',
    billing_state TEXT NOT NULL DEFAULT 'Karnataka',
    credit_limit REAL NOT NULL DEFAULT 0,
    credit_used REAL NOT NULL DEFAULT 0,
    receiver_behavior TEXT NOT NULL DEFAULT '200',
    acceleration_factor INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Sessions
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- API Keys
  CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    hashed_secret TEXT NOT NULL,
    secret_masked TEXT NOT NULL,
    full_key_for_dev TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'test',
    scopes TEXT NOT NULL DEFAULT '["messages:send","events:write","profiles:read"]',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_used_at INTEGER,
    expires_at INTEGER,
    rotated_from_id TEXT,
    grace_period_ends_at INTEGER,
    ip_allowlist TEXT,
    created_by TEXT
  );

  -- API Key Audit Logs
  CREATE TABLE api_key_audit_logs (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'developer',
    details TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Webhook Endpoints
  CREATE TABLE webhook_endpoints (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'test',
    events TEXT NOT NULL DEFAULT '["message.delivered","message.failed"]',
    signing_secret TEXT NOT NULL,
    previous_signing_secret TEXT,
    secret_rotation_ends_at INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    api_version TEXT NOT NULL DEFAULT 'v2025-10-01',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    consecutive_failures INTEGER NOT NULL DEFAULT 0
  );

  -- Webhook Events
  CREATE TABLE webhook_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    api_version TEXT NOT NULL DEFAULT 'v2025-10-01'
  );

  -- Webhook Deliveries
  CREATE TABLE webhook_deliveries (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
    endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    request_headers TEXT NOT NULL DEFAULT '{}',
    request_body TEXT NOT NULL,
    response_status INTEGER,
    response_headers TEXT,
    response_body TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 100,
    error_type TEXT NOT NULL DEFAULT 'none',
    status TEXT NOT NULL DEFAULT 'success',
    scheduled_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    attempted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    next_retry_at INTEGER,
    replay_of_id TEXT
  );

  -- API Requests
  CREATE TABLE api_requests (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    key_id TEXT,
    environment TEXT NOT NULL DEFAULT 'test',
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 45,
    request_headers TEXT,
    request_body TEXT,
    response_body TEXT,
    idempotency_key TEXT,
    error_code TEXT,
    request_id TEXT NOT NULL,
    billed_amount_would_be REAL NOT NULL DEFAULT 0,
    billed_amount_actual REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    api_version TEXT NOT NULL DEFAULT 'v2025-10-01',
    ip TEXT NOT NULL DEFAULT '127.0.0.1'
  );

  -- Messages
  CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    environment TEXT NOT NULL DEFAULT 'test',
    channel TEXT NOT NULL,
    "to" TEXT NOT NULL,
    recipient TEXT,
    sender_id TEXT NOT NULL DEFAULT 'RELAYI',
    template_id TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'delivered',
    failure_reason TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    delivered_at INTEGER,
    external_ref TEXT,
    cost_would_be REAL NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0
  );

  -- Customer Profiles (CDP)
  CREATE TABLE customers_profiles (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    environment TEXT NOT NULL DEFAULT 'test',
    external_id TEXT NOT NULL,
    attributes TEXT NOT NULL DEFAULT '{}',
    traits TEXT NOT NULL DEFAULT '{}',
    events_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Events Ingested
  CREATE TABLE events_ingested (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    environment TEXT NOT NULL DEFAULT 'test',
    customer_id TEXT REFERENCES customers_profiles(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}',
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Changelog Entries
  CREATE TABLE changelog_entries (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    affected_endpoints TEXT NOT NULL DEFAULT '[]',
    breaking INTEGER NOT NULL DEFAULT 0,
    sunset_date TEXT
  );

  -- API Versions
  CREATE TABLE api_versions (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'supported',
    released_at TEXT NOT NULL,
    sunset_at TEXT
  );

  -- Support Threads
  CREATE TABLE support_threads (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    context TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    messages TEXT NOT NULL DEFAULT '[]'
  );

  -- Doc Chunks
  CREATE TABLE doc_chunks (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    section TEXT NOT NULL,
    content TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'v2025-10-01'
  );

  -- Doc Feedback
  CREATE TABLE doc_feedback (
    id TEXT PRIMARY KEY,
    page_path TEXT NOT NULL,
    helpful INTEGER NOT NULL,
    comment TEXT,
    version TEXT NOT NULL DEFAULT 'v2025-10-01',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Changelog Subscriptions
  CREATE TABLE changelog_subscriptions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    subscribed_breaking_changes INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Solutions Inquiries
  CREATE TABLE solutions_inquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT NOT NULL,
    monthly_volume TEXT NOT NULL,
    channels TEXT,
    use_case TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Usage Alert Preferences
  CREATE TABLE usage_alert_preferences (
    workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    threshold_80 INTEGER NOT NULL DEFAULT 1,
    threshold_95 INTEGER NOT NULL DEFAULT 1,
    spike_429 INTEGER NOT NULL DEFAULT 1,
    low_balance_threshold REAL NOT NULL DEFAULT 500,
    email_notifications INTEGER NOT NULL DEFAULT 1,
    notification_email TEXT,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Limit Requests
  CREATE TABLE limit_requests (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    current_tier TEXT NOT NULL,
    requested_tps INTEGER NOT NULL,
    reason TEXT NOT NULL,
    channels TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Alerts & Notifications
  CREATE TABLE alerts (
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

  -- AI Runs Telemetry
  CREATE TABLE ai_runs (
    id TEXT PRIMARY KEY,
    feature TEXT NOT NULL,
    user_id TEXT,
    workspace_id TEXT,
    input_hash TEXT NOT NULL,
    output TEXT NOT NULL,
    model TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    accepted INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- System Incidents
  CREATE TABLE incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'resolved',
    impact TEXT NOT NULL DEFAULT 'none',
    affected_components TEXT NOT NULL DEFAULT '[]',
    updates TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    resolved_at INTEGER
  );

  -- Known Issues
  CREATE TABLE known_issues (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    component TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'workaround_available',
    description TEXT NOT NULL,
    workaround TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  -- Indexes for high-throughput lookups
  CREATE INDEX idx_users_email ON users(email);
  CREATE INDEX idx_sessions_user ON sessions(user_id);
  CREATE INDEX idx_sessions_ws ON sessions(workspace_id);
  CREATE INDEX idx_workspaces_org ON workspaces(org_id);
  CREATE INDEX idx_api_keys_ws ON api_keys(workspace_id);
  CREATE INDEX idx_wh_endpoints_ws ON webhook_endpoints(workspace_id);
  CREATE INDEX idx_wh_deliveries_ws ON webhook_deliveries(workspace_id);
  CREATE INDEX idx_api_requests_ws ON api_requests(workspace_id);
  CREATE INDEX idx_api_requests_created ON api_requests(created_at);
  CREATE INDEX idx_messages_ws ON messages(workspace_id);
  CREATE INDEX idx_profiles_ws ON customers_profiles(workspace_id);
  CREATE INDEX idx_events_ws ON events_ingested(workspace_id);
`);

console.log("✅ Schema created with all developer hub tables and indexes.");

// ---------------------------------------------------------------------------
// 3. Seed Base Catalogs (Internal users, Plans, API Versions)
// ---------------------------------------------------------------------------
sqlite.exec(`
  INSERT INTO internal_users (id, name, email, role, avatar_color) VALUES
  ('usr_priya_sharma', 'Priya Sharma', 'priya.sharma@relay.internal', 'account_manager', '#7C7CFF'),
  ('usr_rohit_verma', 'Rohit Verma', 'rohit.verma@relay.internal', 'compliance', '#3FB68B'),
  ('usr_arjun_nair', 'Arjun Nair', 'arjun.nair@relay.internal', 'support', '#5B9DFF');

  INSERT INTO plans (id, name, billing_model, base_fee_monthly, included_seats, per_message_rates, throughput_mps, features) VALUES
  ('plan_starter', 'Starter Developer', 'both', 0, 3, '{"sms":0.12,"rcs":0.20,"whatsapp":0.35}', 50, '["sandbox_access","community_support","webhook_logs"]'),
  ('plan_growth', 'Growth', 'both', 4999, 10, '{"sms":0.11,"rcs":0.18,"whatsapp":0.32}', 250, '["sla_99_9","priority_support","cdp_ingestion"]'),
  ('plan_enterprise', 'Enterprise Scale', 'postpaid', 24999, 50, '{"sms":0.10,"rcs":0.15,"whatsapp":0.30}', 5000, '["dedicated_am","custom_smpp_tps","unlimited_retries"]');

  INSERT INTO api_versions (id, label, status, released_at, sunset_at) VALUES
  ('v2025-10-01', 'v2025-10-01 (Current GA)', 'current', '2026-10-01', NULL),
  ('v2025-01-15', 'v2025-01-15 (Supported)', 'supported', '2025-01-15', NULL),
  ('v2024-06-01', 'v2024-06-01 (Deprecated)', 'deprecated', '2024-06-01', '2027-06-01');
`);

// ---------------------------------------------------------------------------
// 4. Seed Demo Account (AcmePay Technologies)
// ---------------------------------------------------------------------------
const demoPasswordHash = bcrypt.hashSync("demo1234", 10);
const nowEpoch = Math.floor(Date.now() / 1000);

const insertUser = sqlite.prepare(`
  INSERT INTO users (id, name, email, password_hash, company, role, intent, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

insertUser.run(
  "usr_acmepay_demo",
  "Aditya Roy",
  "demo@acmepay.in",
  demoPasswordHash,
  "AcmePay Technologies",
  "Backend dev",
  "Evaluating Relay",
  nowEpoch - 86400 * 3
);

sqlite.exec(`
  INSERT INTO organizations (id, name, legal_name, slug, industry, city, owner_am_id, status, billing_model, plan_id, created_at)
  VALUES ('org_acmepay', 'AcmePay Technologies', 'AcmePay Technologies Private Limited', 'acmepay-tech', 'Fintech', 'Bengaluru', 'usr_priya_sharma', 'active', 'prepaid', 'plan_starter', ${nowEpoch - 86400 * 3});

  INSERT INTO workspaces (id, org_id, organization_id, name, slug, status, kyc_status, sender_ids, plan_tier, rate_limit_per_min, monthly_quota, wallet_balance, is_anonymous, gstin, billing_state, created_at)
  VALUES ('ws_acmepay_prod', 'org_acmepay', 'org_acmepay', 'AcmePay Production', 'acmepay-prod', 'kyc_pending', 'in_review', '["ACMEPY","RELAYI"]', 'growth', 120, 25000, 1250.00, 0, '29AABCA1234F1Z5', 'Karnataka', ${nowEpoch - 86400 * 3});

  INSERT INTO usage_alert_preferences (workspace_id, threshold_80, threshold_95, spike_429, low_balance_threshold, email_notifications, notification_email, updated_at)
  VALUES ('ws_acmepay_prod', 1, 1, 1, 500.0, 1, 'alerts@acmepay.in', ${nowEpoch - 86400});
`);

// Seed API Keys: 1 Test Key, 1 Live Key (Locked due to kyc_status: in_review)
const testKeyRaw = "rk_test_acmepay_9fa1b2e84c302948";
const testKeyHash = crypto.createHash("sha256").update(testKeyRaw).digest("hex");
const liveKeyRaw = "rk_live_acmepay_72bc910a3948bf82";
const liveKeyHash = crypto.createHash("sha256").update(liveKeyRaw).digest("hex");

sqlite.exec(`
  INSERT INTO api_keys (id, workspace_id, name, prefix, hashed_secret, secret_masked, full_key_for_dev, environment, scopes, status, created_at, last_used_at, created_by)
  VALUES
  ('key_test_acmepay_default', 'ws_acmepay_prod', 'Default Sandbox Key', 'rk_test_', '${testKeyHash}', 'rk_test_••••••••••••9fa1', '${testKeyRaw}', 'test', '["messages:send","events:write","profiles:read"]', 'active', ${nowEpoch - 86400 * 3}, ${nowEpoch - 300}, 'usr_acmepay_demo'),
  ('key_live_acmepay_primary', 'ws_acmepay_prod', 'Primary Production Key (Locked)', 'rk_live_', '${liveKeyHash}', 'rk_live_••••••••••••72bc', '${liveKeyRaw}', 'live', '["messages:send","events:write","profiles:read"]', 'active', ${nowEpoch - 86400 * 2}, NULL, 'usr_acmepay_demo');

  INSERT INTO api_key_audit_logs (id, key_id, workspace_id, action, actor, details, created_at)
  VALUES
  ('akal_test_01', 'key_test_acmepay_default', 'ws_acmepay_prod', 'created', 'Aditya Roy (demo@acmepay.in)', '{"scopes":["messages:send","events:write","profiles:read"],"preset":"Default"}', ${nowEpoch - 86400 * 3}),
  ('akal_live_01', 'key_live_acmepay_primary', 'ws_acmepay_prod', 'created', 'Aditya Roy (demo@acmepay.in)', '{"scopes":["messages:send","events:write","profiles:read"],"preset":"Default"}', ${nowEpoch - 86400 * 2});
`);

console.log("✅ Seeded demo user 'demo@acmepay.in', organization, workspace, and API keys.");

// ---------------------------------------------------------------------------
// 5. Seed Pre-loaded Webhook Endpoints & The Two Debuggable Failures
// ---------------------------------------------------------------------------
// Endpoint 1: message.delivered failing with 500 stack trace (due to null failure_reason)
const ep1Secret = "whsec_acmepay_hooks_a8912b";
// Endpoint 2: customer.profile.updated failing with 401 signature rejection
const ep2Secret = "whsec_acmepay_live_9fa1b2e84c302948";
// Endpoint 3: healthy delivery endpoint
const ep3Secret = "whsec_acmepay_events_healthy";

sqlite.exec(`
  INSERT INTO webhook_endpoints (id, workspace_id, url, environment, events, signing_secret, status, api_version, created_at, consecutive_failures) VALUES
  ('wh_ep_acmepay_messages', 'ws_acmepay_prod', 'https://api.acmepay.in/hooks/relay', 'test', '["message.delivered","message.failed"]', '${ep1Secret}', 'failing', 'v2025-10-01', ${nowEpoch - 86400 * 2}, 3),
  ('wh_ep_acmepay_profiles', 'ws_acmepay_prod', 'https://hooks.acmepay.in/relay', 'test', '["customer.profile.updated"]', '${ep2Secret}', 'failing', 'v2025-10-01', ${nowEpoch - 86400 * 2}, 5),
  ('wh_ep_acmepay_events', 'ws_acmepay_prod', 'https://events.acmepay.in/relay/ingest', 'test', '["event.ingested","message.queued"]', '${ep3Secret}', 'active', 'v2025-10-01', ${nowEpoch - 86400 * 3}, 0);
`);

// Failure Case 1: Null field crash (message.delivered with failure_reason: null)
const ep1Payload = JSON.stringify({
  event: "message.delivered",
  message_id: "msg_01JB9X7V2T4KZQ8M",
  channel: "sms",
  recipient: "+919876543210",
  sender_id: "ACMEPY",
  status: "delivered",
  delivered_at: "2026-10-29T20:10:00Z",
  carrier: "Bharti Airtel",
  circle: "Karnataka",
  failure_reason: null, // ROOT CAUSE: Customer server calls failure_reason.toString()
  metadata: {
    transaction_id: "txn_acmepay_9901",
    user_id: "usr_7718"
  }
});

const ep1StackTrace = `TypeError: Cannot read properties of null (reading 'toString')
    at PaymentHookHandler.handleDeliveryReceipt (src/webhooks/relay.ts:54:32)
    at Layer.handle [as handle_request] (node_modules/express/lib/router/layer.js:95:5)
    at next (node_modules/express/lib/router/route.js:144:13)
    at jsonParser (node_modules/body-parser/lib/types/json.js:110:7)
    at Layer.handle [as handle_request] (node_modules/express/lib/router/layer.js:95:5)`;

const ep1Timestamp = nowEpoch - 3600;
const ep1SignedString = `${ep1Timestamp}.${ep1Payload}`;
const ep1ValidHmac = crypto.createHmac("sha256", ep1Secret).update(ep1SignedString).digest("hex");
const ep1Headers = JSON.stringify({
  "content-type": "application/json",
  "relay-signature": `t=${ep1Timestamp},v1=${ep1ValidHmac}`,
  "user-agent": "Relay-Webhook-Dispatcher/2.0"
});

sqlite.exec(`
  INSERT INTO webhook_events (id, workspace_id, endpoint_id, type, payload, created_at, api_version)
  VALUES ('whevt_msg_deliv_01', 'ws_acmepay_prod', 'wh_ep_acmepay_messages', 'message.delivered', '${ep1Payload.replace(/'/g, "''")}', ${nowEpoch - 3600}, 'v2025-10-01');

  -- Attempt 1 (Failed 500)
  INSERT INTO webhook_deliveries (id, event_id, endpoint_id, workspace_id, attempt_number, request_headers, request_body, response_status, response_headers, response_body, duration_ms, error_type, status, scheduled_at, attempted_at, next_retry_at)
  VALUES ('del_ep1_att1', 'whevt_msg_deliv_01', 'wh_ep_acmepay_messages', 'ws_acmepay_prod', 1, '${ep1Headers.replace(/'/g, "''")}', '${ep1Payload.replace(/'/g, "''")}', 500, '{"content-type":"text/plain; charset=utf-8"}', '${ep1StackTrace.replace(/'/g, "''")}', 142, 'http_5xx', 'retrying', ${nowEpoch - 3600}, ${nowEpoch - 3599}, ${nowEpoch - 3300});

  -- Attempt 2 (Failed 500)
  INSERT INTO webhook_deliveries (id, event_id, endpoint_id, workspace_id, attempt_number, request_headers, request_body, response_status, response_headers, response_body, duration_ms, error_type, status, scheduled_at, attempted_at, next_retry_at)
  VALUES ('del_ep1_att2', 'whevt_msg_deliv_01', 'wh_ep_acmepay_messages', 'ws_acmepay_prod', 2, '${ep1Headers.replace(/'/g, "''")}', '${ep1Payload.replace(/'/g, "''")}', 500, '{"content-type":"text/plain; charset=utf-8"}', '${ep1StackTrace.replace(/'/g, "''")}', 138, 'http_5xx', 'retrying', ${nowEpoch - 3300}, ${nowEpoch - 3299}, ${nowEpoch - 1800});

  -- Attempt 3 (Failed 500 - currently scheduled for retry in 15 minutes)
  INSERT INTO webhook_deliveries (id, event_id, endpoint_id, workspace_id, attempt_number, request_headers, request_body, response_status, response_headers, response_body, duration_ms, error_type, status, scheduled_at, attempted_at, next_retry_at)
  VALUES ('del_ep1_att3', 'whevt_msg_deliv_01', 'wh_ep_acmepay_messages', 'ws_acmepay_prod', 3, '${ep1Headers.replace(/'/g, "''")}', '${ep1Payload.replace(/'/g, "''")}', 500, '{"content-type":"text/plain; charset=utf-8"}', '${ep1StackTrace.replace(/'/g, "''")}', 155, 'http_5xx', 'retrying', ${nowEpoch - 1800}, ${nowEpoch - 1799}, ${nowEpoch + 900});
`);

// Failure Case 2: Signature verification mismatch (Customer re-serialized body before verifying)
const ep2RawBody = JSON.stringify({
  event: "customer.profile.updated",
  profile_id: "prf_acme_9921",
  external_id: "cust_acmepay_7710",
  updated_fields: ["phone", "kyc_tier"],
  traits: {
    tier: "gold",
    kyc_verified: true,
    upi_vpa: "rahul@okaxis"
  },
  timestamp: "2026-10-29T18:45:00Z"
});

const ep2Timestamp = nowEpoch - 7200;
const ep2SignedString = `${ep2Timestamp}.${ep2RawBody}`;
const ep2ValidHmac = crypto.createHmac("sha256", ep2Secret).update(ep2SignedString).digest("hex");
const ep2Headers = JSON.stringify({
  "content-type": "application/json",
  "relay-signature": `t=${ep2Timestamp},v1=${ep2ValidHmac}`,
  "user-agent": "Relay-Webhook-Dispatcher/2.0"
});

const ep2ResponseBody = JSON.stringify({
  error: "Unauthorized",
  message: "invalid signature: calculated hash 7a8f90... does not match provided v1 header"
});

sqlite.exec(`
  INSERT INTO webhook_events (id, workspace_id, endpoint_id, type, payload, created_at, api_version)
  VALUES ('whevt_prof_upd_01', 'ws_acmepay_prod', 'wh_ep_acmepay_profiles', 'customer.profile.updated', '${ep2RawBody.replace(/'/g, "''")}', ${ep2Timestamp}, 'v2025-10-01');

  INSERT INTO webhook_deliveries (id, event_id, endpoint_id, workspace_id, attempt_number, request_headers, request_body, response_status, response_headers, response_body, duration_ms, error_type, status, scheduled_at, attempted_at, next_retry_at)
  VALUES ('del_ep2_att1', 'whevt_prof_upd_01', 'wh_ep_acmepay_profiles', 'ws_acmepay_prod', 1, '${ep2Headers.replace(/'/g, "''")}', '${ep2RawBody.replace(/'/g, "''")}', 401, '{"content-type":"application/json"}', '${ep2ResponseBody.replace(/'/g, "''")}', 92, 'signature_rejected', 'failed', ${ep2Timestamp}, ${ep2Timestamp + 1}, NULL);
`);

// Endpoint 3: 30 Healthy deliveries
const insertDelivery = sqlite.prepare(`
  INSERT INTO webhook_deliveries (id, event_id, endpoint_id, workspace_id, attempt_number, request_headers, request_body, response_status, response_headers, response_body, duration_ms, error_type, status, scheduled_at, attempted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertEvent = sqlite.prepare(`
  INSERT INTO webhook_events (id, workspace_id, endpoint_id, type, payload, created_at, api_version)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (let i = 1; i <= 30; i++) {
  const evtTime = nowEpoch - 86400 * 2 + i * 3600;
  const evtId = `whevt_healthy_${i}`;
  const delId = `del_healthy_${i}`;
  const payload = JSON.stringify({
    event: "message.queued",
    id: `msg_healthy_${i}`,
    status: "queued",
    seq: i,
    timestamp: new Date(evtTime * 1000).toISOString()
  });

  insertEvent.run(evtId, "ws_acmepay_prod", "wh_ep_acmepay_events", "message.queued", payload, evtTime, "v2025-10-01");
  insertDelivery.run(
    delId,
    evtId,
    "wh_ep_acmepay_events",
    "ws_acmepay_prod",
    1,
    JSON.stringify({ "content-type": "application/json" }),
    payload,
    200,
    JSON.stringify({ "content-type": "application/json" }),
    JSON.stringify({ success: true, processed_seq: i }),
    45 + (i % 25),
    "none",
    "success",
    evtTime,
    evtTime + 1
  );
}

console.log("✅ Seeded Webhook Endpoints with 2 debuggable failure scenarios & 30 healthy deliveries.");

// ---------------------------------------------------------------------------
// 6. Seed Customer Profiles (15) and CDP Ingested Events (60)
// ---------------------------------------------------------------------------
const profileStmt = sqlite.prepare(`
  INSERT INTO customers_profiles (id, workspace_id, environment, external_id, attributes, traits, events_count, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const eventStmt = sqlite.prepare(`
  INSERT INTO events_ingested (id, workspace_id, environment, customer_id, event_name, properties, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const firstNames = ["Aarav", "Priya", "Rahul", "Ananya", "Rohan", "Sneha", "Vikram", "Neha", "Aditya", "Tanvi", "Karan", "Pooja", "Arjun", "Meera", "Kabir"];
const cities = ["Bengaluru", "Mumbai", "Delhi-NCR", "Hyderabad", "Pune", "Chennai"];

for (let i = 0; i < 15; i++) {
  const profId = `prf_acme_${1000 + i}`;
  const extId = `cust_acmepay_${7700 + i}`;
  const name = `${firstNames[i]} Sharma`;
  const city = cities[i % cities.length];
  const ltv = 2500 + i * 3800;
  const createdAt = nowEpoch - 86400 * 5 + i * 1800;

  const attributes = JSON.stringify({
    name,
    email: `${firstNames[i].toLowerCase()}.${7700 + i}@gmail.com`,
    phone: `+9198765${String(10000 + i).slice(-5)}`,
    city
  });

  const traits = JSON.stringify({
    tier: i % 3 === 0 ? "platinum" : i % 2 === 0 ? "gold" : "silver",
    lifetime_value_inr: ltv,
    kyc_verified: i % 4 !== 0,
    preferred_channel: i % 3 === 0 ? "whatsapp" : "sms"
  });

  profileStmt.run(profId, "ws_acmepay_prod", "test", extId, attributes, traits, 4, createdAt, nowEpoch - 600);

  // Ingest 4 events per customer profile = 60 events total
  const eventTypes = ["user_signup", "kyc_submitted", "order_placed", "payment_completed"];
  for (let j = 0; j < 4; j++) {
    const evtId = `evt_acme_${1000 + i}_${j}`;
    const evtProps = JSON.stringify({
      order_id: `ord_${10000 + i * 4 + j}`,
      amount_inr: 499 + j * 750,
      channel: j % 2 === 0 ? "UPI" : "NetBanking",
      step: eventTypes[j]
    });
    const evtTime = createdAt + (j + 1) * 3600;
    eventStmt.run(evtId, "ws_acmepay_prod", "test", profId, eventTypes[j], evtProps, evtTime);
  }
}

console.log("✅ Seeded 15 Customer Profiles and 60 Ingested CDP Events.");

// ---------------------------------------------------------------------------
// 7. Seed Messages (40) Across SMS, RCS, WhatsApp and Various States
// ---------------------------------------------------------------------------
const messageStmt = sqlite.prepare(`
  INSERT INTO messages (id, workspace_id, environment, channel, "to", recipient, sender_id, template_id, body, status, failure_reason, created_at, updated_at, delivered_at, external_ref, cost_would_be, cost)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const channels = ["sms", "rcs", "whatsapp"] as const;
const msgStatuses = ["delivered", "delivered", "delivered", "read", "queued", "failed"] as const;

for (let i = 1; i <= 40; i++) {
  const msgId = `msg_acme_${String(i).padStart(4, "0")}`;
  const ch = channels[i % channels.length];
  const st = msgStatuses[i % msgStatuses.length];
  const phone = `+9198765${String(20000 + i).slice(-5)}`;
  const cost = ch === "whatsapp" ? 0.35 : ch === "rcs" ? 0.20 : 0.12;
  const msgTime = nowEpoch - 86400 * 3 + i * 6200;
  const isFailed = st === "failed";
  const failureReason = isFailed ? "TRAI DLT Template Variable length exceeded limit" : null;

  messageStmt.run(
    msgId,
    "ws_acmepay_prod",
    "test",
    ch,
    phone,
    phone,
    "ACMEPY",
    "dlt_tmpl_otp_login",
    `AcmePay: Your verification code is ${100000 + (i * 73) % 900000}. Valid for 10 mins.`,
    st,
    failureReason,
    msgTime,
    msgTime + 1,
    st === "delivered" || st === "read" ? msgTime + 1 : null,
    `ref_order_${9000 + i}`,
    cost,
    0
  );
}

console.log("✅ Seeded 40 Messages in various states (queued, delivered, failed, read).");

// ---------------------------------------------------------------------------
// 8. Seed API Requests (~200 requests spanning 3 days with realistic mix of HTTP codes)
// ---------------------------------------------------------------------------
const requestStmt = sqlite.prepare(`
  INSERT INTO api_requests (id, workspace_id, key_id, environment, method, path, status, duration_ms, request_headers, request_body, response_body, idempotency_key, error_code, request_id, billed_amount_would_be, billed_amount_actual, created_at, api_version, ip)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const paths = [
  "/v1/messages",
  "/v1/messages",
  "/v1/messages",
  "/v1/messages/msg_acme_0012",
  "/v1/events",
  "/v1/events",
  "/v1/profiles/cust_acmepay_7701",
  "/v1/channels"
];

for (let i = 1; i <= 200; i++) {
  const reqId = `req_01JB_${String(i).padStart(5, "0")}`;
  const reqTime = nowEpoch - 86400 * 3 + Math.floor((i / 200) * 86400 * 3);
  const path = paths[i % paths.length];
  const method = path.startsWith("/v1/messages/") || path.startsWith("/v1/profiles/") || path === "/v1/channels" ? "GET" : "POST";

  // Distribution: ~70% 200/202, ~8% 400, ~5% 401, ~9% 422, ~6% 429, ~2% 500
  let status = 200;
  let errorCode: string | null = null;
  let durationMs = 28 + (i % 60);

  if (i % 50 === 0) {
    status = 500;
    errorCode = "ERR_UPSTREAM_CARRIER_TIMEOUT";
    durationMs = 2800;
  } else if (i % 25 === 0) {
    status = 429;
    errorCode = "ERR_RATE_LIMIT_EXCEEDED";
    durationMs = 12;
  } else if (i % 15 === 0) {
    status = 422;
    errorCode = "ERR_DLT_TEMPLATE_MISMATCH";
    durationMs = 35;
  } else if (i % 18 === 0) {
    status = 401;
    errorCode = "ERR_INVALID_API_KEY";
    durationMs = 15;
  } else if (i % 12 === 0) {
    status = 400;
    errorCode = "ERR_MALFORMED_RECIPIENT";
    durationMs = 22;
  } else if (method === "POST" && path === "/v1/messages") {
    status = 202; // Queued
  }

  const reqBody = method === "POST"
    ? JSON.stringify({
        channel: "sms",
        recipient: "+919876543210",
        template_id: "dlt_tmpl_otp_login",
        body: `AcmePay OTP: ${100000 + i}. Do not share.`
      })
    : null;

  const respBody = status < 400
    ? JSON.stringify({ id: `msg_gen_${i}`, status: status === 202 ? "queued" : "delivered" })
    : JSON.stringify({ error: { code: errorCode, message: `Request failed with ${errorCode}` } });

  requestStmt.run(
    reqId,
    "ws_acmepay_prod",
    "key_test_acmepay_default",
    "test",
    method,
    path,
    status,
    durationMs,
    JSON.stringify({ "authorization": "Bearer rk_test_...", "content-type": "application/json" }),
    reqBody,
    respBody,
    `idem_key_${100000 + i}`,
    errorCode,
    `req_trace_${i}`,
    0.12,
    0,
    reqTime,
    "v2025-10-01",
    `49.205.${10 + (i % 80)}.${1 + (i % 250)}`
  );
}

console.log("✅ Seeded 200 API Requests spanning 3 days with realistic mix of HTTP 200, 202, 400, 401, 422, 429, 500.");

// ---------------------------------------------------------------------------
// 9. Seed Changelog Entries (14 Entries Across 3 API Versions with Breaking & Sunset Dates)
// ---------------------------------------------------------------------------
const changelogStmt = sqlite.prepare(`
  INSERT INTO changelog_entries (id, version, date, type, title, body, affected_endpoints, breaking, sunset_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const changelogData = [
  // v2025-10-01 (Current GA)
  {
    id: "cle_2025_10_01",
    version: "v2025-10-01",
    date: "2026-10-28",
    type: "added",
    title: "Real-time Customer Data Platform (CDP) Profile Ingestion",
    body: "Introduced POST /v1/events and GET /v1/profiles/:id for real-time customer event streaming and automated trait calculations.",
    affectedEndpoints: JSON.stringify(["POST /v1/events", "GET /v1/profiles/:id"]),
    breaking: 0,
    sunsetDate: null
  },
  {
    id: "cle_2025_10_02",
    version: "v2025-10-01",
    date: "2026-10-20",
    type: "added",
    title: "Meta WhatsApp Cloud API Channel Integration",
    body: "Native support for WhatsApp Business OTP templates and rich media interactive catalogs via POST /v1/messages.",
    affectedEndpoints: JSON.stringify(["POST /v1/messages"]),
    breaking: 0,
    sunsetDate: null
  },
  {
    id: "cle_2025_10_03",
    version: "v2025-10-01",
    date: "2026-10-15",
    type: "changed",
    title: "Increased Sandbox Rate Limits to 50 TPS",
    body: "Default rate limit for evaluation workspaces increased from 25 to 50 transactions per second.",
    affectedEndpoints: JSON.stringify(["*"]),
    breaking: 0,
    sunsetDate: null
  },
  {
    id: "cle_2025_10_04",
    version: "v2025-10-01",
    date: "2026-10-05",
    type: "security",
    title: "Mandatory HMAC-SHA256 Webhook Signatures",
    body: "All outbound delivery webhooks now require validation using the X-Relay-Signature header with timestamp drift tolerance of 5 minutes.",
    affectedEndpoints: JSON.stringify(["Webhook Delivery Engine"]),
    breaking: 1, // Breaking change 1
    sunsetDate: null
  },
  {
    id: "cle_2025_10_05",
    version: "v2025-10-01",
    date: "2026-09-28",
    type: "fixed",
    title: "Fixed Airtel DLR Latency Spikes in North Circles",
    body: "Resolved internal queue buffering that caused handset delivery receipts to lag during Diwali high-traffic bursts.",
    affectedEndpoints: JSON.stringify(["POST /v1/messages"]),
    breaking: 0,
    sunsetDate: null
  },

  // v2025-01-15 (Supported)
  {
    id: "cle_2025_01_01",
    version: "v2025-01-15",
    date: "2025-06-12",
    type: "added",
    title: "Google Jibe RCS Rich Messaging Support",
    body: "Added support for rich cards, suggestion action chips, and automated fallback to SMS when data connection is unavailable.",
    affectedEndpoints: JSON.stringify(["POST /v1/messages"]),
    breaking: 0,
    sunsetDate: null
  },
  {
    id: "cle_2025_01_02",
    version: "v2025-01-15",
    date: "2025-04-18",
    type: "changed",
    title: "Strict E.164 Validation for Indian Mobile Numbers",
    body: "Recipient numbers must include +91 prefix and exactly 10 valid mobile digits.",
    affectedEndpoints: JSON.stringify(["POST /v1/messages"]),
    breaking: 1, // Breaking change 2
    sunsetDate: null
  },
  {
    id: "cle_2025_01_03",
    version: "v2025-01-15",
    date: "2025-03-02",
    type: "fixed",
    title: "Corrected Timezone Serialization to IST (Asia/Kolkata)",
    body: "All delivery timestamps now strictly adhere to ISO 8601 UTC with optional IST conversion headers.",
    affectedEndpoints: JSON.stringify(["GET /v1/messages/:id"]),
    breaking: 0,
    sunsetDate: null
  },
  {
    id: "cle_2025_01_04",
    version: "v2025-01-15",
    date: "2025-01-15",
    type: "deprecated",
    title: "Deprecation Notice: Legacy XML Delivery Reports",
    body: "XML delivery callbacks are deprecated in favor of JSON webhooks and will be shut down on June 1, 2027.",
    affectedEndpoints: JSON.stringify(["/v1/reports/dlr.xml"]),
    breaking: 0,
    sunsetDate: "2027-06-01" // Deprecation 1 with sunset
  },

  // v2024-06-01 (Deprecated)
  {
    id: "cle_2024_06_01",
    version: "v2024-06-01",
    date: "2024-11-20",
    type: "deprecated",
    title: "Deprecation of Basic Auth in favor of Bearer Token Keys",
    body: "HTTP Basic Authentication using account credentials has been marked deprecated. Please migrate to Bearer rk_... tokens.",
    affectedEndpoints: JSON.stringify(["*"]),
    breaking: 0,
    sunsetDate: "2027-06-01" // Deprecation 2 with sunset
  },
  {
    id: "cle_2024_06_02",
    version: "v2024-06-01",
    date: "2024-09-14",
    type: "removed",
    title: "Removed Unsigned Webhook Payload Support",
    body: "Unsigned webhooks without HMAC verification headers have been decommissioned across all customer endpoints.",
    affectedEndpoints: JSON.stringify(["Webhooks"]),
    breaking: 0,
    sunsetDate: "2025-01-01"
  },
  {
    id: "cle_2024_06_03",
    version: "v2024-06-01",
    date: "2024-07-02",
    type: "changed",
    title: "Consolidated Error Payloads to RFC 7807 Format",
    body: "Standardized error code response objects across all gateway services.",
    affectedEndpoints: JSON.stringify(["*"]),
    breaking: 0,
    sunsetDate: null
  },
  {
    id: "cle_2024_06_04",
    version: "v2024-06-01",
    date: "2024-06-01",
    type: "added",
    title: "Initial Launch of Relay Developer API v2024-06-01",
    body: "First GA release with High-throughput Indian SMS and TRAI DLT verification engine.",
    affectedEndpoints: JSON.stringify(["POST /v1/messages", "GET /v1/messages/:id"]),
    breaking: 0,
    sunsetDate: "2027-06-01"
  }
];

for (const entry of changelogData) {
  changelogStmt.run(
    entry.id,
    entry.version,
    entry.date,
    entry.type,
    entry.title,
    entry.body,
    entry.affectedEndpoints,
    entry.breaking,
    entry.sunsetDate
  );
}

console.log("✅ Seeded 13 Changelog entries across 3 API versions with breaking changes and sunset dates.");

// ---------------------------------------------------------------------------
// 9b. Seed Incidents, Known Issues & Support Threads
// ---------------------------------------------------------------------------
sqlite.exec(`
  INSERT INTO incidents (id, title, status, impact, affected_components, updates, created_at, resolved_at) VALUES
  (
    'inc_airtel_dlr_01',
    'Degraded Airtel Handset DLR Delivery in North Circles',
    'resolved',
    'minor',
    '["Bharti Airtel SMPP Link", "SMS Delivery Reports"]',
    '[{"timestamp": "2026-10-28T14:30:00Z", "status": "resolved", "body": "Upstream queue buffering cleared by Bharti Airtel NOC. DLR latencies normalized to < 1.2s."}, {"timestamp": "2026-10-28T12:00:00Z", "status": "identified", "body": "Identified high latency on Airtel SMSC in Delhi-NCR and Punjab telecom circles."}]',
    ${nowEpoch - 86400 * 2},
    ${nowEpoch - 86400 * 2 + 7200}
  ),
  (
    'inc_jio_maintenance_01',
    'Scheduled Jio SMPP Gateway Route Maintenance',
    'resolved',
    'none',
    '["Reliance Jio SMPP Link"]',
    '[{"timestamp": "2026-10-25T03:30:00Z", "status": "resolved", "body": "Maintenance completed without message loss. Traffic routed seamlessly via redundant link."}, {"timestamp": "2026-10-25T02:00:00Z", "status": "monitoring", "body": "Secondary carrier links actively taking live traffic."}]',
    ${nowEpoch - 86400 * 5},
    ${nowEpoch - 86400 * 5 + 5400}
  );

  INSERT INTO known_issues (id, title, component, status, description, workaround, created_at) VALUES
  (
    'iss_wa_weekend_approval',
    'Meta WhatsApp Business Template Review Delays on Weekends',
    'WhatsApp Cloud API',
    'workaround_available',
    'Meta template reviewers operate on reduced weekend capacity, causing automated template status checks to take up to 24 hours.',
    'Submit WhatsApp OTP and marketing templates between 9:00 AM and 6:00 PM IST on weekdays for approval within 15 minutes.',
    ${nowEpoch - 86400 * 10}
  ),
  (
    'iss_node_undici_keepalive',
    'Node.js 18+ undici connection reset during long-lived webhook listener',
    'Webhooks & SDKs',
    'workaround_available',
    'Default undici HTTP client in Node 18 closes idle keep-alive sockets abruptly after 5 seconds of inactivity.',
    'Configure custom http.Agent with keepAlive: true, keepAliveMsecs: 30000, and maxSockets: 50 when consuming high-volume webhooks.',
    ${nowEpoch - 86400 * 7}
  ),
  (
    'iss_dlt_telco_sync_lag',
    'TRAI DLT Entity & Header Registration Propagation Latency',
    'DLT Verification Engine',
    'workaround_available',
    'New Sender IDs registered on Vodafone Idea (Vi) portal take up to 24 hours to sync to Airtel and Jio registry databases.',
    'Register sender IDs through Vilpower or PingConnect first, which broadcast changes across all Indian operators within 4 hours.',
    ${nowEpoch - 86400 * 14}
  );

  INSERT INTO support_threads (id, workspace_id, subject, status, context, created_at, messages) VALUES
  (
    'thr_acme_dlt_query',
    'ws_acmepay_prod',
    'Query regarding DLT Principal Entity ID binding for OTP templates',
    'resolved',
    '{"environment":"test","apiVersion":"v2025-10-01","sdkLanguage":"node","last10RequestIds":["req_seed_test_01","req_seed_test_02"]}',
    ${nowEpoch - 86400},
    '[{"id":"msg_sub_01","sender":"developer","authorName":"Aditya Roy","text":"Hi Relay Team, in test mode do we need to provide our real MCA DLT Principal Entity ID to send OTPs, or is that mocked?","timestamp":"2026-10-29T10:00:00Z"},{"id":"msg_sub_02","sender":"engineer","authorName":"Priya Sharma (Relay Solutions)","text":"Hi Aditya! Great question. In Test mode, Relay automatically bypasses live carrier DLT matching and provides pre-approved templates (like dlt_tmpl_otp_login). You do not need an MCA certificate or TRAI DLT account until you transition to Live mode.","timestamp":"2026-10-29T10:15:00Z"}]'
  );
`);

console.log("✅ Seeded System Incidents, Known Issues, and initial Support Thread.");

// ---------------------------------------------------------------------------
// 10. Summary Verification
// ---------------------------------------------------------------------------
function getCount(tableName: string): number {
  const row: any = sqlite.prepare(`SELECT count(*) as count FROM ${tableName}`).get();
  return row.count;
}

console.log("\n==========================================================================");
console.log("             RELAY DEVELOPER HUB DATABASE SEED SUMMARY                    ");
console.log("==========================================================================");
console.log("👤 Users total:                 ", getCount("users"));
console.log("🏢 Organizations total:         ", getCount("organizations"));
console.log("🌐 Workspaces total:            ", getCount("workspaces"));
console.log("🔑 API Keys total:              ", getCount("api_keys"));
console.log("📡 Webhook Endpoints total:     ", getCount("webhook_endpoints"));
console.log("📨 Webhook Events total:        ", getCount("webhook_events"));
console.log("🚀 Webhook Deliveries total:    ", getCount("webhook_deliveries"));
console.log("📊 API Requests (3 Days):       ", getCount("api_requests"));
console.log("💬 Messages total:              ", getCount("messages"));
console.log("👥 Customer Profiles (CDP):     ", getCount("customers_profiles"));
console.log("⚡ Ingested CDP Events:         ", getCount("events_ingested"));
console.log("📜 Changelog Entries:           ", getCount("changelog_entries"));
console.log("🏷️  API Versions:                ", getCount("api_versions"));
console.log("==========================================================================");
console.log("✅ Seed completed successfully!\n");

// Automatically index docs chunks so doc_chunks table is always populated
import { indexDocs } from "../../scripts/index-docs";
indexDocs().catch(() => {});
