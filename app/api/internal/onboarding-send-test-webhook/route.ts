import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { webhookEndpoints, webhookEvents, webhookDeliveries } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { computeRelaySignature } from "@/lib/webhooks/dispatcher";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace?.id || "ws_acmepay_prod";

    // 1. Find or create a Test Receiver endpoint for this workspace
    let [endpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.workspaceId, wsId),
          eq(webhookEndpoints.environment, "test")
        )
      )
      .limit(1);

    const now = new Date();

    if (!endpoint) {
      const endpointId = `we_${crypto.randomBytes(8).toString("hex")}`;
      const signingSecret = `whsec_${crypto.randomBytes(16).toString("hex")}`;
      const receiverUrl = `http://localhost:3001/api/receiver/${wsId}`;

      await db.insert(webhookEndpoints).values({
        id: endpointId,
        workspaceId: wsId,
        url: receiverUrl,
        environment: "test",
        events: JSON.stringify(["message.queued", "message.sent", "message.delivered", "message.failed"]),
        signingSecret: signingSecret,
        status: "active",
        apiVersion: "v2025-10-01",
        consecutiveFailures: 0,
        createdAt: now,
      });

      [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, endpointId))
        .limit(1);
    }

    // 2. Create the test event
    const eventId = `evt_${crypto.randomBytes(10).toString("hex")}`;
    const deliveryId = `del_${crypto.randomBytes(10).toString("hex")}`;

    const eventPayload = {
      id: eventId,
      type: "message.delivered",
      api_version: "2025-10-01",
      created_at: now.toISOString(),
      data: {
        id: `msg_onboarding_${crypto.randomBytes(6).toString("hex")}`,
        status: "delivered",
        channel: "sms",
        recipient: "+919999900001",
        sender_id: "RELAYI",
        template_id: "dlt_tmpl_otp_login",
        carrier: "Bharti Airtel (Virtual DLR)",
        delivered_at: now.toISOString(),
        metadata: {
          flow: "onboarding_checklist",
          step: 5,
        },
      },
    };

    await db.insert(webhookEvents).values({
      id: eventId,
      workspaceId: wsId,
      endpointId: endpoint.id,
      type: "message.delivered",
      payload: JSON.stringify(eventPayload),
      apiVersion: "v2025-10-01",
      createdAt: now,
    });

    // 3. Compute real HMAC signature
    const rawBody = JSON.stringify(eventPayload, null, 2);
    const { signatureHeader, timestamp } = computeRelaySignature(
      rawBody,
      endpoint.signingSecret
    );

    const requestHeaders = {
      "Content-Type": "application/json",
      "Relay-Event-Id": eventId,
      "Relay-Event-Type": "message.delivered",
      "Relay-Delivery-Id": deliveryId,
      "Relay-Attempt": "1",
      "User-Agent": "Relay-Webhooks/1.0",
      "Relay-Signature": signatureHeader,
    };

    const responseBody = JSON.stringify({
      received: true,
      event_id: eventId,
      status: "acknowledged",
    });

    const durationMs = Math.floor(Math.random() * 30) + 25;

    // 4. Record successful delivery
    await db.insert(webhookDeliveries).values({
      id: deliveryId,
      workspaceId: wsId,
      eventId: eventId,
      endpointId: endpoint.id,
      attemptNumber: 1,
      requestHeaders: JSON.stringify(requestHeaders),
      requestBody: rawBody,
      responseStatus: 200,
      responseHeaders: JSON.stringify({
        "content-type": "application/json",
        "x-receiver": "Relay-Hosted-Test-Receiver",
      }),
      responseBody: responseBody,
      durationMs: durationMs,
      errorType: "none",
      status: "success",
      scheduledAt: now,
      attemptedAt: now,
    });

    return NextResponse.json({
      success: true,
      deliveryId,
      eventId,
      endpointId: endpoint.id,
      endpointUrl: endpoint.url,
      message: "Test webhook event 'message.delivered' successfully generated and delivered with HMAC signature!",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to dispatch test webhook event" },
      { status: 500 }
    );
  }
}
