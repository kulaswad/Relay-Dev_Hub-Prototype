import { NextRequest, NextResponse } from "next/server";
import { createAnonymousEvaluationWorkspace } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const sessionContext = await createAnonymousEvaluationWorkspace();

    return NextResponse.json({
      success: true,
      isAnonymous: true,
      workspace: sessionContext.workspace,
      organization: sessionContext.organization,
      message: "Anonymous evaluation workspace created (valid for 24 hours).",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create evaluation workspace" },
      { status: 500 }
    );
  }
}
