import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import { API_VERSIONS } from "@/lib/sandbox/version";

export async function GET() {
  try {
    // Probe database
    sqlite.prepare("SELECT 1").get();

    return NextResponse.json(
      {
        status: "healthy",
        version: API_VERSIONS.CURRENT,
        timestamp: new Date().toISOString(),
        database: "connected",
        gateway: "relay-telecom-v1",
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "degraded",
        version: API_VERSIONS.CURRENT,
        timestamp: new Date().toISOString(),
        database: "error",
        error: error.message,
      },
      { status: 503 }
    );
  }
}
