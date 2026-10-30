import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { supportThreads, workspaces } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateThreadSchema = z.object({
  subject: z.string().min(3),
  message: z.string().min(5),
  context: z.record(z.any()).optional().default({}),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const threads = await db
      .select()
      .from(supportThreads)
      .where(eq(supportThreads.workspaceId, wsId))
      .orderBy(desc(supportThreads.createdAt));

    const parsedThreads = threads.map((t) => {
      let parsedContext = {};
      let parsedMessages: any[] = [];
      try {
        parsedContext = JSON.parse(t.context);
      } catch {}
      try {
        parsedMessages = JSON.parse(t.messages);
      } catch {}

      return {
        ...t,
        context: parsedContext,
        messages: parsedMessages,
      };
    });

    return NextResponse.json({ threads: parsedThreads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const body = await req.json();
    const validated = CreateThreadSchema.parse(body);

    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    const threadId = `thr_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
    const now = new Date();
    const authorName = session?.user?.name || "Developer";

    const devMessage = {
      id: `msg_dev_${Date.now().toString(36)}`,
      sender: "developer",
      authorName,
      text: validated.message,
      timestamp: now.toISOString(),
    };

    // Automated simulated first response from Relay Solutions Engineer
    const lastRequestSummary =
      validated.context?.last10RequestIds?.slice(0, 3)?.join(", ") || "No recent request IDs attached";
    const slaText =
      ws?.planTier === "enterprise"
        ? "Within 30 minutes"
        : ws?.planTier === "growth"
        ? "Within 4 hours"
        : "Within 24 business hours";

    const simulatedReply = {
      id: `msg_eng_${Date.now().toString(36)}`,
      sender: "engineer",
      authorName: "Priya Sharma (Relay Solutions Engineer)",
      text: `Hello ${authorName}! Thank you for reaching out to Relay developer support. I've received your inquiry regarding "${validated.subject}" along with your diagnostics (Environment: ${validated.context?.environment || "test"}, Request IDs: ${lastRequestSummary}). Our telecom infrastructure team has been notified (${slaText} SLA). I am reviewing the raw gateway logs now and will provide a full resolution shortly.`,
      timestamp: new Date(Date.now() + 1000).toISOString(),
    };

    const messages = [devMessage, simulatedReply];

    await db.insert(supportThreads).values({
      id: threadId,
      workspaceId: wsId,
      subject: validated.subject,
      status: "waiting",
      context: JSON.stringify(validated.context || {}),
      messages: JSON.stringify(messages),
      createdAt: now,
    });

    const engineerReply = {
      author: "Priya Sharma",
      authorRole: "Relay Solutions Engineer",
      message: simulatedReply.text,
      timestamp: simulatedReply.timestamp,
    };

    return NextResponse.json({
      success: true,
      threadId,
      message: "Support request created. An engineer has been notified.",
      engineerReply,
      thread: {
        id: threadId,
        subject: validated.subject,
        status: "waiting",
        context: validated.context,
        messages,
        createdAt: now,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
