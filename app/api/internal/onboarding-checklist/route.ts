import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  workspaces,
  apiKeys,
  apiRequests,
  webhookDeliveries,
  webhookEndpoints,
} from "@/lib/db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace?.id || "ws_acmepay_prod";

    // 1. Get workspace record
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // 2. Get active test API key
    const [testKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.workspaceId, wsId),
          eq(apiKeys.environment, "test"),
          eq(apiKeys.status, "active")
        )
      )
      .limit(1);

    // 3. Get earliest API request (to detect first call and compute exact time-to-first-call)
    const [firstRequest] = await db
      .select()
      .from(apiRequests)
      .where(eq(apiRequests.workspaceId, wsId))
      .orderBy(asc(apiRequests.createdAt))
      .limit(1);

    // Get latest API request
    const [latestRequest] = await db
      .select()
      .from(apiRequests)
      .where(eq(apiRequests.workspaceId, wsId))
      .orderBy(desc(apiRequests.createdAt))
      .limit(1);

    const [reqCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiRequests)
      .where(eq(apiRequests.workspaceId, wsId));

    // 4. Get webhook deliveries
    const [firstDelivery] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.workspaceId, wsId))
      .orderBy(desc(webhookDeliveries.attemptedAt))
      .limit(1);

    // Calculate time to first call
    const wsCreatedTime = new Date(workspace.createdAt).getTime();
    let timeToFirstCallFormatted: string | null = null;
    let timeToFirstCallMs = 0;

    if (firstRequest) {
      const firstReqTime = new Date(firstRequest.createdAt).getTime();
      timeToFirstCallMs = Math.max(0, firstReqTime - wsCreatedTime);
      timeToFirstCallFormatted = formatDuration(timeToFirstCallMs);
    }

    const testKeyRaw = testKey?.fullKeyForDev || "rk_test_acmepay_9fa1b2e84c302948";
    const testKeyMasked = testKey?.secretMasked || `rk_test_••••••••••••••••${testKeyRaw.slice(-4)}`;

    const isKycApproved = workspace.kycStatus === "approved";

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        kycStatus: workspace.kycStatus,
        createdAt: workspace.createdAt,
        walletBalance: workspace.walletBalance,
        isAnonymous: workspace.isAnonymous,
      },
      timeToFirstCall: {
        completed: Boolean(firstRequest),
        formatted: timeToFirstCallFormatted,
        durationMs: timeToFirstCallMs,
        startedAt: workspace.createdAt,
        completedAt: firstRequest?.createdAt || null,
      },
      stats: {
        totalRequests: reqCountResult?.count || 0,
        hasDeliveries: Boolean(firstDelivery),
      },
      steps: {
        step1_accountCreated: {
          completed: true,
          title: "Account created",
          completedAt: workspace.createdAt,
        },
        step2_getTestKey: {
          completed: Boolean(testKey),
          title: "Get a test key",
          key: {
            id: testKey?.id || "key_default",
            prefix: testKey?.prefix || "rk_test_",
            masked: testKeyMasked,
            fullKey: testKeyRaw,
          },
        },
        step3_firstCall: {
          completed: Boolean(firstRequest),
          title: "Make your first API call",
          firstRequestId: firstRequest?.id || null,
          latestRequestId: latestRequest?.id || null,
          totalCalls: reqCountResult?.count || 0,
        },
        step4_seeInLogs: {
          completed: Boolean(firstRequest),
          title: "See it in your logs",
          requestId: latestRequest?.id || firstRequest?.id || null,
        },
        step5_receiveWebhook: {
          completed: Boolean(firstDelivery),
          title: "Receive a webhook",
          deliveryId: firstDelivery?.id || null,
        },
        step6_goLive: {
          completed: isKycApproved,
          title: "Go live",
          kycStatus: workspace.kycStatus,
          isPending: !isKycApproved,
          optionalNotice: "Optional for now: you can keep building in Test",
        },
      },
      allFirstFourCompleted: Boolean(firstRequest && testKey),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load onboarding checklist" },
      { status: 500 }
    );
  }
}
