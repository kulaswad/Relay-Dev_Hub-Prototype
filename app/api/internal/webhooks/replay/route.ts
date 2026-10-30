import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { webhookDeliveries } from "@/lib/db/schema";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import { replayWebhookDelivery, retryDeliveryNow } from "@/lib/webhooks/scheduler";
import { z } from "zod";

const ReplayActionSchema = z.object({
  deliveryId: z.string().optional(),
  action: z.enum(["replay", "retry_now", "replay_all_failed"]).default("replay"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();
    const { deliveryId, action } = ReplayActionSchema.parse(body);

    if (action === "retry_now") {
      if (!deliveryId) return NextResponse.json({ error: "deliveryId is required" }, { status: 400 });
      const result = await retryDeliveryNow(deliveryId);
      return NextResponse.json({
        success: result.success,
        delivery: result.delivery,
        message: `Retry attempt #${result.delivery?.attemptNumber} executed immediately. HTTP ${result.delivery?.responseStatus || "Error"}.`,
      });
    }

    if (action === "replay_all_failed") {
      const failedDeliveries = await db
        .select({ id: webhookDeliveries.id })
        .from(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.workspaceId, wsId),
            or(
              eq(webhookDeliveries.status, "failed"),
              eq(webhookDeliveries.status, "abandoned")
            )
          )
        )
        .limit(100);

      const replayedIds: string[] = [];
      for (const d of failedDeliveries) {
        try {
          await replayWebhookDelivery(d.id);
          replayedIds.push(d.id);
        } catch {}
      }

      return NextResponse.json({
        success: true,
        replayedCount: replayedIds.length,
        message: `Triggered replays for ${replayedIds.length} failed delivery records.`,
      });
    }

    // Default: Single Replay
    if (!deliveryId) {
      return NextResponse.json({ error: "deliveryId is required" }, { status: 400 });
    }

    const replayResult = await replayWebhookDelivery(deliveryId);

    return NextResponse.json({
      success: true,
      replayId: replayResult.delivery?.id,
      delivery: replayResult.delivery,
      status: replayResult.delivery?.status,
      responseStatus: replayResult.delivery?.responseStatus,
      responseBody: replayResult.delivery?.responseBody,
      message: `Replay executed. Result: HTTP ${replayResult.delivery?.responseStatus || "Failed"}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
