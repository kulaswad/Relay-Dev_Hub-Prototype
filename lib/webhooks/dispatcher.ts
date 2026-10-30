import { db } from "@/lib/db";
import {
  webhookEndpoints,
  webhookEvents,
  webhookDeliveries,
  workspaces,
} from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import crypto from "crypto";

export const RETRY_INTERVALS_SECONDS = [
  60, // 1 min (Attempt 1 -> 2)
  300, // 5 min (Attempt 2 -> 3)
  1800, // 30 min (Attempt 3 -> 4)
  7200, // 2 hours (Attempt 4 -> 5)
  21600, // 6 hours (Attempt 5 -> 6)
  43200, // 12 hours (Attempt 6 -> 7)
];

export interface DispatchWebhookParams {
  workspaceId: string;
  environment: "test" | "live";
  eventType: string;
  data?: Record<string, any>;
  payload?: Record<string, any>;
  apiVersion?: string;
  targetEndpointId?: string;
}

/**
 * Computes HMAC-SHA256 signature header for webhook payload.
 * Supports dual-signing if previous secret is active during rotation grace period.
 */
export function computeRelaySignature(
  payloadString: string,
  secret: string,
  previousSecret?: string | null,
  rotationEndsAt?: Date | null
): { signatureHeader: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const signaturePayload = `${timestamp}.${payloadString}`;

  const primarySig = crypto
    .createHmac("sha256", secret)
    .update(signaturePayload)
    .digest("hex");

  let signatureHeader = `t=${timestamp},v1=${primarySig}`;

  // If secret rotation is active and within grace period, append second v1 signature
  if (
    previousSecret &&
    rotationEndsAt &&
    new Date(rotationEndsAt).getTime() > Date.now()
  ) {
    const secondarySig = crypto
      .createHmac("sha256", previousSecret)
      .update(signaturePayload)
      .digest("hex");
    signatureHeader += `,v1=${secondarySig}`;
  }

  return { signatureHeader, timestamp };
}

/**
 * Execute an HTTP delivery attempt to a webhook receiver
 */
export async function executeDeliveryAttempt(params: {
  deliveryId: string;
  eventId: string;
  endpointId: string;
  workspaceId: string;
  attemptNumber: number;
  url: string;
  signingSecret: string;
  previousSigningSecret?: string | null;
  secretRotationEndsAt?: Date | null;
  rawEnvelopeString: string;
  eventType: string;
  replayOfId?: string | null;
  accelerationFactor?: number;
}): Promise<{
  status: "success" | "failed" | "retrying" | "abandoned";
  responseStatus: number | null;
  responseBody: string | null;
  durationMs: number;
  errorType: string;
}> {
  const {
    deliveryId,
    eventId,
    endpointId,
    workspaceId,
    attemptNumber,
    url,
    signingSecret,
    previousSigningSecret,
    secretRotationEndsAt,
    rawEnvelopeString,
    eventType,
    replayOfId,
    accelerationFactor = 1,
  } = params;

  // Compute HMAC signature
  const { signatureHeader } = computeRelaySignature(
    rawEnvelopeString,
    signingSecret,
    previousSigningSecret,
    secretRotationEndsAt
  );

  const requestHeaders = {
    "content-type": "application/json",
    "relay-event-id": eventId,
    "relay-event-type": eventType,
    "relay-delivery-id": deliveryId,
    "relay-attempt": String(attemptNumber),
    "user-agent": "Relay-Webhooks/1.0",
    "relay-signature": signatureHeader,
  };

  const startTime = Date.now();
  let responseStatus: number | null = null;
  let responseHeadersObj: Record<string, string> = {};
  let responseBodyText: string | null = null;
  let errorType:
    | "none"
    | "timeout"
    | "connection_refused"
    | "http_5xx"
    | "http_4xx"
    | "signature_rejected"
    | "ssl_error" = "none";
  let deliveryStatus: "success" | "failed" | "retrying" | "abandoned" = "failed";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const fetchResponse = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body: rawEnvelopeString,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    responseStatus = fetchResponse.status;
    fetchResponse.headers.forEach((v, k) => {
      responseHeadersObj[k] = v;
    });

    const fullBody = await fetchResponse.text();
    responseBodyText = fullBody.slice(0, 4096); // Store up to first 4KB

    if (fetchResponse.ok) {
      deliveryStatus = "success";
      errorType = "none";
    } else if (responseStatus === 401 || fullBody.toLowerCase().includes("signature")) {
      deliveryStatus = attemptNumber >= 7 ? "abandoned" : "retrying";
      errorType = "signature_rejected";
    } else if (responseStatus >= 500) {
      deliveryStatus = attemptNumber >= 7 ? "abandoned" : "retrying";
      errorType = "http_5xx";
    } else {
      deliveryStatus = attemptNumber >= 7 ? "abandoned" : "retrying";
      errorType = "http_4xx";
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      errorType = "timeout";
      responseBodyText = "ClientTimeoutError: Destination server did not respond within 10,000ms.";
    } else if (err.code === "ECONNREFUSED" || err.message?.includes("fetch failed")) {
      errorType = "connection_refused";
      responseBodyText = `ConnectionRefusedError: Unable to connect to host at ${url}.`;
    } else {
      errorType = "connection_refused";
      responseBodyText = err.message || "Network error occurred.";
    }
    deliveryStatus = attemptNumber >= 7 ? "abandoned" : "retrying";
  }

  const durationMs = Date.now() - startTime;
  const attemptedAt = new Date();

  // Compute next retry countdown if retrying
  let nextRetryAt: Date | null = null;
  if (deliveryStatus === "retrying" && attemptNumber < 7) {
    const baseSeconds = RETRY_INTERVALS_SECONDS[attemptNumber - 1] || 60;
    // Apply time acceleration (e.g. 12x means 60s becomes 5s)
    const effectiveSeconds = Math.max(1, Math.round(baseSeconds / Math.max(1, accelerationFactor)));
    nextRetryAt = new Date(Date.now() + effectiveSeconds * 1000);
  }

  // Insert delivery attempt record
  await db.insert(webhookDeliveries).values({
    id: deliveryId,
    eventId: eventId,
    endpointId: endpointId,
    workspaceId: workspaceId,
    attemptNumber: attemptNumber,
    requestHeaders: JSON.stringify(requestHeaders),
    requestBody: rawEnvelopeString,
    responseStatus: responseStatus,
    responseHeaders: JSON.stringify(responseHeadersObj),
    responseBody: responseBodyText,
    durationMs: durationMs,
    errorType: errorType,
    status: deliveryStatus,
    scheduledAt: attemptedAt,
    attemptedAt: attemptedAt,
    nextRetryAt: nextRetryAt,
    replayOfId: replayOfId || null,
  });

  // Update endpoint consecutive failures & status
  if (deliveryStatus === "success") {
    await db
      .update(webhookEndpoints)
      .set({ consecutiveFailures: 0, status: "active" })
      .where(eq(webhookEndpoints.id, endpointId));
  } else {
    const [ep] = await db
      .select({ count: webhookEndpoints.consecutiveFailures })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, endpointId));
    const newFailures = (ep?.count || 0) + 1;
    await db
      .update(webhookEndpoints)
      .set({
        consecutiveFailures: newFailures,
        status: newFailures >= 5 ? "failing" : "active",
      })
      .where(eq(webhookEndpoints.id, endpointId));
  }

  return {
    status: deliveryStatus,
    responseStatus,
    responseBody: responseBodyText,
    durationMs,
    errorType,
  };
}

