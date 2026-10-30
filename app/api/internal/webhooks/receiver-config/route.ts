import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const ReceiverConfigSchema = z.object({
  behavior: z.enum(["200", "500", "401", "timeout", "verify_signature"]).optional(),
  accelerationFactor: z.number().min(1).max(60).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();
    const validated = ReceiverConfigSchema.parse(body);

    const updateFields: any = {};
    if (validated.behavior) updateFields.receiverBehavior = validated.behavior;
    if (validated.accelerationFactor) updateFields.accelerationFactor = validated.accelerationFactor;

    await db
      .update(workspaces)
      .set(updateFields)
      .where(eq(workspaces.id, wsId));

    const [updated] = await db
      .select({
        behavior: workspaces.receiverBehavior,
        accelerationFactor: workspaces.accelerationFactor,
      })
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    return NextResponse.json({
      success: true,
      receiverConfig: {
        behavior: updated?.behavior,
        accelerationFactor: updated?.accelerationFactor,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
