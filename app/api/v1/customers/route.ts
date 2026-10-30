import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customersProfiles } from "@/lib/db/schema";
import { eq, and, desc, like } from "drizzle-orm";
import {
  authenticateApiRequest,
  simulateLatency,
  logApiRequest,
  buildResponseHeaders,
} from "@/lib/sandbox/middleware";

export async function GET(req: NextRequest) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "profiles:read",
  });
  if (!authResult.success) {
    return authResult.response;
  }
  const { context } = authResult;

  await simulateLatency(30, 80);

  const url = new URL(req.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 20 : limitParam), 100);
  const search = url.searchParams.get("search");

  let query = db
    .select()
    .from(customersProfiles)
    .where(
      and(
        eq(customersProfiles.workspaceId, context.workspace.id),
        eq(customersProfiles.environment, context.environment)
      )
    )
    .orderBy(desc(customersProfiles.updatedAt))
    .limit(limit + 1);

  const rows = await query;
  const hasMore = rows.length > limit;

  const data = rows.slice(0, limit).map((p) => {
    let parsedAttrs: any = {};
    let parsedTraits: any = {};
    try {
      parsedAttrs = JSON.parse(p.attributes);
    } catch {}
    try {
      parsedTraits = JSON.parse(p.traits);
    } catch {}

    return {
      id: p.id,
      object: "customer",
      external_ids: p.externalId ? [p.externalId] : [],
      attributes: parsedAttrs,
      traits: parsedTraits,
      events_count: p.eventsCount,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    };
  });

  const responseData = {
    object: "list",
    data,
    has_more: hasMore,
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
