import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys, apiRequests, apiKeyAuditLogs, workspaces } from "@/lib/db/schema";
import { eq, and, desc, gt, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, params.id))
      .limit(1);

    if (!key || key.workspaceId !== wsId) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    const isLocked = ws?.kycStatus !== "approved" && key.environment === "live";

    // 1. Audit Logs for this key
    const auditLogs = await db
      .select()
      .from(apiKeyAuditLogs)
      .where(eq(apiKeyAuditLogs.keyId, key.id))
      .orderBy(desc(apiKeyAuditLogs.createdAt))
      .limit(20);

    // 2. Recent 15 requests for this key
    const recentRequests = await db
      .select({
        id: apiRequests.id,
        method: apiRequests.method,
        path: apiRequests.path,
        status: apiRequests.status,
        durationMs: apiRequests.durationMs,
        errorCode: apiRequests.errorCode,
        createdAt: apiRequests.createdAt,
      })
      .from(apiRequests)
      .where(eq(apiRequests.keyId, key.id))
      .orderBy(desc(apiRequests.createdAt))
      .limit(15);

    // 3. Last 24-hour request count
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const [usage24hResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiRequests)
      .where(
        and(
          eq(apiRequests.keyId, key.id),
          gt(apiRequests.createdAt, oneDayAgo)
        )
      );

    const usageCount24h = usage24hResult?.count || 0;

    // 4. Generate 7-day usage chart distribution
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000);
    const allRequests7d = await db
      .select({
        status: apiRequests.status,
        createdAt: apiRequests.createdAt,
      })
      .from(apiRequests)
      .where(
        and(
          eq(apiRequests.keyId, key.id),
          gt(apiRequests.createdAt, sevenDaysAgo)
        )
      );

    // Group by day (YYYY-MM-DD)
    const dayMap = new Map<string, { date: string; successful: number; failed: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400 * 1000);
      const dayStr = d.toISOString().split("T")[0];
      dayMap.set(dayStr, { date: dayStr.slice(5), successful: 0, failed: 0 });
    }

    allRequests7d.forEach((r) => {
      const dayStr = new Date(r.createdAt).toISOString().split("T")[0];
      const entry = dayMap.get(dayStr);
      if (entry) {
        if (r.status >= 200 && r.status < 400) {
          entry.successful += 1;
        } else {
          entry.failed += 1;
        }
      }
    });

    const usageChart = Array.from(dayMap.values());

    return NextResponse.json({
      key: {
        ...key,
        isLocked,
      },
      auditLogs,
      recentRequests,
      usageCount24h,
      usageChart,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
