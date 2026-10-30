import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  authenticateApiRequest,
  simulateLatency,
  logApiRequest,
  buildResponseHeaders,
} from "@/lib/sandbox/middleware";
import { createErrorResponse } from "@/lib/sandbox/errors";
import crypto from "crypto";
import { z } from "zod";

const CreateWebhookEndpointSchema = z.object({
  url: z.string({ required_error: "Parameter 'url' is required" }).url("URL must be a valid HTTPS URL"),
  events: z.array(z.string()).min(1, "At least one event type must be subscribed"),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "messages:send",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(40, 100);

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    rawBody = "";
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawBody || "{}");
  } catch {
    const errRes = createErrorResponse("invalid_request", {
      message: "Malformed JSON payload.",
      requestId: context.requestId,
    });
    return errRes;
  }

  const validation = CreateWebhookEndpointSchema.safeParse(parsed);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    const errRes = createErrorResponse("invalid_request", {
      message: issue.message,
      param: issue.path.join("."),
      requestId: context.requestId,
    });
    return errRes;
  }

  const data = validation.data;
  const endpointId = `wh_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const signingSecret = `whsec_${context.environment}_${crypto.randomBytes(24).toString("hex")}`;
  const now = new Date();

  await db.insert(webhookEndpoints).values({
    id: endpointId,
    workspaceId: context.workspace.id,
    url: data.url,
    environment: context.environment,
    events: JSON.stringify(data.events),
    signingSecret: signingSecret,
    status: "active",
    apiVersion: context.apiVersion,
    createdAt: now,
    consecutiveFailures: 0,
  });

  const responseData = {
    id: endpointId,
    object: "webhook_endpoint",
    url: data.url,
    status: "active",
    environment: context.environment,
    signing_secret: signingSecret,
    events: data.events,
    api_version: context.apiVersion,
    created_at: now.toISOString(),
  };

  await logApiRequest({
    context,
    req,
    status: 201,
    requestBody: rawBody,
    responseBody: JSON.stringify(responseData),
  });

  const headers = buildResponseHeaders(context);
  return NextResponse.json(responseData, {
    status: 201,
    headers,
  });
}

export async function GET(req: NextRequest) {
  const authResult = await authenticateApiRequest(req);
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(30, 70);

  const rows = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.workspaceId, context.workspace.id),
        eq(webhookEndpoints.environment, context.environment)
      )
    )
    .orderBy(desc(webhookEndpoints.createdAt));

  const data = rows.map((ep) => {
    let eventsList: string[] = [];
    try {
      eventsList = JSON.parse(ep.events);
    } catch {}

    return {
      id: ep.id,
      object: "webhook_endpoint",
      url: ep.url,
      status: ep.status,
      environment: ep.environment,
      events: eventsList,
      api_version: ep.apiVersion,
      consecutive_failures: ep.consecutiveFailures,
      created_at: ep.createdAt,
    };
  });

  const responseData = {
    object: "list",
    data,
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
