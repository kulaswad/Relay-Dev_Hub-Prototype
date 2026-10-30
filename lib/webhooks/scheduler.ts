import { db } from "@/lib/db";
import {
  webhookDeliveries,
  webhookEvents,
  webhookEndpoints,
  workspaces,
} from "@/lib/db/schema";
import { eq, and, lte, desc, sql, inArray } from "drizzle-orm";
import { executeDeliveryAttempt } from "./dispatcher";
import crypto from "crypto";

/**
 * Replays an existing webhook delivery with a fresh timestamp and signature
 */
export async function replayWebhookDelivery(deliveryId: string) {
  // 1. Fetch original delivery
  const [original] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);

  if (!original) {
    throw new Error(`Delivery '${deliveryId}' not found.`);
  }

  // 2. Fetch corresponding event and current endpoint
  const [event] = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, original.eventId))
    .limit(1);

  if (!event) {
    throw new Error(`Associated event '${original.eventId}' not found.`);
  }

  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, original.endpointId))
    .limit(1);

  if (!endpoint) {
    throw new Error(`Endpoint '${original.endpointId}' not found.`);
  }

  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, original.workspaceId))
    .limit(1);

  const accel = ws?.accelerationFactor || 1;
  const newDeliveryId = `del_replay_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

  // Execute replay attempt
  const result = await executeDeliveryAttempt({
    deliveryId: newDeliveryId,
    eventId: event.id,
    endpointId: endpoint.id,
    workspaceId: original.workspaceId,
    attemptNumber: 1, // Replays are recorded as new attempt
    url: endpoint.url,
    signingSecret: endpoint.signingSecret,
    previousSigningSecret: endpoint.previousSigningSecret,
    secretRotationEndsAt: endpoint.secretRotationEndsAt,
    rawEnvelopeString: original.requestBody,
    eventType: event.type,
    replayOfId: original.id,
    accelerationFactor: accel,
  });

  const [createdDelivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, newDeliveryId))
    .limit(1);

  return {
    success: true,
    delivery: createdDelivery,
    result,
  };
}

/**
 * Immediately execute next retry for a delivery currently in 'retrying' status
 */
export async function retryDeliveryNow(deliveryId: string) {
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);

  if (!delivery) {
    throw new Error(`Delivery '${deliveryId}' not found.`);
  }

  const [event] = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, delivery.eventId))
    .limit(1);

  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, delivery.endpointId))
    .limit(1);

  if (!event || !endpoint) {
    throw new Error("Associated event or endpoint not found.");
  }

  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, delivery.workspaceId))
    .limit(1);

  const nextAttemptNum = delivery.attemptNumber + 1;
  const newDeliveryId = `del_att_${nextAttemptNum}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

  const result = await executeDeliveryAttempt({
    deliveryId: newDeliveryId,
    eventId: event.id,
    endpointId: endpoint.id,
    workspaceId: delivery.workspaceId,
    attemptNumber: nextAttemptNum,
    url: endpoint.url,
    signingSecret: endpoint.signingSecret,
    previousSigningSecret: endpoint.previousSigningSecret,
    secretRotationEndsAt: endpoint.secretRotationEndsAt,
    rawEnvelopeString: delivery.requestBody,
    eventType: event.type,
    replayOfId: delivery.id,
    accelerationFactor: ws?.accelerationFactor || 1,
  });

  // Mark previous delivery as superseded
  await db
    .update(webhookDeliveries)
    .set({ status: "failed" })
    .where(eq(webhookDeliveries.id, delivery.id));

  const [createdDelivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, newDeliveryId))
    .limit(1);

  return {
    success: true,
    delivery: createdDelivery,
    result,
  };
}

/**
 * Scan and process all due retries across the database
 */
export async function processDueWebhookRetries() {
  const now = new Date();

  // Find all deliveries in 'retrying' state whose nextRetryAt has arrived
  const dueDeliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "retrying"),
        lte(webhookDeliveries.nextRetryAt, now)
      )
    )
    .limit(25);

  const processed: string[] = [];

  for (const deliv of dueDeliveries) {
    try {
      await retryDeliveryNow(deliv.id);
      processed.push(deliv.id);
    } catch (e) {
      console.error(`Error retrying delivery ${deliv.id}:`, e);
    }
  }

  return { count: processed.length, deliveryIds: processed };
}

// Background scheduler interval (checks for due retries every 4 seconds)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    processDueWebhookRetries().catch(() => {});
  }, 4000).unref?.();
}
