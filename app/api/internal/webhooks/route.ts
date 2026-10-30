import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  webhookEndpoints,
  webhookDeliveries,
  webhookEvents,
  workspaces,
} from "@/lib/db/schema";
import { eq, and, desc, gt, sql } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const url = new URL(req.url);
    const envFilter = url.searchParams.get("environment");

    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .limit(1);

    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(
        envFilter && (envFilter === "test" || envFilter === "live")
          ? and(
              eq(webhookEndpoints.workspaceId, wsId),
              eq(webhookEndpoints.environment, envFilter)
            )
          : eq(webhookEndpoints.workspaceId, wsId)
      )
      .orderBy(desc(webhookEndpoints.createdAt));

    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);

    // Compute 24h stats for each endpoint
    const enrichedEndpoints = await Promise.all(
      endpoints.map(async (ep) => {
        const [total24hResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(webhookDeliveries)
          .where(
            and(
              eq(webhookDeliveries.endpointId, ep.id),
              gt(webhookDeliveries.attemptedAt, oneDayAgo)
            )
          );

        const [success24hResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(webhookDeliveries)
          .where(
            and(
              eq(webhookDeliveries.endpointId, ep.id),
              eq(webhookDeliveries.status, "success"),
              gt(webhookDeliveries.attemptedAt, oneDayAgo)
            )
          );

        const [lastDelivery] = await db
          .select({ attemptedAt: webhookDeliveries.attemptedAt })
          .from(webhookDeliveries)
          .where(eq(webhookDeliveries.endpointId, ep.id))
          .orderBy(desc(webhookDeliveries.attemptedAt))
          .limit(1);

        const total = total24hResult?.count || 0;
        const success = success24hResult?.count || 0;
        const successRate = total > 0 ? Math.round((success / total) * 100) : 100;

        let eventsList: string[] = [];
        try {
          eventsList = JSON.parse(ep.events);
        } catch {}

        return {
          ...ep,
          events: eventsList,
          successRate24h: successRate,
          totalDeliveries24h: total,
          lastDeliveryAt: lastDelivery?.attemptedAt || null,
        };
      })
    );

    const testReceiverUrl = `http://localhost:3001/api/receiver/${wsId}`;

    return NextResponse.json({
      endpoints: enrichedEndpoints,
      receiverConfig: {
        url: testReceiverUrl,
        behavior: ws?.receiverBehavior || "200",
        accelerationFactor: ws?.accelerationFactor || 1,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const CreateEndpointSchema = z.object({
  url: z.string().min(4, "URL is required"),
  environment: z.enum(["test", "live"]).default("test"),
  events: z.array(z.string()).min(1, "Select at least one event type"),
  apiVersion: z.string().default("v2025-10-01"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";
    const body = await req.json();
    const validated = CreateEndpointSchema.parse(body);

    const targetUrl = validated.url.trim();

    // URL Validation:
    // In Live mode: MUST be https://
    // In Test mode: http:// or https:// allowed (localhost allowed in test only)
    if (validated.environment === "live") {
      if (!targetUrl.startsWith("https://")) {
        return NextResponse.json(
          { error: "Live production webhook endpoints require HTTPS for security." },
          { status: 400 }
        );
      }
      if (targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1")) {
        return NextResponse.json(
          { error: "Localhost URLs are only permitted in the Test sandbox environment." },
          { status: 400 }
        );
      }
    } else {
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        return NextResponse.json(
          { error: "Endpoint URL must begin with http:// or https://" },
          { status: 400 }
        );
      }
    }

    const endpointId = `wh_ep_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
    const signingSecret = `whsec_${validated.environment}_${crypto.randomBytes(24).toString("hex")}`;
    const now = new Date();

    await db.insert(webhookEndpoints).values({
      id: endpointId,
      workspaceId: wsId,
      url: targetUrl,
      environment: validated.environment,
      events: JSON.stringify(validated.events),
      signingSecret: signingSecret,
      status: "active",
      apiVersion: validated.apiVersion,
      createdAt: now,
      consecutiveFailures: 0,
    });

    const [created] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, endpointId))
      .limit(1);

    return NextResponse.json({
      success: true,
      endpoint: {
        ...created,
        events: validated.events,
      },
      signingSecret: signingSecret, // Revealed once on creation
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
