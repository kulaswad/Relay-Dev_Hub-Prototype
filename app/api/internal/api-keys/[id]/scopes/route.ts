import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys, apiKeyAuditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

const ScopesSchema = z.object({
  scopes: z.array(z.string()).min(1, "At least one scope must be selected"),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();
    const { scopes } = ScopesSchema.parse(body);

    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, params.id))
      .limit(1);

    if (!key || key.workspaceId !== wsId) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    let oldScopes: string[] = [];
    try {
      oldScopes = JSON.parse(key.scopes);
    } catch {}

    const now = new Date();

    await db
      .update(apiKeys)
      .set({
        scopes: JSON.stringify(scopes),
      })
      .where(eq(apiKeys.id, key.id));

    const actor = session?.user?.name
      ? `${session.user.name} (${session.user.email})`
      : "Aditya Roy (demo@acmepay.in)";

    await db.insert(apiKeyAuditLogs).values({
      id: `akal_${crypto.randomBytes(8).toString("hex")}`,
      keyId: key.id,
      workspaceId: wsId,
      action: "scope_changed",
      actor: actor,
      details: JSON.stringify({
        previousScopes: oldScopes,
        newScopes: scopes,
      }),
      createdAt: now,
    });

    const [updated] = await db.select().from(apiKeys).where(eq(apiKeys.id, key.id)).limit(1);

    return NextResponse.json({
      success: true,
      key: updated,
      message: "Key scopes updated successfully. Permissions apply immediately.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
