import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, webhookEndpoints } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  const wsId = params.workspaceId;

  // 1. Fetch workspace to determine receiver behavior
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, wsId))
    .limit(1);

  const behavior = ws?.receiverBehavior || "200";
  const signatureHeader = req.headers.get("relay-signature") || "";
  const eventId = req.headers.get("relay-event-id") || "";
  const eventType = req.headers.get("relay-event-type") || "";

  // 2. Behavioral Switcher
  if (behavior === "500") {
    return new NextResponse(
      `TypeError: Cannot read properties of null (reading 'toString')
    at PaymentHookHandler.handleDeliveryReceipt (src/webhooks/relay.ts:54:32)
    at Layer.handle [as handle_request] (node_modules/express/lib/router/layer.js:95:5)
    at next (node_modules/express/lib/router/route.js:144:13)
    at jsonParser (node_modules/body-parser/lib/types/json.js:110:7)
    at Layer.handle [as handle_request] (node_modules/express/lib/router/layer.js:95:5)`,
      {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }
    );
  }

  if (behavior === "401") {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "invalid signature: calculated hash 7a8f90... does not match provided v1 header",
      },
      { status: 401 }
    );
  }

  if (behavior === "timeout") {
    // Sleep 12 seconds to exceed client 10s timeout
    await new Promise((resolve) => setTimeout(resolve, 12000));
    return NextResponse.json({ delayed: true }, { status: 200 });
  }

  if (behavior === "verify_signature") {
    const rawBody = await req.text();

    // Look up endpoint signing secret
    const [ep] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.workspaceId, wsId))
      .limit(1);

    const secret = ep?.signingSecret || "whsec_test_default";

    // Parse header: t=...,v1=...
    const match = signatureHeader.match(/t=(\d+),v1=([a-f0-9]+)/);
    if (!match) {
      return NextResponse.json(
        {
          verified: false,
          error: "invalid_header",
          message: "Header 'Relay-Signature' format must be 't=...,v1=...'",
        },
        { status: 401 }
      );
    }

    const [, timestampStr, receivedHash] = match;
    const timestamp = parseInt(timestampStr, 10);
    const nowEpoch = Math.floor(Date.now() / 1000);

    // Replay tolerance: 5 minutes (300 seconds)
    if (Math.abs(nowEpoch - timestamp) > 300) {
      return NextResponse.json(
        {
          verified: false,
          error: "timestamp_drift_exceeded",
          message: "Signature timestamp drift exceeds 300 seconds (replay attack protection).",
        },
        { status: 401 }
      );
    }

    const expectedHash = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    let isMatch = false;
    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(receivedHash, "hex"),
        Buffer.from(expectedHash, "hex")
      );
    } catch {
      isMatch = false;
    }

    if (!isMatch) {
      return NextResponse.json(
        {
          verified: false,
          error: "signature_mismatch",
          message: "Calculated HMAC does not match received v1 header.",
          hint: "Ensure you are calculating HMAC over the exact raw body string, not re-serialized JSON.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        received: true,
        verified: true,
        eventId,
        eventType,
        message: "Signature authenticated successfully via timing-safe HMAC.",
      },
      { status: 200 }
    );
  }

  // Default: Respond 200 OK
  return NextResponse.json(
    {
      received: true,
      status: "acknowledged",
      eventId,
      eventType,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  return NextResponse.json({
    status: "online",
    receiver: "Relay Test Receiver",
    workspaceId: params.workspaceId,
    usage: "Configure this URL as your webhook endpoint: http://localhost:3001/api/receiver/" + params.workspaceId,
  });
}