/**
 * Dispatch an event to all subscribed endpoints in the workspace
 */
export async function dispatchWebhookEvent(params: DispatchWebhookParams) {
  try {
    const apiVersion = params.apiVersion || "v2025-10-01";
    const now = new Date();

    // 1. Get workspace config (acceleration factor)
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, params.workspaceId))
      .limit(1);

    const accel = ws?.accelerationFactor || 1;

    // 2. Fetch subscribed active endpoints
    let query = db
      .select()
      .from(webhookEndpoints)
      .where(
        params.targetEndpointId
          ? eq(webhookEndpoints.id, params.targetEndpointId)
          : and(
              eq(webhookEndpoints.workspaceId, params.workspaceId),
              eq(webhookEndpoints.environment, params.environment),
              sql`${webhookEndpoints.status} != 'disabled'`
            )
      );

    const endpoints = await query;

    for (const ep of endpoints) {
      let subscribedEvents: string[] = [];
      try {
        subscribedEvents = JSON.parse(ep.events);
      } catch {
        subscribedEvents = ["*"];
      }

      const isSubscribed =
        subscribedEvents.includes("*") || subscribedEvents.includes(params.eventType);

      if (!isSubscribed) continue;

      // 3. Construct Standard Webhook Event Envelope
      const eventId = `evt_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
      const eventData = params.data || params.payload || {};
      const envelope = {
        id: eventId,
        type: params.eventType,
        api_version: apiVersion,
        created_at: now.toISOString(),
        data: {
          object: eventData,
        },
      };
      const rawEnvelopeString = JSON.stringify(envelope);

      // 4. Save Event Record
      await db.insert(webhookEvents).values({
        id: eventId,
        workspaceId: params.workspaceId,
        endpointId: ep.id,
        type: params.eventType,
        payload: rawEnvelopeString,
        createdAt: now,
        apiVersion: apiVersion,
      });

      // 5. Initial Delivery Attempt (Attempt 1)
      const deliveryId = `del_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
      await executeDeliveryAttempt({
        deliveryId,
        eventId,
        endpointId: ep.id,
        workspaceId: params.workspaceId,
        attemptNumber: 1,
        url: ep.url,
        signingSecret: ep.signingSecret,
        previousSigningSecret: ep.previousSigningSecret,
        secretRotationEndsAt: ep.secretRotationEndsAt,
        rawEnvelopeString,
        eventType: params.eventType,
        accelerationFactor: accel,
      });
    }
  } catch (err) {
    console.error("Error in dispatchWebhookEvent:", err);
  }
}
