import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  authenticateApiRequest,
  simulateLatency,
  logApiRequest,
  buildResponseHeaders,
} from "@/lib/sandbox/middleware";
import { createErrorResponse } from "@/lib/sandbox/errors";
import { maskPhoneNumber } from "@/lib/sandbox/message-simulator";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "messages:read",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(30, 80);

  const messageId = params.id;
  const [msg] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.workspaceId, context.workspace.id),
        eq(messages.environment, context.environment)
      )
    )
    .limit(1);

  if (!msg) {
    const errRes = createErrorResponse("message_not_found", {
      message: `Message with ID '${messageId}' does not exist in ${context.environment} mode.`,
      param: "id",
      requestId: context.requestId,
    });
    await logApiRequest({
      context,
      req,
      status: 404,
      errorCode: "message_not_found",
    });
    return errRes;
  }

  // Build realistic carrier delivery timeline
  const createdAtMs = new Date(msg.createdAt).getTime();
  const timeline: Array<{ status: string; timestamp: string; details?: string }> = [
    { status: "queued", timestamp: new Date(createdAtMs).toISOString() },
  ];

  if (msg.status === "sent" || msg.status === "delivered" || msg.status === "read" || (msg.status === "failed" && !msg.failureReason?.includes("dnd"))) {
    timeline.push({
      status: "sent",
      timestamp: new Date(createdAtMs + 1200).toISOString(),
      details: "Dispatched to telecom MSC (SMSC Gateway)",
    });
  }

  if (msg.status === "delivered" || msg.status === "read") {
    timeline.push({
      status: "delivered",
      timestamp: new Date(createdAtMs + 2800).toISOString(),
      details: "Terminal handset acknowledged delivery receipt",
    });
  }

  if (msg.status === "read") {
    timeline.push({
      status: "read",
      timestamp: new Date(createdAtMs + 4200).toISOString(),
      details: "End-user opened and viewed message in chat application",
    });
  }

  if (msg.status === "failed") {
    timeline.push({
      status: "failed",
      timestamp: new Date(createdAtMs + 2400).toISOString(),
      details: msg.failureReason || "Carrier delivery failed",
    });
  }

  const responseData = {
    id: msg.id,
    object: "message",
    status: msg.status,
    channel: msg.channel,
    to: maskPhoneNumber(msg.to),
    template_id: msg.templateId,
    body: msg.body,
    timeline,
    failure_reason: msg.failureReason,
    cost: {
      estimated: msg.costWouldBe,
      currency: "INR",
    },
    created_at: msg.createdAt,
    updated_at: msg.updatedAt,
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
