import { NextRequest, NextResponse } from "next/server";
import { logoutDeveloper } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    await logoutDeveloper();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to log out" },
      { status: 500 }
    );
  }
}
