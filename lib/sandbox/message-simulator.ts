import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatcher";

export const PREAPPROVED_TEMPLATES: Record<
  string,
  { name: string; template: string; dltId: string; channel: string }
> = {
  dlt_tmpl_otp_login: {
    name: "AcmePay OTP Verification",
    template: "Your AcmePay verification code is {#var#}. Valid for 10 minutes. Do not share this OTP with anyone. - AcmePay",
    dltId: "1107161829304918234",
    channel: "sms",
  },
  dlt_tmpl_order_update: {
    name: "Order Dispatch Notification",
    template: "Hi {#var#}, your order #{#var#} has been shipped via {#var#}. Track at {#var#}. - Relay",
    dltId: "1107161829304918235",
    channel: "all",
  },
  dlt_tmpl_payment_reminder: {
    name: "Utility Payment Reminder",
    template: "Dear Customer, payment of Rs. {#var#} is due on {#var#}. Pay now at {#var#} to avoid penalty. - AcmePay",
    dltId: "1107161829304918236",
    channel: "all",
  },
};

export const TEST_NUMBERS = {
  ALWAYS_DELIVERS: "+919999900001",
  HANDSET_UNREACHABLE: "+919999900002",
  DND_REGISTERED: "+919999900003",
  STAYS_SENT: "+919999900004",
  TRIGGERS_RATE_LIMIT: "+919999900005",
};

export function isValidIndianE164(phone: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

export function maskPhoneNumber(phone: string): string {
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 5)}•••••${phone.slice(-2)}`;
}

/**
 * Advances message states in background (queued -> sent -> delivered/failed/read)
 * and dispatches corresponding webhooks
 */
export function scheduleMessageLifecycle(params: {
  messageId: string;
  workspaceId: string;
  environment: "test" | "live";
  recipient: string;
  channel: "sms" | "rcs" | "whatsapp";
  apiVersion?: string;
}) {
  const { messageId, workspaceId, environment, recipient, channel, apiVersion } = params;

  // Scenario 3: DND Registered fails fast
  if (recipient === TEST_NUMBERS.DND_REGISTERED) {
    setTimeout(async () => {
      try {
        await db
          .update(messages)
          .set({
            status: "failed",
            failureReason: "dnd_registered: Recipient is registered in NDNC registry (National Do Not Call). Promotional traffic barred.",
            updatedAt: new Date(),
          })
          .where(eq(messages.id, messageId));

        await dispatchWebhookEvent({
          workspaceId,
          environment,
          eventType: "message.failed",
          apiVersion,
          payload: {
            event: "message.failed",
            message_id: messageId,
            channel,
            recipient: maskPhoneNumber(recipient),
            status: "failed",
            failure_reason: "dnd_registered",
            timestamp: new Date().toISOString(),
          },
        });
      } catch (e) {
        console.error("Simulation error (DND):", e);
      }
    }, 1000);
    return;
  }

  // 1. Transition to 'sent' at 1.2s
  setTimeout(async () => {
    try {
      await db
        .update(messages)
        .set({
          status: "sent",
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId));

      await dispatchWebhookEvent({
        workspaceId,
        environment,
        eventType: "message.sent",
        apiVersion,
        payload: {
          event: "message.sent",
          message_id: messageId,
          channel,
          recipient: maskPhoneNumber(recipient),
          status: "sent",
          timestamp: new Date().toISOString(),
        },
      });

      // Scenario 4: Stays 'sent' and never delivers
      if (recipient === TEST_NUMBERS.STAYS_SENT) {
        return;
      }

      // 2. Transition to terminal state (delivered or failed) at 2.8s
      setTimeout(async () => {
        try {
          if (recipient === TEST_NUMBERS.HANDSET_UNREACHABLE) {
            await db
              .update(messages)
              .set({
                status: "failed",
                failureReason: "handset_unreachable: Terminal carrier reported handset switched off or out of network coverage area.",
                updatedAt: new Date(),
              })
              .where(eq(messages.id, messageId));

            await dispatchWebhookEvent({
              workspaceId,
              environment,
              eventType: "message.failed",
              apiVersion,
              payload: {
                event: "message.failed",
                message_id: messageId,
                channel,
                recipient: maskPhoneNumber(recipient),
                status: "failed",
                failure_reason: "handset_unreachable",
                timestamp: new Date().toISOString(),
              },
            });
            return;
          }

          // Otherwise (ALWAYS_DELIVERS or standard 90% delivery rate)
          const isDelivered = recipient === TEST_NUMBERS.ALWAYS_DELIVERS || Math.random() < 0.95;

          if (isDelivered) {
            await db
              .update(messages)
              .set({
                status: "delivered",
                updatedAt: new Date(),
              })
              .where(eq(messages.id, messageId));

            await dispatchWebhookEvent({
              workspaceId,
              environment,
              eventType: "message.delivered",
              apiVersion,
              payload: {
                event: "message.delivered",
                message_id: messageId,
                channel,
                recipient: maskPhoneNumber(recipient),
                status: "delivered",
                delivered_at: new Date().toISOString(),
                failure_reason: null,
              },
            });

            // 3. WhatsApp / RCS read receipts transition at 4.2s
            if (channel === "whatsapp" || channel === "rcs") {
              setTimeout(async () => {
                try {
                  await db
                    .update(messages)
                    .set({
                      status: "read",
                      updatedAt: new Date(),
                    })
                    .where(eq(messages.id, messageId));

                  await dispatchWebhookEvent({
                    workspaceId,
                    environment,
                    eventType: "message.read",
                    apiVersion,
                    payload: {
                      event: "message.read",
                      message_id: messageId,
                      channel,
                      recipient: maskPhoneNumber(recipient),
                      status: "read",
                      read_at: new Date().toISOString(),
                    },
                  });
                } catch (e) {
                  console.error("Simulation error (read):", e);
                }
              }, 1400);
            }
          } else {
            // Temporary carrier failure
            await db
              .update(messages)
              .set({
                status: "failed",
                failureReason: "network_timeout: Downstream telecom MSC timeout.",
                updatedAt: new Date(),
              })
              .where(eq(messages.id, messageId));

            await dispatchWebhookEvent({
              workspaceId,
              environment,
              eventType: "message.failed",
              apiVersion,
              payload: {
                event: "message.failed",
                message_id: messageId,
                channel,
                recipient: maskPhoneNumber(recipient),
                status: "failed",
                failure_reason: "network_timeout",
                timestamp: new Date().toISOString(),
              },
            });
          }
        } catch (e) {
          console.error("Simulation error (delivery):", e);
        }
      }, 1600);
    } catch (e) {
      console.error("Simulation error (sent):", e);
    }
  }, 1200);
}
