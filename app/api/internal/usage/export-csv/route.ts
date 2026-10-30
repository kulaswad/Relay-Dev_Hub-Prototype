import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiRequests } from "@/lib/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "24h";
    const environment = (searchParams.get("environment") || "test").toLowerCase() as "test" | "live";

    const nowEpoch = Math.floor(Date.now() / 1000);
    let secondsWindow = 86400;
    if (range === "1h") secondsWindow = 3600;
    else if (range === "7d") secondsWindow = 7 * 86400;
    else if (range === "30d") secondsWindow = 30 * 86400;

    const startEpoch = nowEpoch - secondsWindow;

    const rows = await db
      .select()
      .from(apiRequests)
      .where(
        and(
          eq(apiRequests.workspaceId, wsId),
          eq(apiRequests.environment, environment),
          gte(apiRequests.createdAt, new Date(startEpoch * 1000))
        )
      )
      .orderBy(desc(apiRequests.createdAt));

    // Escape CSV values
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "Request ID",
      "Timestamp (UTC)",
      "Method",
      "Path",
      "Status",
      "Duration (ms)",
      "Key ID",
      "Error Code",
      "IP Address",
      "API Version",
      "Billed Would Be (INR)",
      "Billed Actual (INR)",
    ];

    const csvLines = [headers.join(",")];

    for (const r of rows) {
      csvLines.push(
        [
          escapeCsv(r.requestId),
          escapeCsv(new Date(r.createdAt).toISOString()),
          escapeCsv(r.method),
          escapeCsv(r.path),
          escapeCsv(r.status),
          escapeCsv(r.durationMs),
          escapeCsv(r.keyId || "unauthenticated"),
          escapeCsv(r.errorCode || ""),
          escapeCsv(r.ip),
          escapeCsv(r.apiVersion),
          escapeCsv(r.billedAmountWouldBe || 0),
          escapeCsv(r.billedAmountActual || 0),
        ].join(",")
      );
    }

    const csvData = csvLines.join("\n");
    const filename = `relay_usage_${environment}_${range}_${Date.now()}.csv`;

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
