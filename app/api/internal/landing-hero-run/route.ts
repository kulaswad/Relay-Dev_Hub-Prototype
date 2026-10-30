import { NextRequest, NextResponse } from "next/server";
import { getSession, createAnonymousEvaluationWorkspace } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys, workspaces, messages, apiRequests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let session = await getSession();

    let workspaceId = session?.workspace?.id;
    let apiKeyRecord = null;
    let rawApiKey = "";

    if (!session || !workspaceId) {
      // Auto-initialize an anonymous evaluation workspace so they immediately have a working 24h key and state
      const evalSession = await createAnonymousEvaluationWorkspace();
      workspaceId = evalSession.workspace.id;

      const [key] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.workspaceId, workspaceId))
        .limit(1);

      apiKeyRecord = key;
      rawApiKey = key?.fullKeyForDev || "rk_test_eval_default";
    } else {
      // Find active test key for current workspace
      const [key] = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.workspaceId, workspaceId),
            eq(apiKeys.environment, "test"),
            eq(apiKeys.status, "active")
          )
        )
        .limit(1);

      apiKeyRecord = key;
      rawApiKey = key?.fullKeyForDev || "rk_test_acmepay_9fa1b2e84c302948";
    }

    const recipient = body.recipient || "+919876543210";
    const channel = body.channel || "sms";
    const senderId = body.sender_id || "RELAYI";
    const templateId = body.template_id || "dlt_tmpl_otp_login";
    const messageBody = body.body || "Your Relay OTP is 482910. Valid for 10 minutes. Do not share.";

    const messageId = `msg_${crypto.randomBytes(8).toString("hex")}`;
    const requestId = `req_${crypto.randomBytes(12).toString("hex")}`;
    const startTime = Date.now();

    // Insert message into DB
    const now = new Date();
    await db.insert(messages).values({
      id: messageId,
      workspaceId: workspaceId,
      channel: channel as "sms" | "rcs" | "whatsapp",
      to: recipient,
      recipient: recipient,
      senderId: senderId,
      templateId: templateId,
      body: messageBody,
      status: "queued",
      environment: "test",
      cost: 0.12,
      createdAt: now,
      updatedAt: now,
    });

    const durationMs = Math.floor(Math.random() * 45) + 38; // 38-83ms realistic latency

    // Log request in api_requests
    await db.insert(apiRequests).values({
      id: requestId,
      workspaceId: workspaceId,
      keyId: apiKeyRecord?.id || "key_hero_runner",
      method: "POST",
      path: "/api/v1/messages",
      status: 202,
      durationMs: durationMs,
      ip: "127.0.0.1",
      environment: "test",
      apiVersion: "v2025-10-01",
      requestId: requestId,
      requestHeaders: JSON.stringify({
        "authorization": `Bearer ${rawApiKey}`,
        "content-type": "application/json",
      }),
      requestBody: JSON.stringify({
        channel,
        to: recipient,
        sender_id: senderId,
        template_id: templateId,
        body: messageBody,
      }),
      responseBody: JSON.stringify({
        id: messageId,
        status: "queued",
        channel,
        to: recipient,
        sender_id: senderId,
        template_id: templateId,
        cost: 0.12,
        currency: "INR",
        environment: "test",
        created_at: now.toISOString(),
      }),
      createdAt: now,
    });

    const responsePayload = {
      id: messageId,
      status: "queued",
      channel: channel,
      to: recipient,
      sender_id: senderId,
      template_id: templateId,
      cost: 0.12,
      currency: "INR",
      environment: "test",
      created_at: now.toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        statusCode: 202,
        durationMs,
        requestId,
        headers: {
          "content-type": "application/json",
          "relay-request-id": requestId,
          "relay-ratelimit-limit": "60",
          "relay-ratelimit-remaining": "59",
          "relay-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60),
          "relay-version": "2025-10-01",
        },
        data: responsePayload,
      },
      {
        status: 200,
        headers: {
          "Relay-Request-Id": requestId,
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute sandbox request" },
      { status: 500 }
    );
  }
}
