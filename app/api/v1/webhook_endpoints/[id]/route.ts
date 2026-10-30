import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  authenticateApiRequest,
  simulateLatency,
  logApiRequest,
  buildResponseHeaders,
} from "@/lib/sandbox/middleware";
import { createErrorResponse } from "@/lib/sandbox/errors";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "messages:send",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(30, 80);

  const endpointId = params.id;
  const [existing] = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, endpointId),
        eq(webhookEndpoints.workspaceId, context.workspace.id)
      )
    )
    .limit(1);

  if (!existing) {
    const errRes = createErrorResponse("invalid_request", {
      message: `Webhook endpoint with ID '${endpointId}' does not exist.`,
      param: "id",
      requestId: context.requestId,
    });
    return errRes;
  }

  await db
    .delete(webhookEndpoints)
    .where(eq(webhookEndpoints.id, endpointId));

  const responseData = {
    id: endpointId,
    object: "webhook_endpoint",
    deleted: true,
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
