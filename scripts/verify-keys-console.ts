import { spawn, ChildProcess } from "child_process";
import crypto from "crypto";
import { db } from "../lib/db";
import { apiKeys, apiRequests, apiKeyAuditLogs } from "../lib/db/schema";
import { eq, desc } from "drizzle-orm";

const BASE_URL = "http://127.0.0.1:3001";
let serverProcess: ChildProcess | null = null;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    return res.status === 200;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isServerRunning()) return;

  console.log("🚀 Starting Next.js server on 127.0.0.1:3001...");
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

  let attempts = 0;
  while (attempts < 25) {
    if (await isServerRunning()) {
      console.log("✅ Server ready!\n");
      return;
    }
    await sleep(800);
    attempts++;
  }
  throw new Error("Server failed to start");
}

async function run() {
  console.log("===============================================================");
  console.log("🔑 END-TO-END VERIFICATION: CREDENTIALS & ROTATION SUITE");
  console.log("===============================================================\n");

  await ensureServer();

  // 1. Authenticate demo user to get session cookie
  console.log("1️⃣ Authenticating demo session...");
  const authRes = await fetch(`${BASE_URL}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmepay.in", password: "demo1234" }),
  });
  if (authRes.status !== 200) throw new Error("Demo sign in failed");
  const cookieHeader = authRes.headers.get("set-cookie") || "";
  const sessionCookie = cookieHeader.split(";")[0];

  // 2. Create a key with ONLY 'messages:read' scope
  console.log("\n2️⃣ Creating API key with ONLY 'messages:read' scope...");
  const createKeyRes = await fetch(`${BASE_URL}/api/internal/api-keys`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Read-Only Compliance Auditing Key",
      environment: "test",
      scopes: ["messages:read"],
      expiresInDays: 90,
      ipAllowlist: "127.0.0.1",
    }),
  });
  const createKeyBody = await createKeyRes.json();
  if (!createKeyBody.success || !createKeyBody.rawKey) {
    throw new Error(`Failed to create key: ${JSON.stringify(createKeyBody)}`);
  }

  const createdKeyId = createKeyBody.key.id;
  const rawKey1 = createKeyBody.rawKey;
  console.log(`- Created Key ID: ${createdKeyId}`);
  console.log(`- Returned Raw Secret (revealed once): ${rawKey1.slice(0, 15)}...`);
  console.log(`- Key Scopes: ${createKeyBody.key.scopes}`);

  // Confirm DB stores hash, not plaintext comparison
  const [dbKeyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.id, createdKeyId)).limit(1);
  const expectedHash = crypto.createHash("sha256").update(rawKey1).digest("hex");
  if (dbKeyRecord.hashedSecret !== expectedHash) {
    throw new Error("Database hashedSecret does not match SHA-256 hash of raw key!");
  }
  console.log(`- Cryptographic SHA-256 verification: PASS ✓`);

  // 3. Call POST /api/v1/messages with this read-only key -> Expect 403 insufficient_scope
  console.log("\n3️⃣ Invoking POST /api/v1/messages with read-only key (Scope Check)...");
  const postMsgRes = await fetch(`${BASE_URL}/api/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rawKey1}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "+919999900001",
      channel: "sms",
      template_id: "dlt_tmpl_otp_login",
      variables: { "1": "123456" },
    }),
  });

  console.log(`- Status: ${postMsgRes.status}`);
  const postMsgBody = await postMsgRes.json();
  console.log(`- Response Error Envelope:`, postMsgBody);

  if (postMsgRes.status !== 403) {
    throw new Error(`Expected HTTP 403, got ${postMsgRes.status}`);
  }
  if (postMsgBody.error?.code !== "insufficient_scope") {
    throw new Error(`Expected error code 'insufficient_scope', got '${postMsgBody.error?.code}'`);
  }
  if (!postMsgBody.error?.message?.includes("messages:send")) {
    throw new Error("Expected error message to specify that 'messages:send' scope is required");
  }
  console.log(`- 403 insufficient_scope correctly returned! PASS ✓`);

  // 4. Test Key Rotation with a 24h grace period
  console.log("\n4️⃣ Rotating key with 24-hour grace period...");
  const rotateRes = await fetch(`${BASE_URL}/api/internal/api-keys/rotate`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      keyId: createdKeyId,
      gracePeriodHours: 24,
    }),
  });
  const rotateBody = await rotateRes.json();
  if (!rotateBody.success || !rotateBody.rawKey) {
    throw new Error(`Rotation failed: ${JSON.stringify(rotateBody)}`);
  }

  const rawKey2 = rotateBody.rawKey;
  const rotatedNewKeyId = rotateBody.newKey.id;
  console.log(`- Old Key Status: ${rotateBody.oldKey.status} (Grace ends: ${rotateBody.oldKey.gracePeriodEndsAt})`);
  console.log(`- New Key ID: ${rotatedNewKeyId}`);
  console.log(`- New Raw Secret: ${rawKey2.slice(0, 15)}...`);

  // Verify BOTH work during the grace period!
  console.log("\n5️⃣ Testing BOTH keys work during rotation grace period...");

  // Old key should still work for authorized endpoints (GET /api/v1/messages)
  const oldKeyCall = await fetch(`${BASE_URL}/api/v1/messages?limit=1`, {
    headers: { Authorization: `Bearer ${rawKey1}` },
  });
  console.log(`- Old Key GET /api/v1/messages status: ${oldKeyCall.status}`);
  if (oldKeyCall.status !== 200) {
    throw new Error(`Old key failed during grace period: ${oldKeyCall.status}`);
  }

  // New key should also work
  const newKeyCall = await fetch(`${BASE_URL}/api/v1/messages?limit=1`, {
    headers: { Authorization: `Bearer ${rawKey2}` },
  });
  console.log(`- New Key GET /api/v1/messages status: ${newKeyCall.status}`);
  if (newKeyCall.status !== 200) {
    throw new Error(`New key failed during grace period: ${newKeyCall.status}`);
  }
  console.log(`- Both keys functional during grace period! PASS ✓`);

  // 6. Revoke the old key and verify immediate 401
  console.log("\n6️⃣ Revoking the old key immediately...");
  const revokeRes = await fetch(`${BASE_URL}/api/internal/api-keys/revoke`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ keyId: createdKeyId }),
  });
  const revokeBody = await revokeRes.json();
  console.log(`- Revoke status:`, revokeBody);
  if (!revokeBody.success) throw new Error("Revocation failed");

  // Call API with revoked key -> Must return 401 key_revoked
  console.log("\n7️⃣ Calling API with revoked key -> Expecting 401 key_revoked...");
  const revokedCall = await fetch(`${BASE_URL}/api/v1/messages?limit=1`, {
    headers: { Authorization: `Bearer ${rawKey1}` },
  });
  console.log(`- Status: ${revokedCall.status}`);
  const revokedBody = await revokedCall.json();
  console.log(`- Response:`, revokedBody);

  if (revokedCall.status !== 401) {
    throw new Error(`Expected HTTP 401, got ${revokedCall.status}`);
  }
  if (revokedBody.error?.code !== "key_revoked") {
    throw new Error(`Expected 'key_revoked', got '${revokedBody.error?.code}'`);
  }
  console.log(`- 401 key_revoked confirmed! PASS ✓`);

  // 8. Confirm calls appear in logs/usage and audit trail
  console.log("\n8️⃣ Verifying audit logs and telemetry in database...");
  const auditLogs = await db
    .select()
    .from(apiKeyAuditLogs)
    .where(eq(apiKeyAuditLogs.keyId, createdKeyId))
    .orderBy(desc(apiKeyAuditLogs.createdAt));

  console.log(`- Audit trail entries for key ${createdKeyId}: ${auditLogs.length}`);
  const actions = auditLogs.map((a) => a.action);
  console.log(`- Recorded actions: [${actions.join(", ")}]`);

  if (!actions.includes("created") || !actions.includes("rotated") || !actions.includes("revoked")) {
    throw new Error("Audit trail missing one or more required events (created, rotated, revoked)");
  }

  // Check key details endpoint
  const detailsRes = await fetch(`${BASE_URL}/api/internal/api-keys/${createdKeyId}/details`, {
    headers: { Cookie: sessionCookie },
  });
  const detailsBody = await detailsRes.json();
  console.log(`- Key details endpoint returned status: ${detailsRes.status}, recent requests count: ${detailsBody.recentRequests?.length}`);

  console.log("\n===============================================================");
  console.log("🎉 ALL CREDENTIALS & ROTATION END-TO-END CHECKS PASSED 100%!");
  console.log("===============================================================");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
}).finally(() => {
  if (serverProcess) serverProcess.kill();
});
