import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const seedScript = path.resolve(process.cwd(), "lib/db/seed.ts");
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    execSync(`${npxCmd} tsx "${seedScript}"`, {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: "pipe",
      timeout: 30000,
    });

    return NextResponse.json({
      success: true,
      message: "Database and demo state successfully reset to initial pristine seed.",
    });
  } catch (error: any) {
    console.error("Failed to reset demo database:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset demo database" },
      { status: 500 }
    );
  }
}
