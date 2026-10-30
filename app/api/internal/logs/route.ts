import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  webhookDeliveries,
  webhookEvents,
  webhookEndpoints,
  apiRequests,
} from "@/lib/db/schema";
import { eq, and, desc, like, or, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") || "webhooks";
    const statusFilter = url.searchParams.get("status");
    const eventTypeFilter = url.searchParams.get("eventType");
    const endpointFilter = url.searchParams.get("endpointId");
    const searchQuery = url.searchParams.get("search");
    const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(1, limitParam), 100);

    if (tab === "webhooks") {
      let query = db
        .select({
          id: webhookDeliveries.id,
          eventId: webhookDeliveries.eventId,
          endpointId: webhookDeliveries.endpointId,
          endpointUrl: webhookEndpoints.url,
          endpointSecret: webhookEndpoints.signingSecret,
          attemptNumber: webhookDeliveries.attemptNumber,
          requestHeaders: webhookDeliveries.requestHeaders,
          requestBody: webhookDeliveries.requestBody,
          responseStatus: webhookDeliveries.responseStatus,
          responseHeaders: webhookDeliveries.responseHeaders,
          responseBody: webhookDeliveries.responseBody,
          durationMs: webhookDeliveries.durationMs,
          errorType: webhookDeliveries.errorType,
          status: webhookDeliveries.status,
          scheduledAt: webhookDeliveries.scheduledAt,
          attemptedAt: webhookDeliveries.attemptedAt,
          nextRetryAt: webhookDeliveries.nextRetryAt,
          replayOfId: webhookDeliveries.replayOfId,
          eventType: webhookEvents.type,
          eventCreatedAt: webhookEvents.createdAt,
        })
        .from(webhookDeliveries)
        .leftJoin(webhookEvents, eq(webhookDeliveries.eventId, webhookEvents.id))
        .leftJoin(webhookEndpoints, eq(webhookDeliveries.endpointId, webhookEndpoints.id))
        .where(
          and(
            eq(webhookDeliveries.workspaceId, wsId),
            statusFilter && statusFilter !== "all"
              ? eq(webhookDeliveries.status, statusFilter as any)
              : sql`1=1`,
            eventTypeFilter && eventTypeFilter !== "all"
              ? eq(webhookEvents.type, eventTypeFilter)
              : sql`1=1`,
            endpointFilter && endpointFilter !== "all"
              ? eq(webhookDeliveries.endpointId, endpointFilter)
              : sql`1=1`,
            searchQuery
              ? or(
                  like(webhookDeliveries.id, `%${searchQuery}%`),
                  like(webhookDeliveries.eventId, `%${searchQuery}%`),
                  like(webhookDeliveries.requestBody, `%${searchQuery}%`),
                  like(webhookEndpoints.url, `%${searchQuery}%`)
                )
              : sql`1=1`
          )
        )
        .orderBy(desc(webhookDeliveries.attemptedAt))
        .limit(limit);

      const deliveries = await query;

      return NextResponse.json({
        tab: "webhooks",
        deliveries,
      });
    } else {
      // API Requests Tab
      let query = db
        .select({
          id: apiRequests.id,
          keyId: apiRequests.keyId,
          environment: apiRequests.environment,
          method: apiRequests.method,
          path: apiRequests.path,
          status: apiRequests.status,
          durationMs: apiRequests.durationMs,
          requestHeaders: apiRequests.requestHeaders,
          requestBody: apiRequests.requestBody,
          responseBody: apiRequests.responseBody,
          idempotencyKey: apiRequests.idempotencyKey,
          errorCode: apiRequests.errorCode,
          requestId: apiRequests.requestId,
          billedAmountWouldBe: apiRequests.billedAmountWouldBe,
          billedAmountActual: apiRequests.billedAmountActual,
          createdAt: apiRequests.createdAt,
          apiVersion: apiRequests.apiVersion,
        })
        .from(apiRequests)
        .where(
          and(
            eq(apiRequests.workspaceId, wsId),
            statusFilter && statusFilter !== "all"
              ? eq(apiRequests.status, parseInt(statusFilter, 10))
              : sql`1=1`,
            searchQuery
              ? or(
                  like(apiRequests.id, `%${searchQuery}%`),
                  like(apiRequests.path, `%${searchQuery}%`),
                  like(apiRequests.requestBody, `%${searchQuery}%`),
                  like(apiRequests.idempotencyKey, `%${searchQuery}%`)
                )
              : sql`1=1`
          )
        )
        .orderBy(desc(apiRequests.createdAt))
        .limit(limit);

      const requests = await query;

      return NextResponse.json({
        tab: "requests",
        requests,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
