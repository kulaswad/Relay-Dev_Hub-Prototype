import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKeys, workspaces, apiRequests, ApiKey, Workspace } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import crypto from "crypto";
import { createErrorResponse } from "./errors";
import { validateApiVersion } from "./version";
import { checkRateLimit, RateLimitResult } from "./rate-limiter";

export interface SandboxContext {
  requestId: string;
  apiVersion: string;
  environment: "test" | "live";
  key: ApiKey;
  workspace: Workspace;
  rateLimit: RateLimitResult;
  startTime: number;
}

export interface AuthenticateApiOptions {
  requiredScope?: string;
  skipRateLimit?: boolean;
}

export type AuthResult =
  | { success: true; context: SandboxContext }
  | { success: false; response: NextResponse };

/**
 * Simulate realistic network & telecom carrier latency (40ms - 250ms)
 */
export async function simulateLatency(minMs = 40, maxMs = 120): Promise<number> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, ms));
  return ms;
}

/**
 * Authenticates an incoming Relay v1 API request
 */
export async function authenticateApiRequest(
  req: NextRequest,
  options?: AuthenticateApiOptions
): Promise<AuthResult> {
  const startTime = Date.now();
  const requestId =
    req.headers.get("x-request-id") ||
    req.headers.get("relay-request-id") ||
    `req_${crypto.randomBytes(12).toString("hex")}`;

  // 1. Version Validation
  const rawVersion = req.headers.get("relay-version");
  const versionValidation = validateApiVersion(rawVersion);
  if (!versionValidation.valid) {
    return {
      success: false,
      response: createErrorResponse("version_unsupported", {
        message: `Version '${rawVersion}' is unsupported or sunset. Supported versions: v2025-10-01, v2025-01-15.`,
        requestId,
      }),
    };
  }
  const apiVersion = versionValidation.version;

  // 2. Extract Authorization Header
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      response: createErrorResponse("authentication_failed", {
        message: "Missing or malformed Authorization header. Expected 'Authorization: Bearer rl_test_...'",
        requestId,
      }),
    };
  }

  const rawToken = authHeader.replace("Bearer ", "").trim();
  if (!rawToken) {
    return {
      success: false,
      response: createErrorResponse("authentication_failed", {
        message: "Empty API key provided.",
        requestId,
      }),
    };
  }

  // 3. Determine Key Environment from prefix
  const isLivePrefix = rawToken.startsWith("rk_live_") || rawToken.startsWith("rl_live_");
  const isTestPrefix = rawToken.startsWith("rk_test_") || rawToken.startsWith("rl_test_");

  if (!isLivePrefix && !isTestPrefix) {
    return {
      success: false,
      response: createErrorResponse("authentication_failed", {
        message: "Invalid API key prefix. Keys must begin with 'rk_test_', 'rl_test_', 'rk_live_', or 'rl_live_'.",
        requestId,
      }),
    };
  }

  const environment: "test" | "live" = isLivePrefix ? "live" : "test";
  const hashedSecret = crypto.createHash("sha256").update(rawToken).digest("hex");

  // 4. Lookup Key in Database via SHA-256 Hash
  const [matchedKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.hashedSecret, hashedSecret))
    .limit(1);

  if (!matchedKey) {
    return {
      success: false,
      response: createErrorResponse("authentication_failed", {
        message: "Invalid API key. The key does not exist or was deleted.",
        requestId,
      }),
    };
  }

  // Check key revocation or expired rotation grace period
  if (matchedKey.status === "revoked") {
    return {
      success: false,
      response: createErrorResponse("key_revoked", {
        message: "The API key provided has been revoked and cannot process requests.",
        requestId,
      }),
    };
  }

  if (matchedKey.status === "rotating") {
    const graceEnds = matchedKey.gracePeriodEndsAt
      ? new Date(matchedKey.gracePeriodEndsAt).getTime()
      : 0;
    if (graceEnds > 0 && Date.now() > graceEnds) {
      return {
        success: false,
        response: createErrorResponse("key_revoked", {
          message: "The rotation grace period for this API key has ended. Please use the rotated replacement key.",
          requestId,
        }),
      };
    }
  }

  // Check IP Allowlist if configured
  if (matchedKey.ipAllowlist) {
    const allowed = matchedKey.ipAllowlist
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length > 0) {
      const clientIp = (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.ip ||
        "127.0.0.1"
      ).toLowerCase();
      const isAllowed = allowed.some(
        (ip) =>
          ip === clientIp ||
          (ip === "127.0.0.1" && (clientIp === "::1" || clientIp === "localhost")) ||
          (clientIp === "127.0.0.1" && ip === "localhost")
      );
      if (!isAllowed) {
        return {
          success: false,
          response: createErrorResponse("authentication_failed", {
            message: `Client IP '${clientIp}' is not authorized by this API key's IP allowlist.`,
            requestId,
          }),
        };
      }
    }
  }

  // 5. Scope Validation
  if (options?.requiredScope) {
    let keyScopes: string[] = [];
    try {
      keyScopes = JSON.parse(matchedKey.scopes);
    } catch {
      keyScopes = [];
    }

    const reqScope = options.requiredScope;
    const hasScope =
      keyScopes.includes("*") ||
      keyScopes.includes("all") ||
      keyScopes.includes(reqScope) ||
      (reqScope === "messages:read" && (keyScopes.includes("messages:read") || keyScopes.includes("messages:send"))) ||
      (reqScope === "profiles:read" && (keyScopes.includes("customers:read") || keyScopes.includes("profiles:read"))) ||
      (reqScope === "customers:read" && (keyScopes.includes("profiles:read") || keyScopes.includes("customers:read"))) ||
      (reqScope === "customers:write" && (keyScopes.includes("events:write") || keyScopes.includes("customers:write"))) ||
      (reqScope === "events:write" && (keyScopes.includes("customers:write") || keyScopes.includes("events:write")));

    if (!hasScope) {
      return {
        success: false,
        response: createErrorResponse("insufficient_scope", {
          message: `The API key requires scope '${reqScope}' for this endpoint. Granted scopes: [${keyScopes.join(", ")}].`,
          requestId,
        }),
      };
    }
  }

  // 6. Tenancy & Workspace KYC Gate
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, matchedKey.workspaceId))
    .limit(1);

  if (!workspace) {
    return {
      success: false,
      response: createErrorResponse("authentication_failed", {
        message: "Associated workspace not found.",
        requestId,
      }),
    };
  }

  // LIVE mode requires KYC approved
  if (environment === "live" && workspace.kycStatus !== "approved") {
    return {
      success: false,
      response: createErrorResponse("workspace_not_verified", {
        message: "Live API keys cannot send messages until your workspace completes TRAI/DLT and MCA KYC verification. Switch to your sandbox key (rk_test_...) to continue testing.",
        requestId,
      }),
    };
  }

  // 7. Rate Limiting
  const rateLimit = checkRateLimit(
    matchedKey.id,
    workspace.rateLimitPerMin || 60
  );

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": rateLimit.limit.toString(),
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
    "X-RateLimit-Reset": rateLimit.reset.toString(),
    "Relay-Request-Id": requestId,
    "Relay-Version": apiVersion,
  };

  if (!options?.skipRateLimit && !rateLimit.allowed) {
    // Asynchronously log the 429 rate limit rejection into the api_requests ledger
    try {
      const url = new URL(req.url);
      await db.insert(apiRequests).values({
        id: requestId,
        workspaceId: workspace.id,
        keyId: matchedKey.id,
        environment,
        method: req.method,
        path: url.pathname,
        status: 429,
        durationMs: 5,
        requestHeaders: JSON.stringify({ authorization: `Bearer ${matchedKey.prefix}...` }),
        requestBody: null,
        responseBody: JSON.stringify({
          error: {
            code: "rate_limit_exceeded",
            message: `Too many requests. Limit of ${rateLimit.limit} req/min exceeded.`,
            retry_after: rateLimit.retryAfter || 60,
          },
        }),
        errorCode: "rate_limit_exceeded",
        requestId,
        billedAmountWouldBe: 0,
        billedAmountActual: 0,
        createdAt: new Date(),
        apiVersion,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "127.0.0.1",
      });
    } catch (logErr) {
      console.error("Failed to log 429 rate limit:", logErr);
    }

    return {
      success: false,
      response: createErrorResponse("rate_limit_exceeded", {
        message: `Too many requests. Limit of ${rateLimit.limit} req/min exceeded.`,
        requestId,
        headers: {
          ...rateLimitHeaders,
          "Retry-After": (rateLimit.retryAfter || 60).toString(),
        },
      }),
    };
  }

  // Update lastUsedAt asynchronously
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, matchedKey.id))
    .catch(() => {});

  return {
    success: true,
    context: {
      requestId,
      apiVersion,
      environment,
      key: matchedKey,
      workspace,
      rateLimit,
      startTime,
    },
  };
}

