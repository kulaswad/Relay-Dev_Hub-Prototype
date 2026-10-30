import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const dbPath = path.resolve(process.cwd(), "relay.db");
const db = new Database(dbPath);

console.log("=== RELAY DEVELOPER HUB: SEED & AUTH VERIFICATION ===");
console.log("Database path:", dbPath);

// 1. Verify Database Counts
const counts: Record<string, number> = {};
const tables = [
  "users",
  "organizations",
  "workspaces",
  "api_keys",
  "webhook_endpoints",
  "webhook_events",
  "webhook_deliveries",
  "api_requests",
  "messages",
  "customers_profiles",
  "events_ingested",
  "changelog_entries",
  "api_versions"
];

for (const t of tables) {
  const row: any = db.prepare(`SELECT count(*) as c FROM ${t}`).get();
  counts[t] = row.c;
}

console.log("\n📊 Table Counts:");
console.table(counts);

// Assert table counts
if (counts.users < 1) throw new Error("Expected at least 1 user");
if (counts.api_requests < 200) throw new Error("Expected at least 200 api_requests");
if (counts.messages < 40) throw new Error("Expected at least 40 messages");
if (counts.customers_profiles < 15) throw new Error("Expected at least 15 customer profiles");
if (counts.events_ingested < 60) throw new Error("Expected at least 60 events ingested");
if (counts.changelog_entries < 12) throw new Error("Expected at least 12 changelog entries");

console.log("✅ All required table counts verified!");

// 2. Verify Demo User Credentials
const demoUser: any = db.prepare(`SELECT * FROM users WHERE email = 'demo@acmepay.in'`).get();
if (!demoUser) throw new Error("Demo user demo@acmepay.in not found!");

const isPasswordCorrect = bcrypt.compareSync("demo1234", demoUser.password_hash);
console.log("\n🔐 Demo User Authentication Check:");
console.log(`- User ID: ${demoUser.id}`);
console.log(`- Email: ${demoUser.email}`);
console.log(`- Company: ${demoUser.company}`);
console.log(`- Password 'demo1234' matches bcrypt hash: ${isPasswordCorrect ? "YES (Valid)" : "NO"}`);
if (!isPasswordCorrect) throw new Error("Demo password validation failed");

// 3. Verify API Keys (Test Key & Live Locked Key)
const keys: any[] = db.prepare(`SELECT * FROM api_keys WHERE workspace_id = 'ws_acmepay_prod'`).all();
console.log(`\n🔑 API Keys for AcmePay (${keys.length} total):`);
for (const k of keys) {
  console.log(`  - [${k.environment.toUpperCase()}] ${k.name} (Prefix: ${k.prefix}, ID: ${k.id})`);
}
const testKey = keys.find((k) => k.environment === "test");
const liveKey = keys.find((k) => k.environment === "live");
if (!testKey || !liveKey) throw new Error("Expected both test and live key for demo workspace");

// Verify Workspace KYC status (should be locked: in_review or not_started)
const ws: any = db.prepare(`SELECT * FROM workspaces WHERE id = 'ws_acmepay_prod'`).get();
console.log(`- Workspace KYC Status: '${ws.kyc_status}' -> Live key locked in UI: ${ws.kyc_status !== 'approved' ? "YES (Locked)" : "NO"}`);

// 4. Verify Webhook Failure Case 1: 500 Null Field Crash
const fail1Delivery: any = db.prepare(`
  SELECT d.*, e.payload FROM webhook_deliveries d
  JOIN webhook_events e ON d.event_id = e.id
  WHERE d.id = 'del_ep1_att3'
`).get();

if (!fail1Delivery) throw new Error("Failure case 1 delivery not found");
console.log("\n📡 Webhook Failure Scenario 1 (Null Field Crash):");
console.log(`- Event ID: ${fail1Delivery.event_id}`);
console.log(`- Response Status: ${fail1Delivery.response_status}`);
console.log(`- Status: ${fail1Delivery.status} (Next retry at: ${new Date(fail1Delivery.next_retry_at * 1000).toISOString()})`);
const parsedPayload1 = JSON.parse(fail1Delivery.payload);
console.log(`- Payload contains 'failure_reason': ${parsedPayload1.failure_reason === null ? "null (Confirmed)" : "not null"}`);
console.log(`- Response Body snippet: ${fail1Delivery.response_body.split('\n')[0]}`);

if (parsedPayload1.failure_reason !== null) throw new Error("Failure reason should be null");
if (fail1Delivery.response_status !== 500) throw new Error("Expected 500 status");

// 5. Verify Webhook Failure Case 2: 401 Signature Verification
const fail2Delivery: any = db.prepare(`
  SELECT d.*, ep.signing_secret FROM webhook_deliveries d
  JOIN webhook_endpoints ep ON d.endpoint_id = ep.id
  WHERE d.id = 'del_ep2_att1'
`).get();

if (!fail2Delivery) throw new Error("Failure case 2 delivery not found");
console.log("\n📡 Webhook Failure Scenario 2 (Signature Verification):");
console.log(`- Response Status: ${fail2Delivery.response_status}`);
console.log(`- Error Type: ${fail2Delivery.error_type}`);
const reqHeaders2 = JSON.parse(fail2Delivery.request_headers);
const sigHeader = reqHeaders2["relay-signature"];
console.log(`- Relay-Signature Header: ${sigHeader}`);

// Extract timestamp and signature from header
const parts = sigHeader.split(",");
const t = parts[0].slice(2);
const sentV1 = parts[1].slice(3);

// Compute HMAC-SHA256 of raw body
const signedPayload = `${t}.${fail2Delivery.request_body}`;
const expectedV1 = crypto.createHmac("sha256", fail2Delivery.signing_secret).update(signedPayload).digest("hex");
const signatureMatches = sentV1 === expectedV1;

console.log(`- Mathematically valid for raw body: ${signatureMatches ? "YES (Verified ✓)" : "NO"}`);
console.log(`- Customer response: "${JSON.parse(fail2Delivery.response_body).message}"`);
if (!signatureMatches) throw new Error("Seed signature must be mathematically valid for the raw body!");

// 6. Verify Changelog & Deprecations
const changelog: any[] = db.prepare(`SELECT * FROM changelog_entries`).all();
const breakingCount = changelog.filter((c) => c.breaking === 1).length;
const deprecationWithSunset = changelog.filter((c) => c.type === 'deprecated' && c.sunset_date !== null).length;
console.log(`\n📜 Changelog Entries (${changelog.length} total):`);
console.log(`- Breaking changes: ${breakingCount} (Required >= 2)`);
console.log(`- Deprecations with sunset dates: ${deprecationWithSunset} (Required >= 2)`);
if (breakingCount < 2) throw new Error("Expected at least 2 breaking changes in changelog");
if (deprecationWithSunset < 2) throw new Error("Expected at least 2 deprecations with sunset dates");

console.log("\n=======================================================");
console.log("🎉 ALL SEED INTEGRITY & AUTH ASSERTIONS PASSED 100%!");
console.log("=======================================================\n");
