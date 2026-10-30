import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const body = await req.json();
    const endpointParam = body.endpoint || body.path || "/v1/messages";
    const method = body.method || "POST";
    const payload = body.payload !== undefined ? body.payload : {
      channel: "sms",
      to: "+919999900001",
      template_id: "dlt_tmpl_otp_login",
      variables: { code: "481092" },
    };

    // Fetch workspace test key
    const [testKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.workspaceId, wsId), eq(apiKeys.environment, "test")))
      .limit(1);

    const rawKey = testKey?.fullKeyForDev || "rk_test_acmepay_9fa1b2e84c302948";
    const port = process.env.PORT || "3001";
    const startTime = Date.now();

    const normalizedEndpoint = endpointParam.startsWith("/") ? endpointParam : `/${endpointParam}`;
    const targetUrl = `http://127.0.0.1:${port}/api${normalizedEndpoint.startsWith("/v1") ? normalizedEndpoint : `/v1${normalizedEndpoint}`}`;

    const res = await fetch(targetUrl, {
      method,
      headers: {
        "Authorization": `Bearer ${rawKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `idem_run_${Date.now()}`,
        "Relay-Version": "2025-10-01",
      },
      body: method !== "GET" ? JSON.stringify(payload) : undefined,
    });

    const durationMs = Date.now() - startTime;
    let responseData: any = null;
    try {
      responseData = await res.json();
    } catch {
      responseData = await res.text();
    }

    return NextResponse.json({
      status: res.status,
      durationMs,
      latencyMs: durationMs,
      data: responseData,
      responseBody: responseData,
      endpoint: normalizedEndpoint,
      method,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
