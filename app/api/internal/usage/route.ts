import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiRequests, messages, workspaces, apiKeys, usageAlertPreferences } from "@/lib/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { ERROR_REGISTRY, ErrorCode } from "@/lib/sandbox/errors";
import { getRateLimitStatus } from "@/lib/sandbox/rate-limiter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "24h"; // "1h" | "24h" | "7d" | "30d"
    const environment = (searchParams.get("environment") || "test").toLowerCase() as "test" | "live";
    const keyFilter = searchParams.get("keyId");
    const versionFilter = searchParams.get("apiVersion");

    // Fetch workspace
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    const nowEpoch = Math.floor(Date.now() / 1000);
    let secondsWindow = 86400; // default 24h
    if (range === "1h") secondsWindow = 3600;
    else if (range === "7d") secondsWindow = 7 * 86400;
    else if (range === "30d") secondsWindow = 30 * 86400;

    const startEpoch = nowEpoch - secondsWindow;

    // Fetch alert preferences for low balance threshold
    const [pref] = await db
      .select()
      .from(usageAlertPreferences)
      .where(eq(usageAlertPreferences.workspaceId, wsId))
      .limit(1);

    // Build conditions for apiRequests
    const conditions = [
      eq(apiRequests.workspaceId, wsId),
      eq(apiRequests.environment, environment),
      gte(apiRequests.createdAt, new Date(startEpoch * 1000)),
    ];

    if (keyFilter && keyFilter !== "all") {
      conditions.push(eq(apiRequests.keyId, keyFilter));
    }
    if (versionFilter && versionFilter !== "all") {
      conditions.push(eq(apiRequests.apiVersion, versionFilter));
    }

    const allRequests = await db
      .select()
      .from(apiRequests)
      .where(and(...conditions))
      .orderBy(desc(apiRequests.createdAt));

    // Calculate Overview Metrics
    const totalRequests = allRequests.length;
    let successfulRequests = 0;
    let clientErrors = 0;
    let serverErrors = 0;
    const durations: number[] = [];

    for (const r of allRequests) {
      if (r.status >= 200 && r.status < 300) successfulRequests++;
      else if (r.status >= 400 && r.status < 500) clientErrors++;
      else if (r.status >= 500) serverErrors++;
      durations.push(r.durationMs || 45);
    }

    durations.sort((a, b) => a - b);
    const p50LatencyMs = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p95LatencyMs = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
    const avgLatencyMs =
      durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : 0;
    const totalErrors = clientErrors + serverErrors;
    const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) + "%" : "0.0%";

    // Requests Over Time Buckets
    const numBuckets = range === "1h" ? 12 : range === "24h" ? 24 : range === "7d" ? 7 : 30;
    const bucketDuration = secondsWindow / numBuckets;
    const requestsOverTime: Array<{
      bucketIndex: number;
      startTime: number;
      label: string;
      count2xx: number;
      count4xx: number;
      count5xx: number;
      total: number;
    }> = [];

    for (let i = 0; i < numBuckets; i++) {
      const bStart = startEpoch + i * bucketDuration;
      const bEnd = bStart + bucketDuration;
      const dateObj = new Date(bStart * 1000);
      let label = "";

      if (range === "1h") {
        label = dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
      } else if (range === "24h") {
        label = `${dateObj.getHours().toString().padStart(2, "0")}:00`;
      } else {
        label = dateObj.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      }

      requestsOverTime.push({
        bucketIndex: i,
        startTime: bStart,
        label,
        count2xx: 0,
        count4xx: 0,
        count5xx: 0,
        total: 0,
      });
    }

    for (const r of allRequests) {
      const rTime = Math.floor(new Date(r.createdAt).getTime() / 1000);
      const bIdx = Math.min(
        numBuckets - 1,
        Math.max(0, Math.floor((rTime - startEpoch) / bucketDuration))
      );
      if (requestsOverTime[bIdx]) {
        if (r.status >= 200 && r.status < 300) requestsOverTime[bIdx].count2xx++;
        else if (r.status >= 400 && r.status < 500) requestsOverTime[bIdx].count4xx++;
        else if (r.status >= 500) requestsOverTime[bIdx].count5xx++;
        requestsOverTime[bIdx].total++;
      }
    }

    // Top Endpoints
    const endpointMap = new Map<string, { count: number; errors: number; totalDuration: number }>();
    for (const r of allRequests) {
      const key = `${r.method} ${r.path}`;
      const existing = endpointMap.get(key) || { count: 0, errors: 0, totalDuration: 0 };
      existing.count++;
      if (r.status >= 400) existing.errors++;
      existing.totalDuration += r.durationMs || 45;
      endpointMap.set(key, existing);
    }

    const topEndpoints = Array.from(endpointMap.entries())
      .map(([path, data]) => ({
        path,
        count: data.count,
        errors: data.errors,
        errorRate: data.count > 0 ? ((data.errors / data.count) * 100).toFixed(1) + "%" : "0.0%",
        avgDuration: Math.round(data.totalDuration / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Top Error Codes
    const errorCodeMap = new Map<string, { count: number; lastSeen: Date }>();
    for (const r of allRequests) {
      if (r.status >= 400) {
        const code = r.errorCode || (r.status === 429 ? "rate_limit_exceeded" : `http_${r.status}`);
        const existing = errorCodeMap.get(code) || { count: 0, lastSeen: r.createdAt };
        existing.count++;
        if (new Date(r.createdAt) > new Date(existing.lastSeen)) {
          existing.lastSeen = r.createdAt;
        }
        errorCodeMap.set(code, existing);
      }
    }

    const topErrorCodes = Array.from(errorCodeMap.entries())
      .map(([code, data]) => {
        const def = ERROR_REGISTRY[code as ErrorCode] || {
          code,
          type: "api_error",
          status: 400,
          message: `Request failed with error code: ${code}`,
          description: "An unexpected error occurred while processing this API request.",
          commonCauses: ["Unexpected request payload or server state."],
          howToFix: ["Review request schema and ensure headers match API specification."],
          docUrl: `/docs/errors#${code}`,
        };
        return {
          code,
          count: data.count,
          lastSeen: data.lastSeen,
          docUrl: def.docUrl,
          logsUrl: `/console/logs?errorCode=${encodeURIComponent(code)}`,
          definition: def,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Per-Key Breakdown
    const keysInWs = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.workspaceId, wsId), eq(apiKeys.environment, environment)));

    const perKeyMap = new Map<string, { count: number; errors: number }>();
    for (const r of allRequests) {
      const kId = r.keyId || "unauthenticated";
      const existing = perKeyMap.get(kId) || { count: 0, errors: 0 };
      existing.count++;
      if (r.status >= 400) existing.errors++;
      perKeyMap.set(kId, existing);
    }

    const perKeyBreakdown = keysInWs.map((k) => {
      const data = perKeyMap.get(k.id) || { count: 0, errors: 0 };
      return {
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        secretMasked: k.secretMasked,
        environment: k.environment,
        status: k.status,
        requestCount: data.count,
        errorCount: data.errors,
        errorRate: data.count > 0 ? ((data.errors / data.count) * 100).toFixed(1) + "%" : "0.0%",
        lastUsedAt: k.lastUsedAt,
      };
    });

    // Rate Limits & Quotas
    const defaultKeyId = keysInWs[0]?.id || "default";
    const inMemStatus = getRateLimitStatus(defaultKeyId, ws?.rateLimitPerMin || 60);

    // Also count requests in DB in last 60 seconds
    const sixtySecsAgo = new Date(Date.now() - 60_000);
    const [recent60sRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiRequests)
      .where(
        and(
          eq(apiRequests.workspaceId, wsId),
          gte(apiRequests.createdAt, sixtySecsAgo)
        )
      );

    const currentMinuteUsage = Math.max(recent60sRow?.count || 0, inMemStatus.count);
    const limitPerMin = ws?.rateLimitPerMin || 60;
    const currentMinuteRemaining = Math.max(0, limitPerMin - currentMinuteUsage);

    // Monthly quota calculations
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000);
    const [monthlyUsedRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiRequests)
      .where(
        and(
          eq(apiRequests.workspaceId, wsId),
          gte(apiRequests.createdAt, thirtyDaysAgo)
        )
      );

    const monthlyQuota = ws?.monthlyQuota || 25000;
    const monthlyQuotaUsed = monthlyUsedRow?.count || 0;
    const monthlyQuotaRemaining = Math.max(0, monthlyQuota - monthlyQuotaUsed);

    // Projected exhaustion date based on hourly rate in last 24h
    let projectedExhaustionDate: string | null = null;
    const [last24hCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiRequests)
      .where(
        and(
          eq(apiRequests.workspaceId, wsId),
          gte(apiRequests.createdAt, new Date(Date.now() - 86400 * 1000))
        )
      );
    const requestsPerHour = (last24hCountRow?.count || 0) / 24;
    if (monthlyQuotaRemaining <= 0) {
      projectedExhaustionDate = "Quota Exhausted";
    } else if (requestsPerHour > 0) {
      const hoursRemaining = monthlyQuotaRemaining / requestsPerHour;
      if (hoursRemaining < 30 * 24) {
        const exhaustionTime = new Date(Date.now() + hoursRemaining * 3600 * 1000);
        projectedExhaustionDate = exhaustionTime.toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } else {
        projectedExhaustionDate = "Beyond current billing cycle";
      }
    } else {
      projectedExhaustionDate = "Beyond current billing cycle";
    }

    // Rate-limit hits (429 requests)
    const recent429Hits = allRequests
      .filter((r) => r.status === 429)
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        path: r.path,
        method: r.method,
        createdAt: r.createdAt,
        keyId: r.keyId,
        ip: r.ip,
        retryAfter: 1,
        message: "Add exponential backoff using Retry-After header.",
      }));

    // Tier specifications for comparison
    const tierSpecs = {
      starter: {
        tps: 50,
        reqPerMin: 60,
        burst: 100,
        eventBatchSize: 200,
        webhookEndpoints: 5,
      },
      growth: {
        tps: 250,
        reqPerMin: 120,
        burst: 300,
        eventBatchSize: 500,
        webhookEndpoints: 10,
      },
      enterprise: {
        tps: 5000,
        reqPerMin: 600,
        burst: 1000,
        eventBatchSize: 2000,
        webhookEndpoints: 50,
      },
    };

    const currentTierSpec = tierSpecs[(ws?.planTier as keyof typeof tierSpecs) || "growth"];

    // Cost Visibility
    // Rate card: SMS ₹0.12, RCS ₹0.20, WhatsApp ₹0.35
    const allMessages = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, wsId),
          gte(messages.createdAt, new Date(startEpoch * 1000))
        )
      );

    let testWouldHaveCost = 0;
    let liveCharged = 0;
    const channelBreakdown = {
      sms: { count: 0, cost: 0, rate: 0.12 },
      rcs: { count: 0, cost: 0, rate: 0.2 },
      whatsapp: { count: 0, cost: 0, rate: 0.35 },
    };

    const costByDayMap = new Map<string, { sms: number; rcs: number; whatsapp: number; total: number }>();

    for (const msg of allMessages) {
      const channel = (msg.channel || "sms") as "sms" | "rcs" | "whatsapp";
      const rate = channelBreakdown[channel]?.rate || 0.12;

      if (msg.environment === "test") {
        testWouldHaveCost += msg.costWouldBe || rate;
      } else {
        liveCharged += msg.cost || rate;
      }

      if (msg.environment === environment) {
        if (channelBreakdown[channel]) {
          channelBreakdown[channel].count++;
          channelBreakdown[channel].cost += environment === "test" ? (msg.costWouldBe || rate) : (msg.cost || rate);
        }

        const dayKey = new Date(msg.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
        const existingDay = costByDayMap.get(dayKey) || { sms: 0, rcs: 0, whatsapp: 0, total: 0 };
        const msgCost = environment === "test" ? (msg.costWouldBe || rate) : (msg.cost || rate);
        if (channel === "sms") existingDay.sms += msgCost;
        else if (channel === "rcs") existingDay.rcs += msgCost;
        else if (channel === "whatsapp") existingDay.whatsapp += msgCost;
        existingDay.total += msgCost;
        costByDayMap.set(dayKey, existingDay);
      }
    }

    const costPerDay = Array.from(costByDayMap.entries()).map(([date, data]) => ({
      date,
      smsCost: Number(data.sms.toFixed(2)),
      rcsCost: Number(data.rcs.toFixed(2)),
      whatsappCost: Number(data.whatsapp.toFixed(2)),
      totalCost: Number(data.total.toFixed(2)),
    }));

    // Errors View (Grouped failing requests by errorCode and path)
    const groupedErrorsMap = new Map<
      string,
      {
        errorCode: string;
        path: string;
        count: number;
        lastSeen: Date;
        sampleRequestId: string;
        sampleStatus: number;
        samplePayload: any;
        sampleResponse: any;
      }
    >();

    for (const r of allRequests) {
      if (r.status >= 400) {
        const code = r.errorCode || (r.status === 429 ? "rate_limit_exceeded" : `http_${r.status}`);
        const groupKey = `${code}::${r.path}`;
        const existing = groupedErrorsMap.get(groupKey);

        if (!existing) {
          let parsedPayload = null;
          let parsedResponse = null;
          try {
            parsedPayload = r.requestBody ? JSON.parse(r.requestBody) : null;
          } catch {
            parsedPayload = r.requestBody;
          }
          try {
            parsedResponse = r.responseBody ? JSON.parse(r.responseBody) : null;
          } catch {
            parsedResponse = r.responseBody;
          }

          groupedErrorsMap.set(groupKey, {
            errorCode: code,
            path: r.path,
            count: 1,
            lastSeen: r.createdAt,
            sampleRequestId: r.requestId,
            sampleStatus: r.status,
            samplePayload: parsedPayload,
            sampleResponse: parsedResponse,
          });
        } else {
          existing.count++;
          if (new Date(r.createdAt) > new Date(existing.lastSeen)) {
            existing.lastSeen = r.createdAt;
          }
        }
      }
    }

    const errorsView = Array.from(groupedErrorsMap.values()).map((item) => {
      const def = ERROR_REGISTRY[item.errorCode as ErrorCode] || {
        code: item.errorCode,
        type: "api_error",
        status: item.sampleStatus,
        message: `API returned HTTP ${item.sampleStatus}`,
        description: "An error was returned when executing this operation.",
        commonCauses: ["Invalid parameters or header configuration."],
        howToFix: ["Verify endpoint schema and parameters."],
        docUrl: `/docs/errors#${item.errorCode}`,
      };

      return {
        ...item,
        logsUrl: `/console/logs?errorCode=${encodeURIComponent(item.errorCode)}`,
        errorDefinition: def,
      };
    }).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      environment,
      range,
      workspace: {
        id: ws?.id,
        name: ws?.name,
        planTier: ws?.planTier || "growth",
        rateLimitPerMin: ws?.rateLimitPerMin || 120,
        monthlyQuota: ws?.monthlyQuota || 25000,
        walletBalance: ws?.walletBalance || 0,
      },
      overview: {
        totalRequests,
        successfulRequests,
        clientErrors,
        serverErrors,
        errorRate,
        p50LatencyMs,
        p95LatencyMs,
        avgLatencyMs,
      },
      requestsOverTime,
      topEndpoints,
      topErrorCodes,
      perKeyBreakdown,
      rateLimitsAndQuotas: {
        planTier: ws?.planTier || "growth",
        rateLimitPerMin: limitPerMin,
        currentMinuteUsage,
        currentMinuteRemaining,
        currentMinuteReset: inMemStatus.reset,
        monthlyQuota,
        monthlyQuotaUsed,
        monthlyQuotaRemaining,
        projectedExhaustionDate,
        tierSpecs: currentTierSpec,
        allTiers: tierSpecs,
        recent429Hits,
      },
      costVisibility: {
        environment,
        testWouldHaveCost: Number(testWouldHaveCost.toFixed(2)),
        liveCharged: Number(liveCharged.toFixed(2)),
        walletBalance: ws?.walletBalance || 0,
        lowBalanceThreshold: pref?.lowBalanceThreshold || 500,
        channelBreakdown: {
          sms: { ...channelBreakdown.sms, cost: Number(channelBreakdown.sms.cost.toFixed(2)) },
          rcs: { ...channelBreakdown.rcs, cost: Number(channelBreakdown.rcs.cost.toFixed(2)) },
          whatsapp: { ...channelBreakdown.whatsapp, cost: Number(channelBreakdown.whatsapp.cost.toFixed(2)) },
        },
        costPerDay,
      },
      errorsView,
    });
  } catch (error: any) {
    console.error("Usage API error:", error);
    return NextResponse.json({ error: error.message || "Failed to load usage data" }, { status: 500 });
  }
}
