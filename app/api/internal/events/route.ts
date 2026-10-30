import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiRequests, messages, eventsIngested } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const recentRequests = await db
      .select()
      .from(apiRequests)
      .where(eq(apiRequests.workspaceId, wsId))
      .orderBy(desc(apiRequests.createdAt))
      .limit(50);

    const recentMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, wsId))
      .orderBy(desc(messages.createdAt))
      .limit(50);

    const recentCdpEvents = await db
      .select()
      .from(eventsIngested)
      .where(eq(eventsIngested.workspaceId, wsId))
      .orderBy(desc(eventsIngested.timestamp))
      .limit(50);

    return NextResponse.json({
      requests: recentRequests,
      messages: recentMessages,
      cdpEvents: recentCdpEvents,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
