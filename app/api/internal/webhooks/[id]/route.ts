import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();

    const [existing] = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, params.id),
          eq(webhookEndpoints.workspaceId, wsId)
        )
      )
      .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  const updateFields: any = {};
  if (body.url) updateFields.url = body.url.trim();
  if (body.events) updateFields.events = JSON.stringify(body.events);
  if (body.status && ["active", "disabled", "failing"].includes(body.status)) {
    updateFields.status = body.status;
    if (body.status === "active") {
      updateFields.consecutiveFailures = 0; // Reset failures on re-enabling
    }
  }

  await db
    .update(webhookEndpoints)
    .set(updateFields)
    .where(eq(webhookEndpoints.id, existing.id));

  const [updated] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, existing.id))
    .limit(1);

  let eventsList: string[] = [];
  try {
    eventsList = JSON.parse(updated.events);
  } catch {}

  return NextResponse.json({
    success: true,
    endpoint: {
      ...updated,
      events: eventsList,
    },
  });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    await db
      .delete(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, params.id),
          eq(webhookEndpoints.workspaceId, wsId)
        )
      );

    return NextResponse.json({ success: true, deleted: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
