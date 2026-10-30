# @relay/node — Official Node.js & TypeScript SDK

Official client library for Relay Indian Telecom & Customer Data Platform (CDP) APIs.

## Installation

```bash
npm install @relay/node
```

## Quick Start

```typescript
import { RelayClient } from "@relay/node";

const relay = new RelayClient({
  apiKey: process.env.RELAY_API_KEY || "rl_test_demo_acmepay_key_01",
});

// 1. Send an SMS OTP Message
const message = await relay.messages.send({
  to: "+919999900001",
  channel: "sms",
  templateId: "dlt_tmpl_otp_login",
  variables: { "1": "481029" },
  senderId: "RELAYI",
});
console.log("Message queued:", message.id);

// 2. Ingest CDP Events
await relay.events.ingest({
  externalId: "cust_acme_7710",
  event: "checkout_completed",
  properties: { amount: 2999, currency: "INR" },
});

// 3. Verify Incoming Webhook Signatures
app.post("/webhooks/relay", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["relay-signature"];
  const isValid = relay.webhooks.verifySignature(req.body, sig, process.env.RELAY_WEBHOOK_SECRET);
  if (!isValid) return res.status(401).send("Invalid signature");
  res.status(200).send("OK");
});
```