/**
 * Log API Request to `api_requests` database table
 */
export async function logApiRequest(params: {
  context: SandboxContext;
  req: NextRequest;
  status: number;
  requestBody?: string | null;
  responseBody?: string | null;
  errorCode?: string | null;
  idempotencyKey?: string | null;
  billedWouldBe?: number;
  billedActual?: number;
}) {
  try {
    const durationMs = Date.now() - params.context.startTime;
    const url = new URL(params.req.url);

    // Redact Authorization header for security
    const headersObj: Record<string, string> = {};
    params.req.headers.forEach((val, key) => {
      if (key.toLowerCase() === "authorization") {
        const prefix = params.context.key.prefix || "rk_";
        headersObj[key] = `Bearer ${prefix}••••••••`;
      } else {
        headersObj[key] = val;
      }
    });

    await db.insert(apiRequests).values({
      id: params.context.requestId,
      workspaceId: params.context.workspace.id,
      keyId: params.context.key.id,
      environment: params.context.environment,
      method: params.req.method,
      path: url.pathname,
      status: params.status,
      durationMs: durationMs,
      requestHeaders: JSON.stringify(headersObj),
      requestBody: params.requestBody || null,
      responseBody: params.responseBody || null,
      idempotencyKey: params.idempotencyKey || null,
      errorCode: params.errorCode || null,
      requestId: params.context.requestId,
      billedAmountWouldBe: params.billedWouldBe ?? 0,
      billedAmountActual: params.billedActual ?? 0,
      createdAt: new Date(),
      apiVersion: params.context.apiVersion,
      ip: params.req.ip || "127.0.0.1",
    });
  } catch (err) {
    console.error("Failed to log API request:", err);
  }
}

/**
 * Build standard headers for any successful v1 API response
 */
export function buildResponseHeaders(context: SandboxContext, extra?: Record<string, string>): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Relay-Request-Id": context.requestId,
    "Relay-Version": context.apiVersion,
    "X-RateLimit-Limit": context.rateLimit.limit.toString(),
    "X-RateLimit-Remaining": context.rateLimit.remaining.toString(),
    "X-RateLimit-Reset": context.rateLimit.reset.toString(),
    "Relay-RateLimit-Limit": context.rateLimit.limit.toString(),
    "Relay-RateLimit-Remaining": context.rateLimit.remaining.toString(),
    "Relay-RateLimit-Reset": context.rateLimit.reset.toString(),
    ...(extra || {}),
  };
}
