# Sample App: Webhook Receiver with HMAC Verification (Express)

A production-ready Express server that receives signed Relay webhook payloads, demonstrates raw-body extraction, and verifies HMAC-SHA256 signatures with 300-second clock drift replay protection.

## Why Raw Body Bytes Matter

A common trap when verifying webhooks in Node.js is parsing JSON (`app.use(express.json())`) and then re-stringifying it (`JSON.stringify(req.body)`). Re-stringified JSON changes key ordering and whitespace indentation, causing HMAC verification to fail with a false 401 error.

This sample demonstrates how to configure Express's `verify` hook to capture the untouched `req.rawBody` buffer.

## How to Run

1. Start the receiver:
   ```bash
   npx tsx server.ts
   ```
2. In the Relay Console -> Webhooks, register `http://localhost:4000/webhooks/relay` and send a test event.
