import { spawn, ChildProcess } from "child_process";
import crypto from "crypto";
import { db } from "../lib/db";
import { apiKeys, workspaces, messages } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const BASE_URL = "http://127.0.0.1:3001";
let serverProcess: ChildProcess | null = null;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function ensureServerStarted(): Promise<void> {
  const alreadyRunning = await isServerRunning();
  if (alreadyRunning) {
    console.log("⚡ Server is already running on port 3001.");
    return;
  }

  console.log("🚀 Spawning Next.js server on port 3001...");
  const nextBin = require.resolve("next/dist/bin/next");
  serverProcess = spawn(
    process.execPath,
    [nextBin, "start", "-p", "3001", "-H", "127.0.0.1"],
    {
      stdio: "inherit",
      cwd: process.cwd(),
      env: { ...process.env, PORT: "3001" },
    }
  );

  serverProcess.on("exit", (code) => {
    console.log("Next.js serverProcess exited with code:", code);
  });

  let attempts = 0;
  while (attempts < 30) {
    if (await isServerRunning()) {
      console.log("✅ Next.js production server ready on http://127.0.0.1:3001\n");
      return;
    }
    await sleep(800);
    attempts++;
  }
  throw new Error("Server failed to start within 25 seconds.");
}

interface TestReport {
  name: string;
  passed: boolean;
  status?: number;
  error?: string;
  durationMs?: number;
}

const testResults: TestReport[] = [];

async function assertTest(
  name: string,
  testFn: () => Promise<void>
): Promise<boolean> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    testResults.push({ name, passed: true, durationMs: duration });
    console.log(`  ✓ PASS: ${name} (${duration}ms)`);
    return true;
  } catch (err: any) {
    const duration = Date.now() - start;
    testResults.push({
      name,
      passed: false,
      error: err.message,
      durationMs: duration,
    });
    console.error(`  ✗ FAIL: ${name} (${duration}ms) -> ${err.message}`);
    return false;
  }
}

