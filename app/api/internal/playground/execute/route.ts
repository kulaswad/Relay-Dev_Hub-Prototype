import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ERROR_REGISTRY, ErrorCode } from "@/lib/sandbox/errors";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace?.id || "ws_acmepay_prod";

    const body = await req.json();
    const {
      method = "POST",
      path = "/api/v1/messages",
      headers = {},
      body: requestBody = null,
      apiKey: customApiKey,
    } = body;

    // Resolve API key
    let token = customApiKey;
    if (!token) {
      // Find active test key for workspace
      const [key] = await db
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

      token = key?.fullKeyForDev || "rk_test_acmepay_9fa1b2e84c302948";
    }

    // Build absolute URL to internal server
    const host = req.headers.get("host") || "localhost:3001";
    const protocol = host.includes("localhost") ? "http" : "https";
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${protocol}://${host}${cleanPath}`;

    // Construct headers
    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Relay-Playground/1.0",
      ...headers,
    };

    if (!reqHeaders["Authorization"] && !reqHeaders["authorization"]) {
      reqHeaders["Authorization"] = `Bearer ${token}`;
    }

    const startTime = Date.now();
    let response: Response;

    try {
      response = await fetch(url, {
        method,
        headers: reqHeaders,
        body: ["GET", "HEAD"].includes(method.toUpperCase())
          ? undefined
          : typeof requestBody === "string"
          ? requestBody
          : requestBody
          ? JSON.stringify(requestBody)
          : undefined,
        cache: "no-store",
      });
    } catch (fetchErr: any) {
      return NextResponse.json({
        success: false,
        error: `Failed to connect to gateway endpoint ${url}: ${fetchErr.message}`,
        durationMs: Date.now() - startTime,
      }, { status: 502 });
    }

    const durationMs = Date.now() - startTime;
    const responseText = await response.text();
    let parsedBody: any = responseText;
    try {
      parsedBody = JSON.parse(responseText);
    } catch {}

    // Extract headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    const requestId =
      responseHeaders["relay-request-id"] ||
      responseHeaders["x-request-id"] ||
      parsedBody?.error?.request_id ||
      null;

    // Check if error matches our Error Registry to enrich with remediation guidance
    let errorExplanation = null;
    if (parsedBody?.error?.code) {
      const code = parsedBody.error.code as ErrorCode;
      if (ERROR_REGISTRY[code]) {
        errorExplanation = ERROR_REGISTRY[code];
      }
    }

    return NextResponse.json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      durationMs,
      requestId,
      headers: responseHeaders,
      body: parsedBody,
      rawBody: responseText,
      errorExplanation,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute playground request" },
      { status: 500 }
    );
  }
}
