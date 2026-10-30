/**
 * Runnable Sample App: Webhook Receiver in Express
 * Demonstrates:
 * 1. Preserving the exact raw body bytes before parsing JSON (Express best practice).
 * 2. Cryptographic HMAC-SHA256 signature verification.
 * 3. 5-minute timestamp drift replay protection.
 * 4. Dual-signing rotation tolerance.
 */

import express, { Request, Response } from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 4000;
const SIGNING_SECRET = process.env.RELAY_SIGNING_SECRET || "whsec_test_demo_acmepay_secret";

// CRITICAL STEP: Express must capture raw body buffer before JSON parsing
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

app.use(
  express.json({
    verify: (req: RequestWithRawBody, _res, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);

function verifyRelaySignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader) return false;

  // 1. Extract timestamp: t=1793310000
  const tMatch = signatureHeader.match(/t=(\d+)/);
  if (!tMatch) return false;
  const timestamp = tMatch[1];

  // 2. Prevent replay attacks: Reject if older than 300 seconds (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    console.warn("⚠️ Signature rejected: Timestamp drift > 300s");
    return false;
  }

  // 3. Compute expected HMAC: "{timestamp}.{rawBodyBytes}"
  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // 4. Compare against all v1 signatures in header (supports dual-signing rotation)
  const v1Signatures = Array.from(signatureHeader.matchAll(/v1=([a-f0-9]{64})/g)).map((m) => m[1]);

  return v1Signatures.some((receivedSig) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(receivedSig, "hex"),
        Buffer.from(computedHash, "hex")
      );
    } catch {
      return false;
    }
  });
}

app.post("/webhooks/relay", (req: RequestWithRawBody, res: Response) => {
  const sigHeader = (req.headers["relay-signature"] || req.headers["x-relay-signature"]) as string;

  if (!req.rawBody) {
    return res.status(400).json({ error: "Missing raw body buffer" });
  }

  const isValid = verifyRelaySignature(req.rawBody, sigHeader, SIGNING_SECRET);

  if (!isValid) {
    console.error("❌ Invalid signature received! Possible replay or incorrect secret.");
    return res.status(401).json({
      error: "invalid_signature",
      message: "HMAC-SHA256 signature mismatch or timestamp drift exceeded.",
    });
  }

  const event = req.body;
  console.log(`\n✅ Verified Webhook Received: [${event.type}] (ID: ${event.id})`);

  if (event.type === "message.delivered") {
    console.log(`   - Handset DLR confirmed for recipient: ${event.data?.object?.recipient}`);
    console.log(`   - Carrier: ${event.data?.object?.carrier} (${event.data?.object?.circle})`);
  } else if (event.type === "message.failed") {
    console.warn(`   - Delivery Failed! Reason: ${event.data?.object?.failure_reason}`);
  }

  // Always return a prompt 2xx acknowledgment
  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Relay Webhook Receiver listening on http://localhost:${PORT}/webhooks/relay`);
  console.log(`   - Active Secret: ${SIGNING_SECRET.slice(0, 14)}...`);
});
