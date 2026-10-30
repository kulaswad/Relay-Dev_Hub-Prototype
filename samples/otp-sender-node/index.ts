/**
 * Runnable Sample App: OTP Sender in Node.js
 * Calls Relay Sandbox API to dispatch a 6-digit login OTP
 */

const RELAY_API_KEY = process.env.RELAY_API_KEY || "rl_test_demo_acmepay_key_01";
const BASE_URL = process.env.RELAY_BASE_URL || "http://localhost:3001/api/v1";

async function sendOtp(phone: string, otpCode: string) {
  console.log(`\n📲 Dispatching verification OTP to ${phone}...`);

  const response = await fetch(`${BASE_URL}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RELAY_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    },
    body: JSON.stringify({
      to: phone,
      channel: "sms",
      template_id: "dlt_tmpl_otp_login",
      variables: { "1": otpCode },
      sender_id: "RELAYI",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("❌ Failed to send OTP:", data);
    return;
  }

  console.log("✅ OTP Message Queued Successfully!");
  console.log("   - Message ID:", data.id);
  console.log("   - Initial Status:", data.status);
  console.log("   - Estimated Cost:", `₹${data.cost?.estimated || 0.12}`);

  // Poll status after 2 seconds to observe carrier delivery
  console.log("\n⏳ Waiting 2 seconds for simulated telecom carrier receipt...");
  await new Promise((r) => setTimeout(r, 2000));

  const pollRes = await fetch(`${BASE_URL}/messages/${data.id}`, {
    headers: { Authorization: `Bearer ${RELAY_API_KEY}` },
  });
  const pollData = await pollRes.json();
  console.log("📡 Carrier Status Update:", pollData.status);
  console.log("   - Delivery Timeline:", pollData.timeline?.map((t: any) => `${t.status} (${t.timestamp})`).join(" -> "));
}

async function main() {
  const testNumber = process.argv[2] || "+919999900001";
  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
  await sendOtp(testNumber, testOtp);
}

main().catch(console.error);