async function run() {
  console.log("===============================================================");
  console.log("🧪 RELAY DEVELOPER HUB: COMPREHENSIVE V1 API TEST SUITE");
  console.log("===============================================================\n");

  await ensureServerStarted();

  // Retrieve Seeded Test & Live Keys from DB
  const [testKeyRecord] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.environment, "test"))
    .limit(1);

  const [liveKeyRecord] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.environment, "live"))
    .limit(1);

  if (!testKeyRecord || !liveKeyRecord) {
    throw new Error("Required test/live API keys missing from database. Run 'npm run seed' first.");
  }

  const TEST_KEY = testKeyRecord.fullKeyForDev || "rk_test_default";
  const LIVE_KEY = liveKeyRecord.fullKeyForDev || "rk_live_default";

  // Create temporary keys for edge testing: (1) revoked key, (2) key without messages:send scope
  const revokedKeyRaw = `rk_test_revoked_${crypto.randomBytes(8).toString("hex")}`;
  const revokedHash = crypto.createHash("sha256").update(revokedKeyRaw).digest("hex");
  const scopedKeyRaw = `rk_test_scoped_${crypto.randomBytes(8).toString("hex")}`;
  const scopedHash = crypto.createHash("sha256").update(scopedKeyRaw).digest("hex");

  await db.insert(apiKeys).values([
    {
      id: `key_test_rev_${Date.now()}`,
      workspaceId: testKeyRecord.workspaceId,
      name: "Revoked Test Key",
      prefix: "rk_test_",
      hashedSecret: revokedHash,
      secretMasked: "rk_test_••••••••rev1",
      fullKeyForDev: revokedKeyRaw,
      environment: "test",
      scopes: JSON.stringify(["messages:send"]),
      status: "revoked",
      createdBy: "test_suite",
    },
    {
      id: `key_test_nosend_${Date.now()}`,
      workspaceId: testKeyRecord.workspaceId,
      name: "Profiles Only Key",
      prefix: "rk_test_",
      hashedSecret: scopedHash,
      secretMasked: "rk_test_••••••••nosn",
      fullKeyForDev: scopedKeyRaw,
      environment: "test",
      scopes: JSON.stringify(["profiles:read"]), // Missing messages:send & events:write
      status: "active",
      createdBy: "test_suite",
    },
  ]);

  try {
    // -------------------------------------------------------------
    // GROUP 1: Health & Public Endpoints
    // -------------------------------------------------------------
    console.log("\n📦 [1/7] Health & System Endpoints");

    await assertTest("GET /api/v1/health returns healthy without auth", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/health`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (body.status !== "healthy" || body.database !== "connected") {
        throw new Error(`Unexpected body: ${JSON.stringify(body)}`);
      }
    });

    // -------------------------------------------------------------
    // GROUP 2: Authentication, Scopes, and Versioning
    // -------------------------------------------------------------
    console.log("\n🔐 [2/7] Authentication, Scopes & Versioning");

    await assertTest("Missing Authorization header returns 401 authentication_failed", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== "authentication_failed") {
        throw new Error(`Expected error code 'authentication_failed', got '${body.error?.code}'`);
      }
    });

    await assertTest("Invalid API Key returns 401 authentication_failed", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: "Bearer rk_test_invalid_bogus_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest("Revoked API Key returns 401 key_revoked", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${revokedKeyRaw}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== "key_revoked") {
        throw new Error(`Expected error code 'key_revoked', got '${body.error?.code}'`);
      }
    });

    await assertTest("Missing scope returns 403 insufficient_scope", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${scopedKeyRaw}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== "insufficient_scope") {
        throw new Error(`Expected error code 'insufficient_scope', got '${body.error?.code}'`);
      }
    });

    await assertTest("Sunset/Unsupported API Version header returns 400 version_unsupported", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Relay-Version": "2023-01-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== "version_unsupported") {
        throw new Error(`Expected error code 'version_unsupported', got '${body.error?.code}'`);
      }
    });

    // -------------------------------------------------------------
    // GROUP 3: KYC Environment Gating & Live Balance
    // -------------------------------------------------------------
    console.log("\n🏢 [3/7] KYC Gating & Live Mode Behavior");

    await assertTest("Live key on workspace with KYC in_review returns 403 workspace_not_verified", async () => {
      // Ensure KYC is in_review
      await db.update(workspaces).set({ kycStatus: "in_review" }).where(eq(workspaces.id, liveKeyRecord.workspaceId));

      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LIVE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "+919999900001",
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
          variables: { "1": "123456" },
        }),
      });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== "workspace_not_verified") {
        throw new Error(`Expected 'workspace_not_verified', got '${body.error?.code}'`);
      }
    });

    await assertTest("Live key on KYC approved workspace charges wallet and dispatches (202)", async () => {
      // Simulate KYC approved
      await db.update(workspaces).set({ kycStatus: "approved", walletBalance: 500 }).where(eq(workspaces.id, liveKeyRecord.workspaceId));

      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LIVE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "+919999900001",
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
          variables: { "1": "992104" },
        }),
      });
      if (res.status !== 202) throw new Error(`Expected 202, got ${res.status}`);
      const body = await res.json();
      if (body.cost?.charged !== 0.12) {
        throw new Error(`Expected live charge ₹0.12, got ₹${body.cost?.charged}`);
      }

      // Revert KYC back to in_review
      await db.update(workspaces).set({ kycStatus: "in_review" }).where(eq(workspaces.id, liveKeyRecord.workspaceId));
    });

    // -------------------------------------------------------------
    // GROUP 4: Rate Limiting & Idempotency
    // -------------------------------------------------------------
    console.log("\n⏱️ [4/7] Rate Limiting & Idempotency");

    await assertTest("Rate limit headers present on responses", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages?limit=1`, {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      if (!res.headers.get("x-ratelimit-limit") || !res.headers.get("x-ratelimit-remaining")) {
        throw new Error("Missing X-RateLimit-* headers");
      }
    });

    await assertTest("Idempotency: Replaying same key and body returns identical response with Idempotent-Replayed: true", async () => {
      const testIdemKey = `idem_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const payload = {
        to: "+919999900001",
        channel: "sms",
        template_id: "dlt_tmpl_otp_login",
        variables: { "1": "449102" },
      };

      // Call 1
      const res1 = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": testIdemKey,
        },
        body: JSON.stringify(payload),
      });
      if (res1.status !== 202) throw new Error(`Call 1 failed with ${res1.status}`);
      const body1 = await res1.json();

      // Call 2 with identical body
      const res2 = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": testIdemKey,
        },
        body: JSON.stringify(payload),
      });
      if (res2.status !== 202) throw new Error(`Call 2 failed with ${res2.status}`);
      if (res2.headers.get("idempotent-replayed") !== "true") {
        throw new Error("Missing 'Idempotent-Replayed: true' header");
      }
      const body2 = await res2.json();
      if (body1.id !== body2.id) {
        throw new Error(`Replayed response ID mismatch: ${body1.id} vs ${body2.id}`);
      }
    });

    await assertTest("Idempotency: Same key with mutated body returns 409 idempotency_conflict", async () => {
      const testIdemKey = `idem_${Date.now()}_conflict`;
      const payload1 = {
        to: "+919999900001",
        channel: "sms",
        template_id: "dlt_tmpl_otp_login",
        variables: { "1": "111111" },
      };
      const payload2 = {
        to: "+919999900001",
        channel: "sms",
        template_id: "dlt_tmpl_otp_login",
        variables: { "1": "222222" }, // Different variable
      };

      await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": testIdemKey,
        },
        body: JSON.stringify(payload1),
      });

      const res2 = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": testIdemKey,
        },
        body: JSON.stringify(payload2),
      });
      if (res2.status !== 409) throw new Error(`Expected 409, got ${res2.status}`);
      const body2 = await res2.json();
      if (body2.error?.code !== "idempotency_conflict") {
        throw new Error(`Expected 'idempotency_conflict', got '${body2.error?.code}'`);
      }
    });

    // -------------------------------------------------------------
    // GROUP 5: Messages API & Telecom Test Numbers
    // -------------------------------------------------------------
    console.log("\n📱 [5/7] Messages API & Telecom Test Numbers");

    await assertTest("Validation: Invalid Indian phone number returns 422 invalid_phone_number", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "+14155552671", // Non-Indian
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
        }),
      });
      if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== "invalid_phone_number") {
        throw new Error(`Expected 'invalid_phone_number', got '${body.error?.code}'`);
      }
    });

    await assertTest("Validation: Unregistered DLT template returns 404 template_not_found", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "+919999900001",
          channel: "sms",
          template_id: "dlt_unknown_invalid_template",
        }),
      });
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== "template_not_found") {
        throw new Error(`Expected 'template_not_found', got '${body.error?.code}'`);
      }
    });

    await assertTest("Validation: Unapproved sender ID returns 422 sender_id_not_approved", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "+919999900001",
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
          sender_id: "HACKER",
        }),
      });
      if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);
      const body = await res.json();
      if (body.error?.code !== "sender_id_not_approved") {
        throw new Error(`Expected 'sender_id_not_approved', got '${body.error?.code}'`);
      }
    });

    await assertTest("Test Number +919999900005 triggers simulated 429 rate limit", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "+919999900005",
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
        }),
      });
      if (res.status !== 429) throw new Error(`Expected 429, got ${res.status}`);
    });

    let deliveredMsgId = "";
    await assertTest("Test Number +919999900001 (always delivers) returns 202 and transitions to delivered", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "+919999900001",
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
          variables: { "1": "778899" },
        }),
      });
      if (res.status !== 202) throw new Error(`Expected 202, got ${res.status}`);
      const body = await res.json();
      deliveredMsgId = body.id;
      if (!deliveredMsgId || body.status !== "queued") {
        throw new Error(`Invalid response: ${JSON.stringify(body)}`);
      }

      // Wait 3.5 seconds for background lifecycle to advance to 'delivered'
      await sleep(3500);

      const checkRes = await fetch(`${BASE_URL}/api/v1/messages/${deliveredMsgId}`, {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      const checkBody = await checkRes.json();
      if (checkBody.status !== "delivered") {
        throw new Error(`Expected message to be 'delivered', got '${checkBody.status}'`);
      }
      if (!Array.isArray(checkBody.timeline) || checkBody.timeline.length < 2) {
        throw new Error("Expected populated carrier delivery timeline");
      }
    });

    await assertTest("Test Number +919999900002 fails with 'handset_unreachable'", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "+919999900002",
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
          variables: { "1": "112233" },
        }),
      });
      const body = await res.json();
      const unreachableMsgId = body.id;

      await sleep(3500);

      const checkRes = await fetch(`${BASE_URL}/api/v1/messages/${unreachableMsgId}`, {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      const checkBody = await checkRes.json();
      if (checkBody.status !== "failed" || !checkBody.failure_reason?.includes("handset_unreachable")) {
        throw new Error(`Expected failed with handset_unreachable, got: ${JSON.stringify(checkBody)}`);
      }
    });

    await assertTest("Test Number +919999900003 fails with 'dnd_registered'", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "+919999900003",
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
          variables: { "1": "334455" },
        }),
      });
      const body = await res.json();
      const dndMsgId = body.id;

      await sleep(1500);

      const checkRes = await fetch(`${BASE_URL}/api/v1/messages/${dndMsgId}`, {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      const checkBody = await checkRes.json();
      if (checkBody.status !== "failed" || !checkBody.failure_reason?.includes("dnd_registered")) {
        throw new Error(`Expected failed with dnd_registered, got: ${JSON.stringify(checkBody)}`);
      }
    });

    await assertTest("GET /api/v1/messages (List messages with pagination)", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/messages?limit=5`, {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (!Array.isArray(body.data) || body.data.length === 0) {
        throw new Error("Expected non-empty message list");
      }
    });

    // -------------------------------------------------------------
    // GROUP 6: CDP Events & Customer Profiles
    // -------------------------------------------------------------
    console.log("\n👥 [6/7] CDP Events & Unified Customer Profiles");

    const testCustExternalId = `cust_test_${Date.now()}`;

    await assertTest("POST /api/v1/events (Single event ingestion creates profile)", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          external_id: testCustExternalId,
          event: "cart_checkout_completed",
          properties: {
            order_id: "ord_9901",
            amount_inr: 4500,
            preferred_channel: "whatsapp",
          },
        }),
      });
      if (res.status !== 202) throw new Error(`Expected 202, got ${res.status}`);
      const body = await res.json();
      if (body.accepted !== 1) throw new Error(`Expected 1 accepted, got ${body.accepted}`);
    });

    await assertTest("POST /api/v1/events (Deduplication rejects duplicate event_id)", async () => {
      const dupEventId = `evt_dup_${Date.now()}`;
      const payload = {
        external_id: testCustExternalId,
        event: "loyalty_points_credited",
        event_id: dupEventId,
        properties: { points: 100 },
      };

      // Ingest 1
      await fetch(`${BASE_URL}/api/v1/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Ingest 2 (Duplicate)
      const res2 = await fetch(`${BASE_URL}/api/v1/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body2 = await res2.json();
      if (body2.rejected !== 1 || body2.errors?.[0]?.code !== "duplicate_event") {
        throw new Error(`Expected 1 rejected with 'duplicate_event', got: ${JSON.stringify(body2)}`);
      }
    });

    await assertTest("GET /api/v1/customers/ext_{id} retrieves unified profile", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/customers/ext_${testCustExternalId}`, {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (!body.id || body.traits?.preferred_channel !== "whatsapp") {
        throw new Error(`Unexpected profile response: ${JSON.stringify(body)}`);
      }
    });

    await assertTest("PUT /api/v1/customers/ext_{id} updates attributes and traits", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/customers/ext_${testCustExternalId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          traits: { tier: "platinum", city: "Bengaluru" },
        }),
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (body.traits?.tier !== "platinum") {
        throw new Error(`Expected platinum tier, got: ${JSON.stringify(body)}`);
      }
    });

    // -------------------------------------------------------------
    // GROUP 7: Delivery Reports, Webhooks & Usage
    // -------------------------------------------------------------
    console.log("\n📊 [7/7] Delivery Reports, Webhook Management & Usage");

    await assertTest("GET /api/v1/delivery-status/{message_id} returns carrier DLR", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/delivery-status/${deliveredMsgId}`, {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (body.dlr_code !== "DELIVRD" || !body.carrier) {
        throw new Error(`Unexpected DLR body: ${JSON.stringify(body)}`);
      }
    });

    await assertTest("GET /api/v1/usage returns real-time quotas and wallet balance", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/usage`, {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (typeof body.quota?.monthly_limit !== "number" || typeof body.billing?.wallet_balance_inr !== "number") {
        throw new Error(`Invalid usage response: ${JSON.stringify(body)}`);
      }
    });

    let createdWebhookId = "";
    await assertTest("POST /api/v1/webhook_endpoints creates receiver with signing_secret", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/webhook_endpoints`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://api.acmepay.in/hooks/relay_test",
          events: ["message.delivered", "message.failed"],
        }),
      });
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const body = await res.json();
      createdWebhookId = body.id;
      if (!body.signing_secret?.startsWith("whsec_")) {
        throw new Error(`Expected whsec_ signing secret, got: ${body.signing_secret}`);
      }
    });

    await assertTest("GET /api/v1/webhook_endpoints lists endpoints", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/webhook_endpoints`, {
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (!Array.isArray(body.data) || !body.data.some((e: any) => e.id === createdWebhookId)) {
        throw new Error("Created webhook endpoint missing from list");
      }
    });

    await assertTest("DELETE /api/v1/webhook_endpoints/{id} deletes endpoint", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/webhook_endpoints/${createdWebhookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TEST_KEY}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = await res.json();
      if (!body.deleted) throw new Error("Delete failed");
    });
  } finally {
    // Clean up temporary keys
    await db.delete(apiKeys).where(eq(apiKeys.fullKeyForDev, revokedKeyRaw));
    await db.delete(apiKeys).where(eq(apiKeys.fullKeyForDev, scopedKeyRaw));

    if (serverProcess) {
      console.log("\nShutting down Next.js test server...");
      serverProcess.kill();
    }
  }

  // Summary
  console.log("\n===============================================================");
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`📊 TEST SUITE SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL RELAY V1 API ENDPOINT & BEHAVIOR TESTS PASSED 100%!");
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
});
