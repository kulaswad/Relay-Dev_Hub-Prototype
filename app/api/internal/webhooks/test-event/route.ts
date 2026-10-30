import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { webhookEndpoints, webhookDeliveries, webhookEvents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatcher";
import { z } from "zod";

const TestEventSchema = z.object({
  endpointId: z.string(),
  eventType: z.enum([
    "message.queued",
    "message.sent",
    "message.delivered",
    "message.failed",
    "message.read",
    "customer.profile.updated",
    "customer.consent.changed",
    "workspace.kyc.updated",
  ]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();
    const { endpointId, eventType } = TestEventSchema.parse(body);

    const [ep] = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.workspaceId, wsId)
        )
      )
      .limit(1);

    if (!ep) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    // Build sample payload for this event type
    let sampleData: Record<string, any> = {};

    if (eventType.startsWith("message.")) {
      sampleData = {
        id: "msg_test_samp_" + Date.now().toString(36),
        channel: "sms",
        recipient: "+919876543210",
        sender_id: "ACMEPY",
        template_id: "dlt_tmpl_otp_login",
        status: eventType.replace("message.", ""),
        carrier: "Bharti Airtel",
        circle: "Karnataka",
        failure_reason: eventType === "message.failed" ? "handset_unreachable" : null,
        metadata: { source: "test_event_dispatcher" },
      };
    } else if (eventType.startsWith("customer.")) {
      sampleData = {
        id: "prf_cust_samp_01",
        external_id: "cust_acmepay_9921",
        updated_fields: ["kyc_status", "preferred_channel"],
        traits: { tier: "gold", city: "Bengaluru", kyc_verified: true },
        consent: { sms_opt_in: true, whatsapp_opt_in: true },
      };
    } else {
      sampleData = {
        workspace_id: wsId,
        kyc_status: "approved",
        approved_at: new Date().toISOString(),
        sender_ids: ["ACMEPY", "RELAYI"],
      };
    }

    await dispatchWebhookEvent({
      workspaceId: wsId,
      environment: ep.environment,
      eventType: eventType,
      data: sampleData,
      apiVersion: ep.apiVersion,
      targetEndpointId: ep.id,
    });

    // Fetch the delivery that was just executed
    const [latestDelivery] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, ep.id))
      .orderBy(desc(webhookDeliveries.attemptedAt))
      .limit(1);

    return NextResponse.json({
      success: true,
      delivery: latestDelivery,
      message: `Test event '${eventType}' fired to ${ep.url}. HTTP ${latestDelivery?.responseStatus || "Error"}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
