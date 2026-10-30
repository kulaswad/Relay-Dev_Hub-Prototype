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
  { params }: { params: { message_id: string } }
) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "messages:read",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(30, 80);

  const messageId = params.message_id;
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
      param: "message_id",
      requestId: context.requestId,
    });
    return errRes;
  }

  // Determine realistic carrier, circle, and DLR codes
  let dlrCode = "SUBMITD";
  let description = "Message accepted by SMSC; awaiting terminal delivery receipt.";
  let carrier = "Bharti Airtel";
  let circle = "Karnataka";

  if (msg.status === "delivered" || msg.status === "read") {
    dlrCode = "DELIVRD";
    description = "Message successfully acknowledged by end-user terminal handset.";
  } else if (msg.status === "failed") {
    if (msg.failureReason?.includes("dnd")) {
      dlrCode = "REJECTD";
      description = "Carrier rejected: Recipient registered on TRAI NDNC Do Not Call registry.";
    } else if (msg.failureReason?.includes("unreachable")) {
      dlrCode = "UNDELIV";
      description = "Carrier unreachable: Mobile station out of range or powered off.";
    } else {
      dlrCode = "FAILED";
      description = msg.failureReason || "Carrier error processing delivery receipt.";
    }
  }

  const createdAtMs = new Date(msg.createdAt).getTime();
  const responseData = {
    message_id: msg.id,
    object: "delivery_report",
    status: msg.status,
    channel: msg.channel,
    recipient: maskPhoneNumber(msg.to),
    carrier,
    circle,
    dlr_code: dlrCode,
    description,
    attempts: 1,
    timestamps: {
      submitted: msg.createdAt,
      dispatched: new Date(createdAtMs + 1200).toISOString(),
      delivered: msg.status === "delivered" || msg.status === "read" ? new Date(createdAtMs + 2800).toISOString() : null,
    },
    failure_reason: msg.failureReason,
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
