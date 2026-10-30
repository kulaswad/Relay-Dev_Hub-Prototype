import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customersProfiles, eventsIngested } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  authenticateApiRequest,
  simulateLatency,
  logApiRequest,
  buildResponseHeaders,
} from "@/lib/sandbox/middleware";
import { createErrorResponse } from "@/lib/sandbox/errors";
import crypto from "crypto";
import { z } from "zod";

const SingleEventSchema = z.object({
  customer_id: z.string().optional(),
  external_id: z.string().optional(),
  anonymous_id: z.string().optional(),
  event: z.string({ required_error: "Parameter 'event' is required" }).min(1),
  properties: z.record(z.any()).optional().default({}),
  timestamp: z.union([z.number(), z.string()]).optional(),
  event_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "events:write",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(40, 120);

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    rawBody = "";
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawBody || "{}");
  } catch {
    const errRes = createErrorResponse("invalid_request", {
      message: "Malformed JSON payload.",
      requestId: context.requestId,
    });
    await logApiRequest({
      context,
      req,
      status: 400,
      requestBody: rawBody,
      errorCode: "invalid_request",
    });
    return errRes;
  }

  // Support both single event object and array batch up to 100
  const eventList: any[] = Array.isArray(parsed) ? parsed : [parsed];

  if (eventList.length === 0) {
    const errRes = createErrorResponse("invalid_request", {
      message: "Empty event payload provided.",
      requestId: context.requestId,
    });
    return errRes;
  }

  if (eventList.length > 100) {
    const errRes = createErrorResponse("invalid_request", {
      message: "Batch size limit exceeded. Maximum 100 events per request.",
      requestId: context.requestId,
    });
    return errRes;
  }

  let accepted = 0;
  let rejected = 0;
  const errors: Array<{ index: number; event_id?: string; error: string; code: string }> = [];

  for (let i = 0; i < eventList.length; i++) {
    const item = eventList[i];
    const validation = SingleEventSchema.safeParse(item);

    if (!validation.success) {
      rejected++;
      errors.push({
        index: i,
        event_id: item?.event_id,
        error: validation.error.issues[0]?.message || "Validation failed",
        code: "invalid_request",
      });
      continue;
    }

    const eventData = validation.data;
    const identifier = eventData.external_id || eventData.customer_id || eventData.anonymous_id;

    if (!identifier) {
      rejected++;
      errors.push({
        index: i,
        event_id: eventData.event_id,
        error: "At least one identifier (customer_id, external_id, or anonymous_id) is required",
        code: "missing_parameter",
      });
      continue;
    }

    // Deduplication check via event_id
    if (eventData.event_id) {
      const [existingEvt] = await db
        .select()
        .from(eventsIngested)
        .where(
          and(
            eq(eventsIngested.id, eventData.event_id),
            eq(eventsIngested.workspaceId, context.workspace.id)
          )
        )
        .limit(1);

      if (existingEvt) {
        rejected++;
        errors.push({
          index: i,
          event_id: eventData.event_id,
          error: `Event with event_id '${eventData.event_id}' has already been ingested.`,
          code: "duplicate_event",
        });
        continue;
      }
    }

    // Resolve or create Customer Profile
    let profileId: string;
    let existingProfile = null;

    if (eventData.customer_id) {
      const [p] = await db
        .select()
        .from(customersProfiles)
        .where(
          and(
            eq(customersProfiles.id, eventData.customer_id),
            eq(customersProfiles.workspaceId, context.workspace.id),
            eq(customersProfiles.environment, context.environment)
          )
        )
        .limit(1);
      existingProfile = p;
    } else if (eventData.external_id) {
      const [p] = await db
        .select()
        .from(customersProfiles)
        .where(
          and(
            eq(customersProfiles.externalId, eventData.external_id),
            eq(customersProfiles.workspaceId, context.workspace.id),
            eq(customersProfiles.environment, context.environment)
          )
        )
        .limit(1);
      existingProfile = p;
    }

    const now = new Date();

    if (existingProfile) {
      profileId = existingProfile.id;
      let currentTraits: Record<string, any> = {};
      try {
        currentTraits = JSON.parse(existingProfile.traits);
      } catch {
        currentTraits = {};
      }

      const updatedTraits = {
        ...currentTraits,
        last_seen: now.toISOString(),
        total_events: (existingProfile.eventsCount || 0) + 1,
        ...(eventData.properties?.preferred_channel
          ? { preferred_channel: eventData.properties.preferred_channel }
          : {}),
      };

      await db
        .update(customersProfiles)
        .set({
          eventsCount: (existingProfile.eventsCount || 0) + 1,
          traits: JSON.stringify(updatedTraits),
          updatedAt: now,
        })
        .where(eq(customersProfiles.id, profileId));
    } else {
      profileId = `prf_${crypto.randomBytes(8).toString("hex")}`;
      const initialTraits = {
        total_events: 1,
        last_seen: now.toISOString(),
        preferred_channel: eventData.properties?.preferred_channel || "whatsapp",
      };

      await db.insert(customersProfiles).values({
        id: profileId,
        workspaceId: context.workspace.id,
        environment: context.environment,
        externalId: eventData.external_id || identifier,
        attributes: JSON.stringify(eventData.properties?.attributes || {}),
        traits: JSON.stringify(initialTraits),
        eventsCount: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Insert Ingested Event
    const eventRecordId =
      eventData.event_id || `evt_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

    await db.insert(eventsIngested).values({
      id: eventRecordId,
      workspaceId: context.workspace.id,
      environment: context.environment,
      customerId: profileId,
      eventName: eventData.event,
      properties: JSON.stringify(eventData.properties || {}),
      timestamp: now,
    });

    accepted++;
  }

  const responseData = {
    total: eventList.length,
    accepted,
    rejected,
    errors,
  };

  await logApiRequest({
    context,
    req,
    status: 202,
    requestBody: rawBody,
    responseBody: JSON.stringify(responseData),
  });

  const headers = buildResponseHeaders(context);
  return NextResponse.json(responseData, {
    status: 202,
    headers,
  });
}
