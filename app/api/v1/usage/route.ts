import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages, eventsIngested, apiKeys } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  authenticateApiRequest,
  simulateLatency,
  logApiRequest,
  buildResponseHeaders,
} from "@/lib/sandbox/middleware";

export async function GET(req: NextRequest) {
  const authResult = await authenticateApiRequest(req);
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(25, 60);

  // Count messages
  const [msgCountResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        eq(messages.workspaceId, context.workspace.id),
        eq(messages.environment, context.environment)
      )
    );

  // Count events
  const [eventCountResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(eventsIngested)
    .where(
      and(
        eq(eventsIngested.workspaceId, context.workspace.id),
        eq(eventsIngested.environment, context.environment)
      )
    );

  // Count active API keys
  const [keyCountResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.workspaceId, context.workspace.id),
        eq(apiKeys.status, "active")
      )
    );

  const totalMessages = msgCountResult?.count || 0;
  const totalEvents = eventCountResult?.count || 0;
  const activeKeys = keyCountResult?.count || 1;
  const monthlyQuota = context.workspace.monthlyQuota || 10000;
  const rateLimitPerMin = context.workspace.rateLimitPerMin || 60;
  const walletBalance = context.workspace.walletBalance || 0;

  const responseData = {
    workspace_id: context.workspace.id,
    workspace_name: context.workspace.name,
    environment: context.environment,
    plan_tier: context.workspace.planTier || "sandbox",
    kyc_status: context.workspace.kycStatus || "not_started",
    rate_limit: {
      requests_per_minute: rateLimitPerMin,
      current_window_remaining: context.rateLimit.remaining,
      reset_epoch_seconds: context.rateLimit.reset,
    },
    quota: {
      monthly_limit: monthlyQuota,
      used_this_month: totalMessages + totalEvents,
      remaining: Math.max(0, monthlyQuota - (totalMessages + totalEvents)),
      reset_date: "2026-11-01T00:00:00Z",
    },
    billing: {
      wallet_balance_inr: walletBalance,
      currency: "INR",
      billing_model: context.workspace.status === "active" ? "prepaid" : "sandbox_free",
    },
    statistics: {
      total_messages_dispatched: totalMessages,
      total_events_ingested: totalEvents,
      active_api_keys: activeKeys,
    },
  };

  await logApiRequest({
    context,
    req,
    status: 200,
    responseBody: JSON.stringify(responseData),
  });

  const headers = buildResponseHeaders(context);
  return NextResponse.json(responseData, {
    status: 200,
    headers,
  });
}
