import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages, workspaces } from "@/lib/db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import {
  authenticateApiRequest,
  simulateLatency,
  logApiRequest,
  buildResponseHeaders,
} from "@/lib/sandbox/middleware";
import { createErrorResponse } from "@/lib/sandbox/errors";
import { checkIdempotency } from "@/lib/sandbox/idempotency";
import { calculateMessageCost, MessagingChannel } from "@/lib/sandbox/rate-card";
import {
  isValidIndianE164,
  maskPhoneNumber,
  PREAPPROVED_TEMPLATES,
  TEST_NUMBERS,
  scheduleMessageLifecycle,
} from "@/lib/sandbox/message-simulator";
import crypto from "crypto";
import { z } from "zod";

const SendMessageSchema = z.object({
  to: z.string({ required_error: "Parameter 'to' is required" }),
  channel: z.enum(["sms", "rcs", "whatsapp"], {
    errorMap: () => ({ message: "Invalid channel. Allowed values: sms, rcs, whatsapp" }),
  }),
  template_id: z.string({ required_error: "Parameter 'template_id' is required" }),
  variables: z.record(z.any()).optional().default({}),
  sender_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  callback_url: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  // 1. Authenticate Request
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "messages:send",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  // Add realistic latency
  await simulateLatency(40, 160);

  // 2. Read Raw Body
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    rawBody = "";
  }

  // 3. Idempotency Check
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) {
    const idemCheck = await checkIdempotency(
      context.workspace.id,
      idempotencyKey,
      rawBody
    );

    if (idemCheck.isConflict) {
      const errRes = createErrorResponse("idempotency_conflict", {
        message: "An API request was previously submitted with this Idempotency-Key but with different parameters.",
        requestId: context.requestId,
      });
      await logApiRequest({
        context,
        req,
        status: 409,
        requestBody: rawBody,
        errorCode: "idempotency_conflict",
        idempotencyKey,
      });
      return errRes;
    }

    if (idemCheck.isMatch && idemCheck.savedResponseBody) {
      // Replay identical response
      const headers = buildResponseHeaders(context, {
        "Idempotent-Replayed": "true",
      });
      return NextResponse.json(idemCheck.savedResponseBody, {
        status: idemCheck.savedStatus || 202,
        headers,
      });
    }
  }

  // 4. Parse & Validate Payload Schema
  let parsedJson: any = {};
  try {
    parsedJson = JSON.parse(rawBody || "{}");
  } catch {
    const errRes = createErrorResponse("invalid_request", {
      message: "Malformed JSON body.",
      requestId: context.requestId,
    });
    await logApiRequest({
      context,
      req,
      status: 400,
      requestBody: rawBody,
      errorCode: "invalid_request",
      idempotencyKey,
    });
    return errRes;
  }

  const validation = SendMessageSchema.safeParse(parsedJson);
  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    const paramName = firstIssue?.path?.join(".") || "body";
    const code = firstIssue?.message?.includes("Invalid channel")
      ? "invalid_channel"
      : "missing_parameter";

    const errRes = createErrorResponse(code, {
      message: firstIssue.message,
      param: paramName,
      requestId: context.requestId,
    });
    await logApiRequest({
      context,
      req,
      status: 400,
      requestBody: rawBody,
      errorCode: code,
      idempotencyKey,
    });
    return errRes;
  }

  const bodyData = validation.data;

  // 5. Test Number Special Scenario: +919999900005 triggers 429 Rate Limit
  if (bodyData.to === TEST_NUMBERS.TRIGGERS_RATE_LIMIT) {
    const errRes = createErrorResponse("rate_limit_exceeded", {
      message: "Test number +919999900005 triggered simulated 429 rate limit.",
      requestId: context.requestId,
      headers: {
        "Retry-After": "30",
      },
    });
    await logApiRequest({
      context,
      req,
      status: 429,
      requestBody: rawBody,
      errorCode: "rate_limit_exceeded",
      idempotencyKey,
    });
    return errRes;
  }

  // 6. Validate E.164 Indian Phone Number
  if (!isValidIndianE164(bodyData.to)) {
    const errRes = createErrorResponse("invalid_phone_number", {
      message: `The recipient number '${bodyData.to}' is not a valid Indian E.164 mobile number (+91XXXXXXXXXX).`,
      param: "to",
      requestId: context.requestId,
    });
    await logApiRequest({
      context,
      req,
      status: 422,
      requestBody: rawBody,
      errorCode: "invalid_phone_number",
      idempotencyKey,
    });
    return errRes;
  }

  // 7. Validate DLT Template
  const templateDef = PREAPPROVED_TEMPLATES[bodyData.template_id];
  if (!templateDef && !bodyData.template_id.startsWith("dlt_tmpl_")) {
    const errRes = createErrorResponse("template_not_found", {
      message: `DLT Template '${bodyData.template_id}' was not found. Pre-approved templates: ${Object.keys(PREAPPROVED_TEMPLATES).join(", ")}.`,
      param: "template_id",
      requestId: context.requestId,
    });
    await logApiRequest({
      context,
      req,
      status: 404,
      requestBody: rawBody,
      errorCode: "template_not_found",
      idempotencyKey,
    });
    return errRes;
  }

  // 8. Validate Approved Sender ID
  let approvedSenders: string[] = ["RELAYI", "ACMEPY"];
  try {
    if (context.workspace.senderIds) {
      approvedSenders = JSON.parse(context.workspace.senderIds);
    }
  } catch {
    approvedSenders = ["RELAYI", "ACMEPY"];
  }

  const selectedSenderId = bodyData.sender_id || approvedSenders[0] || "RELAYI";
  if (!approvedSenders.includes(selectedSenderId)) {
    const errRes = createErrorResponse("sender_id_not_approved", {
      message: `Sender ID '${selectedSenderId}' is not approved for this workspace. Approved headers: [${approvedSenders.join(", ")}].`,
      param: "sender_id",
      requestId: context.requestId,
    });
    await logApiRequest({
      context,
      req,
      status: 422,
      requestBody: rawBody,
      errorCode: "sender_id_not_approved",
      idempotencyKey,
    });
    return errRes;
  }

  // 9. Cost Calculation & Wallet Balance Gate
  const cost = calculateMessageCost(
    bodyData.channel as MessagingChannel,
    context.environment
  );

  if (context.environment === "live") {
    const currentBalance = context.workspace.walletBalance || 0;
    if (currentBalance < cost.actualCharged) {
      const errRes = createErrorResponse("insufficient_balance", {
        message: `Insufficient prepaid wallet balance. Required: ₹${cost.actualCharged}, Available: ₹${currentBalance}.`,
        requestId: context.requestId,
      });
      await logApiRequest({
        context,
        req,
        status: 402,
        requestBody: rawBody,
        errorCode: "insufficient_balance",
        idempotencyKey,
      });
      return errRes;
    }

    // Deduct from wallet
    await db
      .update(workspaces)
      .set({
        walletBalance: currentBalance - cost.actualCharged,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, context.workspace.id));
  }

  // 10. Render Message Body with placeholders
  let renderedBody = templateDef?.template || "Your verification OTP is {#var#}.";
  if (bodyData.variables) {
    for (const [key, val] of Object.entries(bodyData.variables)) {
      renderedBody = renderedBody.replace("{#var#}", String(val));
    }
  }

  // 11. Create Message Record
  const messageId = `msg_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date();

  await db.insert(messages).values({
    id: messageId,
    workspaceId: context.workspace.id,
    environment: context.environment,
    channel: bodyData.channel,
    to: bodyData.to,
    templateId: bodyData.template_id,
    body: renderedBody,
    status: "queued",
    costWouldBe: cost.wouldBeCharged,
    createdAt: now,
    updatedAt: now,
    externalRef: bodyData.metadata?.transaction_id || null,
  });

  // 12. Schedule Background Lifecycle Simulation
  scheduleMessageLifecycle({
    messageId,
    workspaceId: context.workspace.id,
    environment: context.environment,
    recipient: bodyData.to,
    channel: bodyData.channel as MessagingChannel,
    apiVersion: context.apiVersion,
  });

  // 13. Build Response Object
  const responseData = {
    id: messageId,
    object: "message",
    status: "queued",
    channel: bodyData.channel,
    to: maskPhoneNumber(bodyData.to),
    sender_id: selectedSenderId,
    template_id: bodyData.template_id,
    cost: {
      estimated: cost.estimated,
      currency: cost.currency,
      charged: cost.actualCharged,
    },
    created_at: now.toISOString(),
  };

  const responseString = JSON.stringify(responseData);

  // 14. Log Request
  await logApiRequest({
    context,
    req,
    status: 202,
    requestBody: rawBody,
    responseBody: responseString,
    idempotencyKey,
    billedWouldBe: cost.wouldBeCharged,
    billedActual: cost.actualCharged,
  });

  const headers = buildResponseHeaders(context);
  return NextResponse.json(responseData, {
    status: 202,
    headers,
  });
}

export async function GET(req: NextRequest) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "messages:read",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(30, 90);

  const url = new URL(req.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 20 : limitParam), 100);
  const statusFilter = url.searchParams.get("status");
  const channelFilter = url.searchParams.get("channel");
  const startingAfter = url.searchParams.get("starting_after");

  // Fetch list from database
  const query = db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.workspaceId, context.workspace.id),
        eq(messages.environment, context.environment)
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1);

  const rows = await query;
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit).map((msg) => ({
    id: msg.id,
    object: "message",
    status: msg.status,
    channel: msg.channel,
    to: maskPhoneNumber(msg.to),
    template_id: msg.templateId,
    failure_reason: msg.failureReason,
    created_at: msg.createdAt,
    cost: {
      estimated: msg.costWouldBe,
      currency: "INR",
    },
  }));

  const responseData = {
    object: "list",
    data,
    has_more: hasMore,
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
