import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customersProfiles, eventsIngested } from "@/lib/db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import {
  authenticateApiRequest,
  simulateLatency,
  logApiRequest,
  buildResponseHeaders,
} from "@/lib/sandbox/middleware";
import { createErrorResponse } from "@/lib/sandbox/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "profiles:read",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(30, 80);

  const rawId = params.id;
  // If id starts with ext_, strip it for external ID lookup, or search both
  const cleanExtId = rawId.startsWith("ext_") ? rawId.slice(4) : rawId;

  const [profile] = await db
    .select()
    .from(customersProfiles)
    .where(
      and(
        eq(customersProfiles.workspaceId, context.workspace.id),
        eq(customersProfiles.environment, context.environment),
        or(
          eq(customersProfiles.id, rawId),
          eq(customersProfiles.externalId, rawId),
          eq(customersProfiles.externalId, cleanExtId)
        )
      )
    )
    .limit(1);

  if (!profile) {
    const errRes = createErrorResponse("customer_not_found", {
      message: `No customer profile found matching identifier '${rawId}'.`,
      param: "id",
      requestId: context.requestId,
    });
    await logApiRequest({
      context,
      req,
      status: 404,
      errorCode: "customer_not_found",
    });
    return errRes;
  }

  // Fetch recent events for this customer
  const recentEvents = await db
    .select()
    .from(eventsIngested)
    .where(
      and(
        eq(eventsIngested.customerId, profile.id),
        eq(eventsIngested.workspaceId, context.workspace.id)
      )
    )
    .orderBy(desc(eventsIngested.timestamp))
    .limit(10);

  let parsedAttrs: any = {};
  let parsedTraits: any = {};
  try {
    parsedAttrs = JSON.parse(profile.attributes);
  } catch {}
  try {
    parsedTraits = JSON.parse(profile.traits);
  } catch {}

  const responseData = {
    id: profile.id,
    object: "customer",
    external_ids: profile.externalId ? [profile.externalId] : [],
    attributes: parsedAttrs,
    traits: {
      total_events: profile.eventsCount || 0,
      last_seen: parsedTraits.last_seen || profile.updatedAt,
      preferred_channel: parsedTraits.preferred_channel || "whatsapp",
      ...parsedTraits,
    },
    consent: {
      sms_opt_in: true,
      whatsapp_opt_in: true,
      rcs_opt_in: true,
      updated_at: profile.updatedAt,
    },
    recent_events: recentEvents.map((evt) => {
      let p: any = {};
      try {
        p = JSON.parse(evt.properties);
      } catch {}
      return {
        id: evt.id,
        event: evt.eventName,
        properties: p,
        timestamp: evt.timestamp,
      };
    }),
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };

  await logApiRequest({
    context,
    req,
    status: 200,
    responseBody: JSON.stringify(responseData),
  });

  const headers = buildResponseHeaders(context);
  return NextResponse.json(responseData, {
    status: 200,
    headers,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "events:write",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(40, 90);

  const rawId = params.id;
  const cleanExtId = rawId.startsWith("ext_") ? rawId.slice(4) : rawId;

  const [profile] = await db
    .select()
    .from(customersProfiles)
    .where(
      and(
        eq(customersProfiles.workspaceId, context.workspace.id),
        eq(customersProfiles.environment, context.environment),
        or(
          eq(customersProfiles.id, rawId),
          eq(customersProfiles.externalId, rawId),
          eq(customersProfiles.externalId, cleanExtId)
        )
      )
    )
    .limit(1);

  if (!profile) {
    const errRes = createErrorResponse("customer_not_found", {
      message: `No customer profile found matching identifier '${rawId}'.`,
      param: "id",
      requestId: context.requestId,
    });
    return errRes;
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let currentAttrs: any = {};
  let currentTraits: any = {};
  try {
    currentAttrs = JSON.parse(profile.attributes);
  } catch {}
  try {
    currentTraits = JSON.parse(profile.traits);
  } catch {}

  const mergedAttrs = { ...currentAttrs, ...(body.attributes || {}) };
  const mergedTraits = { ...currentTraits, ...(body.traits || {}) };
  const now = new Date();

  await db
    .update(customersProfiles)
    .set({
      attributes: JSON.stringify(mergedAttrs),
      traits: JSON.stringify(mergedTraits),
      updatedAt: now,
    })
    .where(eq(customersProfiles.id, profile.id));

  const responseData = {
    id: profile.id,
    object: "customer",
    updated: true,
    attributes: mergedAttrs,
    traits: mergedTraits,
    updated_at: now.toISOString(),
  };

  await logApiRequest({
    context,
    req,
    status: 200,
    responseBody: JSON.stringify(responseData),
  });

  const headers = buildResponseHeaders(context);
  return NextResponse.json(responseData, {
    status: 200,
    headers,
  });
}
