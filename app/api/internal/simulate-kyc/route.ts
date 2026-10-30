import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const KycSchema = z.object({
  workspaceId: z.string().optional(),
  kycStatus: z.enum(["not_started", "in_review", "approved"]).optional(),
  approved: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const validated = KycSchema.parse(body);

    const targetWsId = validated.workspaceId || session?.workspace?.id || "ws_acmepay_prod";

    let finalKycStatus: "not_started" | "in_review" | "approved" = "approved";
    if (validated.kycStatus) {
      finalKycStatus = validated.kycStatus;
    } else if (validated.approved !== undefined) {
      finalKycStatus = validated.approved ? "approved" : "not_started";
    }

    await db
      .update(workspaces)
      .set({
        kycStatus: finalKycStatus,
        status: finalKycStatus === "approved" ? "active" : "kyc_pending",
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, targetWsId));

    const [updated] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, targetWsId))
      .limit(1);

    return NextResponse.json({
      success: true,
      workspace: updated,
      message: `KYC status simulated to '${finalKycStatus}'.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
