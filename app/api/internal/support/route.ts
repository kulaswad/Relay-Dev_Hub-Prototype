import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiRequests, workspaces, webhookEndpoints, docChunks } from "@/lib/db/schema";
import { eq, and, gte, desc, like, or } from "drizzle-orm";
import { ERROR_REGISTRY, ErrorCode } from "@/lib/sandbox/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const environment = (searchParams.get("environment") || "test").toLowerCase() as "test" | "live";

    // 1. Instant Docs Search (if query provided)
    let searchResults: Array<{
      id: string;
      slug: string;
      title: string;
      section: string;
      snippet: string;
      url: string;
    }> = [];

    if (query.length > 1) {
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      const matches = await db
        .select()
        .from(docChunks)
        .where(
          or(
            like(docChunks.title, `%${query}%`),
            like(docChunks.content, `%${query}%`),
            like(docChunks.section, `%${query}%`)
          )
        )
        .limit(6);

      searchResults = matches.map((chunk) => {
        const text = chunk.content;
        const lowerText = text.toLowerCase();
        let matchIdx = lowerText.indexOf(tokens[0] || "");
        if (matchIdx === -1) matchIdx = 0;
        const snippetStart = Math.max(0, matchIdx - 40);
        const snippet = text.slice(snippetStart, snippetStart + 160).replace(/\n+/g, " ") + "...";

        return {
          id: chunk.id,
          slug: chunk.slug,
          title: chunk.title,
          section: chunk.section,
          snippet,
          url: `/docs/${chunk.slug}`,
        };
      });
    }

    // 2. Proactive Error Detection (Last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    const recentErrors = await db
      .select()
      .from(apiRequests)
      .where(
        and(
          eq(apiRequests.workspaceId, wsId),
          gte(apiRequests.createdAt, twoHoursAgo)
        )
      )
      .orderBy(desc(apiRequests.createdAt));

    const errorCounts = new Map<string, { count: number; lastSeen: Date; samplePath: string }>();
    for (const r of recentErrors) {
      if (r.status >= 400) {
        const code = r.errorCode || `http_${r.status}`;
        const existing = errorCounts.get(code) || { count: 0, lastSeen: r.createdAt, samplePath: r.path };
        existing.count++;
        errorCounts.set(code, existing);
      }
    }

    const failureSuggestions: Array<{
      errorCode: string;
      count: number;
      message: string;
      fix: string;
      docUrl: string;
      samplePath: string;
    }> = [];

    for (const [code, val] of Array.from(errorCounts.entries())) {
      const def = ERROR_REGISTRY[code as ErrorCode];
      let fix = def?.howToFix[0] || "Review the endpoint parameters and headers in documentation.";

      if (code === "invalid_phone_number") {
        fix = "Ensure recipient phone numbers use international E.164 format (+91 followed by 10 valid mobile digits starting with 6-9).";
      } else if (code === "rate_limit_exceeded") {
        fix = "Apply exponential backoff respecting the Retry-After header, or submit an elevation request to increase your tier TPS.";
      } else if (code === "workspace_not_verified") {
        fix = "Live mode requires KYC verification. Click 'Simulate KYC Approved' in Settings to test Live traffic immediately.";
      } else if (code === "template_not_found") {
        fix = "In sandbox mode, use pre-approved template 'dlt_tmpl_otp_login' or 'dlt_tmpl_order_update'.";
      } else if (code === "authentication_failed") {
        fix = "Ensure header is formatted as 'Authorization: Bearer rk_test_...' without extra quotes or spaces.";
      }

      failureSuggestions.push({
        errorCode: code,
        count: val.count,
        message: `You had ${val.count} x ${code} error${val.count > 1 ? "s" : ""} in the last 2 hours.`,
        fix,
        docUrl: def?.docUrl || `/docs/errors#${code}`,
        samplePath: val.samplePath,
      });
    }

    // 3. Auto-Collected Context for Escalation Form
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    const last10Requests = await db
      .select({ id: apiRequests.id, path: apiRequests.path, status: apiRequests.status, createdAt: apiRequests.createdAt })
      .from(apiRequests)
      .where(eq(apiRequests.workspaceId, wsId))
      .orderBy(desc(apiRequests.createdAt))
      .limit(10);

    const [failingWebhook] = await db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.workspaceId, wsId), eq(webhookEndpoints.status, "failing")))
      .limit(1);

    const planTier = ws?.planTier || "growth";
    const slaExpectation =
      planTier === "enterprise"
        ? "Enterprise 30-minute SLA with dedicated Solutions Architect"
        : planTier === "growth"
        ? "Growth Plan 4-hour priority response window"
        : "Starter Plan 24-hour business hours response";

    const context = {
      workspace: {
        id: wsId,
        name: ws?.name || "AcmePay Production",
        planTier,
      },
      environment,
      apiVersion: "v2025-10-01",
      recentRequestIds: last10Requests.map((r) => r.id),
      failingWebhooks: failingWebhook ? [failingWebhook.url] : [],
      slaExpectation,
    };

    return NextResponse.json({
      searchResults,
      failureSuggestions,
      context,
      autoCollectedContext: {
        workspaceId: wsId,
        workspaceName: ws?.name || "AcmePay Production",
        planTier,
        slaExpectation,
        environment,
        apiVersion: "v2025-10-01",
        last10RequestIds: last10Requests.map((r) => r.id),
        failingWebhookEndpoint: failingWebhook?.url || null,
        failingWebhookId: failingWebhook?.id || null,
        recentErrorsCount: failureSuggestions.reduce((acc, s) => acc + s.count, 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
