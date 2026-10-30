import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { eq, and, desc, gt } from "drizzle-orm";
import {
  authenticateApiRequest,
  simulateLatency,
  logApiRequest,
  buildResponseHeaders,
} from "@/lib/sandbox/middleware";
import { maskPhoneNumber } from "@/lib/sandbox/message-simulator";

export async function GET(req: NextRequest) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "messages:read",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(30, 80);

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);

  let sinceDate: Date;
  if (sinceParam) {
    const epochOrIso = isNaN(Number(sinceParam)) ? sinceParam : Number(sinceParam) * 1000;
    sinceDate = new Date(epochOrIso);
  } else {
    // Default last 1 hour
    sinceDate = new Date(Date.now() - 3600 * 1000);
  }

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.workspaceId, context.workspace.id),
        eq(messages.environment, context.environment),
        gt(messages.updatedAt, sinceDate)
      )
    )
    .orderBy(desc(messages.updatedAt))
    .limit(limit);

  const data = rows.map((msg) => {
    let dlrCode = "SUBMITD";
    let dlrDesc = "Submitted to telecom operator MSC.";
    if (msg.status === "delivered" || msg.status === "read") {
      dlrCode = "DELIVRD";
      dlrDesc = "Handset delivered successfully.";
    } else if (msg.status === "failed") {
      if (msg.failureReason?.includes("dnd")) {
        dlrCode = "REJECTD";
        dlrDesc = "Blocked by National Do Not Call registry (NDNC).";
      } else {
        dlrCode = "UNDELIV";
        dlrDesc = msg.failureReason || "Terminal handset unreachable.";
      }
    }

    return {
      message_id: msg.id,
      status: msg.status,
      channel: msg.channel,
      recipient: maskPhoneNumber(msg.to),
      dlr_code: dlrCode,
      description: dlrDesc,
      updated_at: msg.updatedAt,
    };
  });

  const responseData = {
    object: "list",
    data,
    since: sinceDate.toISOString(),
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
