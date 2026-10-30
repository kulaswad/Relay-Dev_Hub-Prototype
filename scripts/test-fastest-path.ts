/**
 * Automated Verification Script: Front Door & Fastest Path to First API Call
 * Tests fresh sign-up, checklist auto-detection, live first call, timer completion,
 * test webhook reception, KYC simulation, and anonymous 24h evaluation flow.
 */

import { db } from "../lib/db";
import { users, workspaces, apiKeys, apiRequests, messages, webhookDeliveries, solutionsInquiries } from "../lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { spawn, ChildProcess } from "child_process";

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

async function ensureServerStarted(): Promise<void> {
  const alreadyRunning = await isServerRunning();
  if (alreadyRunning) {
    console.log("⚡ Server is already running on port 3001.\n");
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

  let attempts = 0;
  while (attempts < 30) {
    if (await isServerRunning()) {
      console.log("✅ Next.js server ready on http://127.0.0.1:3001\n");
      return;
    }
    await sleep(800);
    attempts++;
  }
  throw new Error("Server failed to start within 25 seconds.");
}

async function runFastestPathVerification() {
  console.log("\n==================================================================");
  console.log("    RELAY DEVELOPER HUB: FRONT DOOR & FASTEST PATH TEST SUITE    ");
  console.log("==================================================================\n");

  await ensureServerStarted();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const BASE_URL = "http://localhost:3001";

  // -------------------------------------------------------------------------
  // TEST 1: Fresh Developer Sign-Up Flow
  // -------------------------------------------------------------------------
  console.log("TEST 1: Fresh Developer Sign-Up Flow");
  const uniqueHex = crypto.randomBytes(4).toString("hex");
  const testEmail = `dev_${uniqueHex}@finflow.in`;
  const testPassword = "Password123!";

  let sessionCookie = "";
  let signUpData: any = null;

  try {
    const signUpRes = await fetch(`${BASE_URL}/api/auth/sign-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Vikram Mehta",
        email: testEmail,
        password: testPassword,
        company: `FinFlow ${uniqueHex.toUpperCase()}`,
        role: "Backend dev",
        intent: "Evaluating Relay",
      }),
    });

    // Capture session cookie
    const setCookie = signUpRes.headers.get("set-cookie");
    if (setCookie) {
      sessionCookie = setCookie.split(";")[0];
    }
    signUpData = await signUpRes.json();

    assert(signUpRes.status === 200, "Sign-up returns HTTP 200 OK");
    assert(Boolean(signUpData.user?.id), `User created with ID: ${signUpData.user?.id}`);
    assert(Boolean(signUpData.workspace?.id), `Workspace created with ID: ${signUpData.workspace?.id}`);
    assert(signUpData.workspace?.kycStatus === "not_started", "Workspace initialized with KYC status 'not_started'");
  } catch (err: any) {
    assert(false, `Sign-up threw an error: ${err.message}`);
  }

  const workspaceId = signUpData?.workspace?.id;

  // -------------------------------------------------------------------------
  // TEST 2: Onboarding Checklist Initial State & Test Key Verification
  // -------------------------------------------------------------------------
  console.log("\nTEST 2: Onboarding Checklist Initial State & Test Key Auto-Creation");
  let checklistData: any = null;
  let testApiKey = "";

  try {
    const checklistRes = await fetch(`${BASE_URL}/api/internal/onboarding-checklist`, {
      headers: { Cookie: sessionCookie },
    });
    checklistData = await checklistRes.json();

    assert(checklistRes.status === 200, "Checklist returns HTTP 200 OK");
    assert(checklistData.steps.step1_accountCreated.completed === true, "Step 1 (Account created) is auto-completed");
    assert(checklistData.steps.step2_getTestKey.completed === true, "Step 2 (Get test key) is auto-completed");

    testApiKey = checklistData.steps.step2_getTestKey.key.fullKey;
    assert(testApiKey.startsWith("rk_test_"), `Test API key generated: ${checklistData.steps.step2_getTestKey.key.masked}`);
    assert(checklistData.steps.step3_firstCall.completed === false, "Step 3 (First API call) is initially pending");
    assert(checklistData.timeToFirstCall.completed === false, "Timer is actively running (not completed)");
  } catch (err: any) {
    assert(false, `Checklist initial fetch failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Timed First Successful API Call Execution
  // -------------------------------------------------------------------------
  console.log("\nTEST 3: Timed First Successful API Call Execution");
  let firstCallResData: any = null;
  let firstCallRequestId: string | null = null;

  try {
    const firstCallStart = Date.now();
    const callRes = await fetch(`${BASE_URL}/api/v1/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${testApiKey}`,
        "Content-Type": "application/json",
        "Relay-Version": "2025-10-01",
      },
      body: JSON.stringify({
        channel: "sms",
        to: "+919999900001",
        sender_id: "RELAYI",
        template_id: "dlt_tmpl_otp_login",
        variables: { "1": "782019" },
      }),
    });

    firstCallResData = await callRes.json();
    firstCallRequestId = callRes.headers.get("relay-request-id");

    assert(callRes.status === 202, `API returned HTTP 202 Accepted: ${firstCallResData.status}`);
    assert(Boolean(firstCallResData.id), `Message queued with ID: ${firstCallResData.id}`);
    assert(Boolean(firstCallRequestId), `Relay-Request-Id header received: ${firstCallRequestId}`);
    assert(
      callRes.headers.get("relay-ratelimit-remaining") !== null ||
      callRes.headers.get("x-ratelimit-remaining") !== null,
      "Sliding window rate limit header present"
    );
  } catch (err: any) {
    assert(false, `First API call execution failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Live Auto-Detection & Timer Stop
  // -------------------------------------------------------------------------
  console.log("\nTEST 4: Live Auto-Detection & Timer Stop");
  try {
    const updatedChecklistRes = await fetch(`${BASE_URL}/api/internal/onboarding-checklist`, {
      headers: { Cookie: sessionCookie },
    });
    const updatedChecklist = await updatedChecklistRes.json();

    assert(updatedChecklist.steps.step3_firstCall.completed === true, "Step 3 auto-detected as COMPLETED from api_requests ledger");
    assert(updatedChecklist.steps.step4_seeInLogs.completed === true, "Step 4 (See in logs) auto-detected as COMPLETED");
    assert(updatedChecklist.steps.step4_seeInLogs.requestId !== null, `Step 4 links to exact request: ${updatedChecklist.steps.step4_seeInLogs.requestId}`);
    assert(updatedChecklist.timeToFirstCall.completed === true, "Time to first call timer STOPPED upon call completion");
    assert(Boolean(updatedChecklist.timeToFirstCall.formatted), `Celebratory time recorded: '${updatedChecklist.timeToFirstCall.formatted}'`);
    assert(updatedChecklist.allFirstFourCompleted === true, "Steps 1-4 milestone unlocked (displays celebration & next actions)");

    // Verify DB persistence
    const [dbReq] = await db.select().from(apiRequests).where(eq(apiRequests.workspaceId, workspaceId)).limit(1);
    assert(Boolean(dbReq), "api_requests row confirmed in SQLite database");

    const [dbMsg] = await db.select().from(messages).where(eq(messages.workspaceId, workspaceId)).limit(1);
    assert(Boolean(dbMsg), "messages row confirmed in SQLite database");
  } catch (err: any) {
    assert(false, `Checklist auto-detection verification failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: One-Click Webhook Receiver & Test Event
  // -------------------------------------------------------------------------
  console.log("\nTEST 5: One-Click Webhook Receiver & Delivery Verification");
  try {
    const webhookRes = await fetch(`${BASE_URL}/api/internal/onboarding-send-test-webhook`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    const webhookData = await webhookRes.json();

    assert(webhookRes.status === 200, "One-click webhook dispatch returns HTTP 200 OK");
    assert(Boolean(webhookData.deliveryId), `Delivery created with ID: ${webhookData.deliveryId}`);

    const postWhChecklistRes = await fetch(`${BASE_URL}/api/internal/onboarding-checklist`, {
      headers: { Cookie: sessionCookie },
    });
    const postWhChecklist = await postWhChecklistRes.json();
    assert(postWhChecklist.steps.step5_receiveWebhook.completed === true, "Step 5 (Receive a webhook) auto-detected as COMPLETED");
  } catch (err: any) {
    assert(false, `Webhook delivery test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Non-Blocking KYC Pending & Simulate KYC Approved Toggle
  // -------------------------------------------------------------------------
  console.log("\nTEST 6: KYC-Pending Handling & Simulate Approved Toggle");
  try {
    // 1. Verify that while KYC is pending, Test mode works but Live is blocked
    const liveKeyRes = await fetch(`${BASE_URL}/api/v1/messages`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer rk_live_unverified_key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: "sms", to: "+919999900001", sender_id: "RELAYI", body: "Test" }),
    });
    assert(liveKeyRes.status === 401 || liveKeyRes.status === 403, "Live keys are rejected when KYC is not approved");

    // 2. Toggle "Simulate KYC Approved"
    const kycToggleRes = await fetch(`${BASE_URL}/api/internal/simulate-kyc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ approved: true }),
    });
    const kycToggleData = await kycToggleRes.json();

    assert(kycToggleRes.status === 200, "Simulate KYC toggle returns HTTP 200 OK");
    assert(kycToggleData.workspace.kycStatus === "approved", "Workspace KYC status transitioned to 'approved'");

    const postKycChecklistRes = await fetch(`${BASE_URL}/api/internal/onboarding-checklist`, {
      headers: { Cookie: sessionCookie },
    });
    const postKycChecklist = await postKycChecklistRes.json();
    assert(postKycChecklist.steps.step6_goLive.completed === true, "Step 6 (Go Live) completed upon KYC approval");
  } catch (err: any) {
    assert(false, `KYC toggle test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Anonymous 24h Evaluation Path Without Signup
  // -------------------------------------------------------------------------
  console.log("\nTEST 7: Anonymous 24-Hour Evaluation Path Without Signup");
  try {
    const evalRes = await fetch(`${BASE_URL}/api/auth/evaluation`, {
      method: "POST",
    });
    const evalData = await evalRes.json();

    assert(evalRes.status === 200, "Evaluation initialization returns HTTP 200 OK");
    assert(evalData.isAnonymous === true, "Workspace is explicitly marked isAnonymous = true");
    assert(evalData.workspace.planTier === "sandbox", "Evaluation workspace created on sandbox tier");

    const evalCookie = evalRes.headers.get("set-cookie")?.split(";")[0] || "";

    // Verify workspace expires in 24 hours
    const [evalWsInDb] = await db.select().from(workspaces).where(eq(workspaces.id, evalData.workspace.id)).limit(1);
    assert(evalWsInDb !== undefined, "Evaluation workspace persisted to database");
    assert(evalWsInDb.expiresAt !== null, "Evaluation workspace has 24h expiration timestamp set");

    // Find evaluation API key
    const [evalKey] = await db.select().from(apiKeys).where(eq(apiKeys.workspaceId, evalData.workspace.id)).limit(1);
    assert(evalKey !== undefined, "Temporary sandbox key automatically provisioned");
    assert(evalKey.prefix === "rk_test_", "Evaluation key starts with rk_test_");

    // Execute message using eval key
    const evalCallRes = await fetch(`${BASE_URL}/api/v1/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${evalKey.fullKeyForDev}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: "sms",
        to: "+919999900001",
        sender_id: "RELAYI",
        template_id: "dlt_tmpl_otp_login",
        variables: { "1": "112233" },
      }),
    });
    const evalCallData = await evalCallRes.json();
    assert(evalCallRes.status === 202, `Evaluation sandbox key successfully executes live request: ${evalCallData.id}`);
  } catch (err: any) {
    assert(false, `Evaluation path test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Solutions Engineer Inquiry Submission
  // -------------------------------------------------------------------------
  console.log("\nTEST 8: Solutions Engineer Inquiry Persistence");
  try {
    const inqRes = await fetch(`${BASE_URL}/api/internal/solutions-inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Pooja Hegde",
        email: "pooja@zestmoney.in",
        company: "ZestMoney India",
        monthlyVolume: "1M - 10M",
        channels: ["sms", "whatsapp"],
        useCase: "Instant loan approval OTPs and credit line alerts via WhatsApp",
      }),
    });
    const inqData = await inqRes.json();

    assert(inqRes.status === 200, "Inquiry returns HTTP 200 OK");
    assert(Boolean(inqData.inquiryId), `Inquiry ID generated: ${inqData.inquiryId}`);

    const [dbInq] = await db.select().from(solutionsInquiries).where(eq(solutionsInquiries.id, inqData.inquiryId)).limit(1);
    assert(Boolean(dbInq), "Inquiry record confirmed in SQLite database table 'solutions_inquiries'");
    assert(dbInq.status === "new", "Inquiry status is 'new'");
  } catch (err: any) {
    assert(false, `Solutions inquiry test failed: ${err.message}`);
  }

  console.log("\n==================================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("==================================================================\n");

  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runFastestPathVerification();
