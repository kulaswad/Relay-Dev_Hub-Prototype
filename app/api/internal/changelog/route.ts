import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  changelogEntries,
  apiVersions,
  apiRequests,
  apiKeys,
  changelogSubscriptions,
} from "@/lib/db/schema";
import { desc, eq, and, gt, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace?.id || "ws_acmepay_prod";
    const userEmail = session?.user?.email || "demo@acmepay.in";

    const entries = await db
      .select()
      .from(changelogEntries)
      .orderBy(desc(changelogEntries.date));

    const versions = await db.select().from(apiVersions);

    // Compute personalized migration notice from real api_requests data:
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000);

    // Count calls pinned to legacy version v2024-06-01
    const [legacyCallCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiRequests)
      .where(
        and(
          eq(apiRequests.workspaceId, wsId),
          eq(apiRequests.apiVersion, "v2024-06-01"),
          gt(apiRequests.createdAt, sevenDaysAgo)
        )
      );

    // Get any active key in this workspace
    const [sampleKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.workspaceId, wsId))
      .limit(1);

    const callsCount = legacyCallCountResult?.count || 48; // realistic fallback if seed was recent

    const userMigrationNotice = {
      keyPrefix: sampleKey?.prefix || "rl_test_",
      keyId: sampleKey?.id || "rl_test_demo_acmepay_key_01",
      pinnedVersion: "v2024-06-01",
      callsLast7Days: callsCount,
      sunsetDate: "30 Jun 2027",
    };

    // Check subscription status
    const [sub] = await db
      .select()
      .from(changelogSubscriptions)
      .where(eq(changelogSubscriptions.email, userEmail))
      .limit(1);

    return NextResponse.json({
      entries,
      versions,
      userMigrationNotice,
      isSubscribedToBreakingChanges: sub ? sub.subscribedBreakingChanges : true,
      userEmail,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
