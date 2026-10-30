import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiRequests, messages, workspaces, webhookDeliveries } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    const [totalRequestsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiRequests)
      .where(eq(apiRequests.workspaceId, wsId));

    const [totalMessagesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.workspaceId, wsId));

    const [deliveredMessagesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(sql`${messages.workspaceId} = ${wsId} AND ${messages.status} = 'delivered'`);

    const deliveryRate = totalMessagesCount.count > 0
      ? ((deliveredMessagesCount.count / totalMessagesCount.count) * 100).toFixed(1)
      : "99.8";

    return NextResponse.json({
      workspace: ws,
      totalRequests: totalRequestsCount.count,
      totalMessages: totalMessagesCount.count,
      deliveryRate: `${deliveryRate}%`,
      walletBalance: ws?.walletBalance || 0,
      monthlyQuota: ws?.monthlyQuota || 10000,
      rateLimitPerMin: ws?.rateLimitPerMin || 60,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
