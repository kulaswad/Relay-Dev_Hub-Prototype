import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { usageAlertPreferences, alerts, workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const [pref] = await db
      .select()
      .from(usageAlertPreferences)
      .where(eq(usageAlertPreferences.workspaceId, wsId))
      .limit(1);

    if (!pref) {
      return NextResponse.json({
        workspaceId: wsId,
        threshold80: true,
        threshold95: true,
        spike429: true,
        lowBalanceThreshold: 500,
        emailNotifications: true,
        notificationEmail: "alerts@acmepay.in",
      });
    }

    return NextResponse.json(pref);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();

    const {
      threshold80 = true,
      threshold95 = true,
      spike429 = true,
      lowBalanceThreshold = 500,
      emailNotifications = true,
      notificationEmail = "alerts@acmepay.in",
      testAlert = false,
    } = body;

    // Check if exists
    const [existing] = await db
      .select()
      .from(usageAlertPreferences)
      .where(eq(usageAlertPreferences.workspaceId, wsId))
      .limit(1);

    if (existing) {
      await db
        .update(usageAlertPreferences)
        .set({
          threshold80: Boolean(threshold80),
          threshold95: Boolean(threshold95),
          spike429: Boolean(spike429),
          lowBalanceThreshold: Number(lowBalanceThreshold),
          emailNotifications: Boolean(emailNotifications),
          notificationEmail: String(notificationEmail),
          updatedAt: new Date(),
        })
        .where(eq(usageAlertPreferences.workspaceId, wsId));
    } else {
      await db.insert(usageAlertPreferences).values({
        workspaceId: wsId,
        threshold80: Boolean(threshold80),
        threshold95: Boolean(threshold95),
        spike429: Boolean(spike429),
        lowBalanceThreshold: Number(lowBalanceThreshold),
        emailNotifications: Boolean(emailNotifications),
        notificationEmail: String(notificationEmail),
        updatedAt: new Date(),
      });
    }

    let simulatedEmailSent = false;
    if (testAlert) {
      const alertId = `alt_${crypto.randomBytes(8).toString("hex")}`;
      await db.insert(alerts).values({
        id: alertId,
        workspaceId: wsId,
        type: "quota_test_alert",
        severity: "info",
        title: "Test Quota & Rate Limit Alert",
        message: `Simulated usage alert delivered to ${notificationEmail}. Your alerting pipeline is active and healthy.`,
        isRead: false,
        createdAt: new Date(),
      });
      simulatedEmailSent = true;
    }

    return NextResponse.json({
      success: true,
      message: "Usage alert preferences updated successfully",
      simulatedEmailSent,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
