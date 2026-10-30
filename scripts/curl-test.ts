import { spawn, execSync, ChildProcess } from "child_process";
import { db } from "../lib/db";
import { apiKeys } from "../lib/db/schema";
import { eq } from "drizzle-orm";

let serverProcess: ChildProcess | null = null;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:3001/api/v1/health");
    return res.status === 200;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isServerRunning()) return;

  const nextBin = require.resolve("next/dist/bin/next");
  serverProcess = spawn(
    process.execPath,
    [nextBin, "start", "-p", "3001", "-H", "127.0.0.1"],
    {
      stdio: "pipe",
      cwd: process.cwd(),
      env: { ...process.env, PORT: "3001" },
    }
  );

  let attempts = 0;
  while (attempts < 25) {
    if (await isServerRunning()) return;
    await sleep(800);
    attempts++;
  }
  throw new Error("Server failed to start");
}

async function main() {
  await ensureServer();

  const [testKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.environment, "test"))
    .limit(1);

  if (!testKey || !testKey.fullKeyForDev) {
    console.error("Test key not found");
    return;
  }

  const key = testKey.fullKeyForDev;
  console.log(`🔑 Using Key: ${key.slice(0, 16)}...`);

  console.log("\n=======================================================");
  console.log("CURL TEST 1: POST /api/v1/messages");
  console.log("=======================================================");
  const curl1 = `curl.exe -s -i -X POST http://127.0.0.1:3001/api/v1/messages -H "Authorization: Bearer ${key}" -H "Content-Type: application/json" -H "Relay-Version: 2025-10-01" -H "Idempotency-Key: curl-sample-key-1" -d "{\\"to\\": \\"+919999900001\\", \\"channel\\": \\"sms\\", \\"template_id\\": \\"dlt_tmpl_otp_login\\", \\"variables\\": {\\"1\\": \\"938102\\"}}"`;
  console.log(execSync(curl1, { encoding: "utf-8" }));

  console.log("\n=======================================================");
  console.log("CURL TEST 2: POST /api/v1/messages (IDEMPOTENT REPLAY)");
  console.log("=======================================================");
  console.log(execSync(curl1, { encoding: "utf-8" }));

  console.log("\n=======================================================");
  console.log("CURL TEST 3: GET /api/v1/usage");
  console.log("=======================================================");
  const curl2 = `curl.exe -s -i http://127.0.0.1:3001/api/v1/usage -H "Authorization: Bearer ${key}"`;
  console.log(execSync(curl2, { encoding: "utf-8" }));

  console.log("\n=======================================================");
  console.log("CURL TEST 4: GET /api/v1/delivery-status");
  console.log("=======================================================");
  const curl3 = `curl.exe -s -i http://127.0.0.1:3001/api/v1/delivery-status?limit=2 -H "Authorization: Bearer ${key}"`;
  console.log(execSync(curl3, { encoding: "utf-8" }));

  if (serverProcess) {
    serverProcess.kill();
  }
}

main().catch((err) => {
  console.error(err);
  if (serverProcess) serverProcess.kill();
});
