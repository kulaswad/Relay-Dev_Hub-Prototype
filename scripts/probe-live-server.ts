import { spawn, ChildProcess } from "child_process";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 200 || res.status === 307 || res.status === 308) {
        return true;
      }
    } catch {
      // server not ready yet
    }
    await sleep(1000);
  }
  return false;
}

async function runTests() {
  console.log("🚀 Starting Next.js production server on 127.0.0.1:3001...");
  const nextBin = require.resolve("next/dist/bin/next");
  const serverProcess: ChildProcess = spawn(
    process.execPath,
    [nextBin, "start", "-p", "3001", "-H", "127.0.0.1"],
    {
      stdio: "pipe",
      cwd: process.cwd(),
      env: { ...process.env, PORT: "3001" },
    }
  );

  serverProcess.stdout?.on("data", (d) => {
    console.log(`[Next.js stdout]: ${d}`);
  });
  serverProcess.stderr?.on("data", (d) => {
    console.error(`[Next.js stderr]: ${d}`);
  });

  const baseUrl = "http://127.0.0.1:3001";
  console.log("Waiting for server to become ready at " + baseUrl);
  const ready = await waitForServer(baseUrl + "/");
  if (!ready) {
    console.error("❌ Server failed to respond in time.");
    serverProcess.kill();
    process.exit(1);
  }
  console.log("✅ Server is ready! Beginning probe suite...\n");

  try {
    // 1. Sign-in demo user
    console.log("1️⃣ Testing POST /api/auth/sign-in (Demo user)...");
    const signInRes = await fetch(`${baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@acmepay.in", password: "demo1234" }),
    });
    const signInBody = await signInRes.json();
    console.log(`- Status: ${signInRes.status}`, signInBody);
    if (signInRes.status !== 200 || !signInBody.success) {
      throw new Error("Demo sign-in failed");
    }

    const setCookie = signInRes.headers.get("set-cookie") || "";
    console.log(`- Set-Cookie received: ${setCookie.includes("relay_session") ? "YES (relay_session present)" : "NO"}`);
    const cookieMatch = setCookie.match(/relay_session=([^;]+)/);
    const sessionCookie = cookieMatch ? `relay_session=${cookieMatch[1]}` : "";

    // 2. GET /api/auth/me with session
    console.log("\n2️⃣ Testing GET /api/auth/me with session cookie...");
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    const meBody = await meRes.json();
    console.log(`- Status: ${meRes.status}`);
    console.log(`- User: ${meBody.user?.email}, Workspace: ${meBody.workspace?.name}, KYC: ${meBody.workspace?.kycStatus}`);
    if (meRes.status !== 200 || meBody.user?.email !== "demo@acmepay.in") {
      throw new Error("/api/auth/me check failed");
    }

    // 3. GET /api/internal/api-keys with KYC 'in_review' -> Live key should be locked
    console.log("\n3️⃣ Testing GET /api/internal/api-keys (KYC in_review -> live key locked)...");
    const keysRes = await fetch(`${baseUrl}/api/internal/api-keys`, {
      headers: { Cookie: sessionCookie },
    });
    const keysBody = await keysRes.json();
    const liveKey = keysBody.keys.find((k: any) => k.environment === "live");
    console.log(`- Keys found: ${keysBody.keys.length}`);
    console.log(`- Live key locked: ${liveKey?.isLocked ? "YES (Expected)" : "NO (Unexpected)"}`);
    if (!liveKey?.isLocked) {
      throw new Error("Live key should be locked when KYC is in_review");
    }

    // 4. Toggle KYC to approved via /api/internal/simulate-kyc
    console.log("\n4️⃣ Testing POST /api/internal/simulate-kyc (Toggle to 'approved')...");
    const kycRes = await fetch(`${baseUrl}/api/internal/simulate-kyc`, {
      method: "POST",
      headers: { Cookie: sessionCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ kycStatus: "approved" }),
    });
    const kycBody = await kycRes.json();
    console.log(`- New KYC status: ${kycBody.workspace?.kycStatus}`);

    const keysRes2 = await fetch(`${baseUrl}/api/internal/api-keys`, {
      headers: { Cookie: sessionCookie },
    });
    const keysBody2 = await keysRes2.json();
    const liveKey2 = keysBody2.keys.find((k: any) => k.environment === "live");
    console.log(`- Live key locked after KYC approved: ${liveKey2?.isLocked ? "YES (Unexpected)" : "NO (Unlocked successfully ✓)"}`);
    if (liveKey2?.isLocked) {
      throw new Error("Live key should be unlocked when KYC is approved");
    }

    // Revert KYC back to in_review
    await fetch(`${baseUrl}/api/internal/simulate-kyc`, {
      method: "POST",
      headers: { Cookie: sessionCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ kycStatus: "in_review" }),
    });

    // 5. Test Anonymous Evaluation Workspace
    console.log("\n5️⃣ Testing POST /api/auth/evaluation (Anonymous 24h evaluation)...");
    const evalRes = await fetch(`${baseUrl}/api/auth/evaluation`, {
      method: "POST",
    });
    const evalBody = await evalRes.json();
    console.log(`- Status: ${evalRes.status}`, evalBody);
    if (!evalBody.success || !evalBody.workspace?.isAnonymous) {
      throw new Error("Anonymous evaluation workspace creation failed");
    }

    const evalCookie = evalRes.headers.get("set-cookie") || "";
    const evalMatch = evalCookie.match(/relay_session=([^;]+)/);
    const evalSessionCookie = evalMatch ? `relay_session=${evalMatch[1]}` : "";

    const evalMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: evalSessionCookie },
    });
    const evalMeBody = await evalMeRes.json();
    console.log(`- Eval session authenticated: ${evalMeBody.authenticated}, IsAnonymous: ${evalMeBody.isAnonymous}, Workspace: ${evalMeBody.workspace?.name}`);
    if (!evalMeBody.authenticated || !evalMeBody.isAnonymous) {
      throw new Error("Anonymous eval session check failed");
    }

    // 6. Test Webhook Replay endpoint
    console.log("\n6️⃣ Testing POST /api/internal/webhooks/replay...");
    const replayRes = await fetch(`${baseUrl}/api/internal/webhooks/replay`, {
      method: "POST",
      headers: { Cookie: sessionCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId: "del_ep1_att3" }),
    });
    const replayBody = await replayRes.json();
    console.log(`- Replay response status: ${replayRes.status}`, replayBody);
    if (!replayBody.success || !replayBody.replayId) {
      throw new Error("Webhook replay failed");
    }
    console.log(`- New delivery attempt recorded: Replay ID ${replayBody.replayId}, Response Status: ${replayBody.responseStatus}`);

    // 7. Test Sign-out
    console.log("\n7️⃣ Testing POST /api/auth/sign-out...");
    const signOutRes = await fetch(`${baseUrl}/api/auth/sign-out`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    const signOutCookie = signOutRes.headers.get("set-cookie") || "";
    console.log(`- Sign-out cookie header clears session: ${signOutCookie.includes("Max-Age=0") || signOutCookie.includes("1970") || signOutCookie.includes("relay_session=;") ? "YES (Cleared successfully ✓)" : "NO"}`);

    // 8. Test Sign-up with fresh user
    console.log("\n8️⃣ Testing POST /api/auth/sign-up (Fresh developer registration)...");
    const freshEmail = `dev_${Date.now()}@fintechcorp.in`;
    const signUpRes = await fetch(`${baseUrl}/api/auth/sign-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Vikram Rathore",
        email: freshEmail,
        password: "securePassword123!",
        company: "FintechCorp",
        role: "Backend dev",
        intent: "Evaluating Relay",
      }),
    });
    const signUpBody = await signUpRes.json();
    console.log(`- Status: ${signUpRes.status}`);
    console.log(`- Created Workspace: ${signUpBody.workspace?.name}, KYC: ${signUpBody.workspace?.kycStatus}`);
    if (signUpRes.status !== 200 || !signUpBody.success || signUpBody.workspace?.kycStatus !== "not_started") {
      throw new Error("Sign-up flow failed");
    }
    const signUpCookie = signUpRes.headers.get("set-cookie") || "";
    console.log(`- Session cookie issued: ${signUpCookie.includes("relay_session") ? "YES (Valid ✓)" : "NO"}`);

    console.log("\n=======================================================");
    console.log("🎉 ALL LIVE HTTP PROBES PASSED SUCCESSFULLY!");
    console.log("=======================================================");
  } finally {
    console.log("Shutting down test server...");
    serverProcess.kill();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
