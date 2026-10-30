import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { changelogSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const SubSchema = z.object({
  email: z.string().email(),
  subscribed: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, subscribed } = SubSchema.parse(body);

    const [existing] = await db
      .select()
      .from(changelogSubscriptions)
      .where(eq(changelogSubscriptions.email, email))
      .limit(1);

    if (existing) {
      await db
        .update(changelogSubscriptions)
        .set({ subscribedBreakingChanges: subscribed })
        .where(eq(changelogSubscriptions.id, existing.id));
    } else {
      await db.insert(changelogSubscriptions).values({
        id: `sub_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`,
        email,
        subscribedBreakingChanges: subscribed,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      email,
      subscribed,
      message: subscribed
        ? `Subscribed ${email} to breaking changes and deprecation email alerts.`
        : `Unsubscribed ${email} from breaking changes email alerts.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
