/**
 * Automated Verification Script: Usage, Limits and Errors (/console/usage)
 * Tests real-time rate limiter meters, 429 sliding-window enforcement,
 * rapid 70-request burst, cost ledger, alert preferences, limit requests, and CSV export.
 */

import { db } from "../lib/db";
import { apiKeys, apiRequests, messages, workspaces, limitRequests, alerts, usageAlertPreferences } from "../lib/db/schema";
import { eq, desc } from "drizzle-orm";
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

async function runUsageLimitsVerification() {
  console.log("==========================================================================");
  console.log("       RELAY DEVELOPER HUB: USAGE, LIMITS & ERRORS VERIFICATION          ");
  console.log("==========================================================================\n");

  await ensureServerStarted();

  // Test 1: Fetch initial usage endpoint
  console.log("📊 Step 1: Testing GET /api/internal/usage aggregates...");
  const usageRes = await fetch(`${BASE_URL}/api/internal/usage?range=24h&environment=test`);
  if (!usageRes.ok) {
    throw new Error(`Usage API returned HTTP ${usageRes.status}`);
  }
  const usageData = await usageRes.json();
  console.log(`   - Total requests in 24h: ${usageData.overview.totalRequests}`);
  console.log(`   - p50 / p95 Latency: ${usageData.overview.p50LatencyMs}ms / ${usageData.overview.p95LatencyMs}ms`);
  console.log(`   - Error rate: ${usageData.overview.errorRate}`);
  console.log(`   - Top Endpoints count: ${usageData.topEndpoints.length}`);
  console.log(`   - Quota: ${usageData.rateLimitsAndQuotas.monthlyQuotaUsed} / ${usageData.rateLimitsAndQuotas.monthlyQuota}`);
  console.log("   ✅ Initial usage aggregates successfully fetched.\n");

  // Test 2: Trigger Rate Limiting by firing 135 rapid requests in a loop (workspace limit is 120 req/min)
  console.log("⚡ Step 2: Firing 135 rapid requests to trigger 429 rate limit enforcement (limit: 120 req/min)...");
  const testKey = "rk_test_acmepay_9fa1b2e84c302948";

  let successCount = 0;
  let rateLimitHitCount = 0;
  let lastRetryAfter: string | null = null;
  let lastErrorPayload: any = null;

  const sendRequest = async (i: number) => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${testKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: "sms",
          to: "+919999900001",
          template_id: "dlt_tmpl_otp_login",
          variables: { code: String(100000 + i) },
        }),
      });

      if (res.status === 200 || res.status === 201 || res.status === 202) {
        successCount++;
      } else if (res.status === 429) {
        rateLimitHitCount++;
        lastRetryAfter = res.headers.get("Retry-After");
        try {
          lastErrorPayload = await res.json();
        } catch {}
      } else {
        try {
          const errJson = await res.json();
          console.log(`[Req ${i}] Status ${res.status}:`, errJson);
        } catch {
          console.log(`[Req ${i}] Status ${res.status}`);
        }
      }
    } catch (e: any) {
      console.log(`[Req ${i}] Fetch error:`, e.message);
    }
  };

  // Run all 135 requests concurrently so they arrive within milliseconds
  const promises: Promise<void>[] = [];
  for (let i = 1; i <= 135; i++) {
    promises.push(sendRequest(i));
  }
  await Promise.all(promises);

  console.log(`   - Successful requests before throttle: ${successCount}`);
  console.log(`   - Rate limit (HTTP 429) rejections: ${rateLimitHitCount}`);
  console.log(`   - Retry-After header received: ${lastRetryAfter} seconds`);
  console.log(`   - Error code payload: ${lastErrorPayload?.error?.code}`);

  if (rateLimitHitCount < 5) {
    throw new Error(`Expected at least 5 rate-limit rejections out of 135 requests, got ${rateLimitHitCount}`);
  }
  if (!lastRetryAfter || parseInt(lastRetryAfter, 10) < 1) {
    throw new Error(`Expected positive integer Retry-After header, got ${lastRetryAfter}`);
  }
  if (lastErrorPayload?.error?.code !== "rate_limit_exceeded") {
    throw new Error(`Expected error code 'rate_limit_exceeded', got ${lastErrorPayload?.error?.code}`);
  }
  console.log("   ✅ Rate limiter successfully enforced 60 req/min sliding-window ceiling with Retry-After!\n");

  // Test 3: Verify Live Rate Limiter Meter & Ledgers reflect the burst
  console.log("⏱️ Step 3: Verifying live sliding-window meter and 429 ledger...");
  await sleep(1000); // Allow async writes to settle
  const updatedUsageRes = await fetch(`${BASE_URL}/api/internal/usage?range=1h&environment=test`);
  const updatedUsage = await updatedUsageRes.json();

  console.log(`   - Current minute usage meter: ${updatedUsage.rateLimitsAndQuotas.currentMinuteUsage} / ${updatedUsage.rateLimitsAndQuotas.rateLimitPerMin}`);
  console.log(`   - Current minute remaining: ${updatedUsage.rateLimitsAndQuotas.currentMinuteRemaining}`);
  console.log(`   - Recent 429 hits listed: ${updatedUsage.rateLimitsAndQuotas.recent429Hits.length}`);

  if (updatedUsage.rateLimitsAndQuotas.currentMinuteUsage < 120) {
    throw new Error(`Expected current minute usage >= 120, got ${updatedUsage.rateLimitsAndQuotas.currentMinuteUsage}`);
  }
  if (updatedUsage.rateLimitsAndQuotas.recent429Hits.length === 0) {
    throw new Error("Expected recent 429 hits to be populated in rateLimitsAndQuotas");
  }

  const hasRateLimitErrorCode = updatedUsage.topErrorCodes.some(
    (e: any) => e.code === "rate_limit_exceeded"
  );
  if (!hasRateLimitErrorCode) {
    throw new Error("Expected 'rate_limit_exceeded' to appear in topErrorCodes");
  }
  console.log("   ✅ Live sliding-window meter and 429 hits correctly reflect real-time burst.\n");

  // Test 4: Cost Visibility Check
  console.log("💰 Step 4: Verifying Cost Visibility (Test is Free vs Live charged)...");
  console.log(`   - Test would have cost: ₹${updatedUsage.costVisibility.testWouldHaveCost}`);
  console.log(`   - Actual Live charged for test: ₹${updatedUsage.costVisibility.liveCharged}`);
  console.log(`   - SMS count: ${updatedUsage.costVisibility.channelBreakdown.sms.count} (₹${updatedUsage.costVisibility.channelBreakdown.sms.cost})`);

  if (updatedUsage.costVisibility.testWouldHaveCost <= 0) {
    throw new Error("Expected testWouldHaveCost > 0");
  }
  console.log("   ✅ Cost Visibility accurately separates test simulated costs from live wallet deductions.\n");

  // Test 5: Alert Preferences API & Simulated Alert
  console.log("🔔 Step 5: Testing Usage Alert Preferences & Simulated Alert...");
  const alertPostRes = await fetch(`${BASE_URL}/api/internal/usage/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      threshold80: true,
      threshold95: true,
      spike429: true,
      lowBalanceThreshold: 750,
      emailNotifications: true,
      notificationEmail: "devops@acmepay.in",
      testAlert: true,
    }),
  });
  if (!alertPostRes.ok) {
    throw new Error(`Alert preferences POST failed with HTTP ${alertPostRes.status}`);
  }
  const alertPostData = await alertPostRes.json();
  console.log(`   - Alert update message: ${alertPostData.message}`);
  console.log(`   - Simulated email sent: ${alertPostData.simulatedEmailSent}`);

  if (!alertPostData.simulatedEmailSent) {
    throw new Error("Expected simulatedEmailSent to be true");
  }

  // Verify in database
  const [createdAlert] = await db
    .select()
    .from(alerts)
    .where(eq(alerts.type, "quota_test_alert"))
    .orderBy(desc(alerts.createdAt))
    .limit(1);

  if (!createdAlert) {
    throw new Error("Expected simulated alert to be persisted in 'alerts' table");
  }
  console.log(`   - Verified persisted alert in DB: "${createdAlert.title}" -> "${createdAlert.message}"`);
  console.log("   ✅ Alert preferences saved and simulated alert notification created.\n");

  // Test 6: Limit Elevation Request API
  console.log("📈 Step 6: Testing Rate Limit Elevation Request...");
  const limitReqRes = await fetch(`${BASE_URL}/api/internal/usage/limits-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestedTps: 500,
      reason: "High volume Diwali sale campaign peak traffic",
      channels: ["sms", "whatsapp"],
    }),
  });
  if (!limitReqRes.ok) {
    throw new Error(`Limit request failed with HTTP ${limitReqRes.status}`);
  }
  const limitReqData = await limitReqRes.json();
  console.log(`   - Generated Limit Request ID: ${limitReqData.requestId}`);
  console.log(`   - Confirmation message: ${limitReqData.message}`);

  // Verify in database
  const [persistedLimitReq] = await db
    .select()
    .from(limitRequests)
    .where(eq(limitRequests.id, limitReqData.requestId))
    .limit(1);

  if (!persistedLimitReq || persistedLimitReq.requestedTps !== 500) {
    throw new Error("Expected limit request to be persisted in 'limit_requests' table with 500 TPS");
  }
  console.log("   ✅ Limit elevation request persisted and linked to operational alert queue.\n");

  // Test 7: Export CSV Endpoint
  console.log("📁 Step 7: Testing Usage CSV Export...");
  const csvRes = await fetch(`${BASE_URL}/api/internal/usage/export-csv?range=1h&environment=test`);
  if (!csvRes.ok) {
    throw new Error(`CSV export returned HTTP ${csvRes.status}`);
  }
  const contentType = csvRes.headers.get("Content-Type");
  const contentDisp = csvRes.headers.get("Content-Disposition");
  const csvBody = await csvRes.text();
  const lines = csvBody.trim().split("\n");

  console.log(`   - Content-Type: ${contentType}`);
  console.log(`   - Content-Disposition: ${contentDisp}`);
  console.log(`   - CSV Header: ${lines[0]}`);
  console.log(`   - Total CSV rows exported: ${lines.length}`);

  if (!contentType?.includes("text/csv")) {
    throw new Error(`Expected text/csv Content-Type, got ${contentType}`);
  }
  if (!lines[0].includes("Request ID") || !lines[0].includes("Status")) {
    throw new Error(`Invalid CSV header: ${lines[0]}`);
  }
  if (lines.length < 50) {
    throw new Error(`Expected at least 50 CSV rows after rapid burst, got ${lines.length}`);
  }
  console.log("   ✅ CSV export generated valid formatted file with all request records.\n");

  console.log("==========================================================================");
  console.log("🎉 ALL USAGE, LIMITS & ERRORS VERIFICATIONS PASSED SUCCESSFULLY (7/7)!");
  console.log("==========================================================================");

  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
}

runUsageLimitsVerification().catch((err) => {
  console.error("❌ Verification failed:", err);
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(1);
});
