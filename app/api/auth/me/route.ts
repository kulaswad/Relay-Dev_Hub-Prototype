import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const sessionContext = await getSession();

    if (!sessionContext) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        workspace: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      isAnonymous: sessionContext.session.isAnonymous,
      user: sessionContext.user
        ? {
            id: sessionContext.user.id,
            name: sessionContext.user.name,
            email: sessionContext.user.email,
            company: sessionContext.user.company,
            role: sessionContext.user.role,
          }
        : null,
      workspace: sessionContext.workspace,
      organization: sessionContext.organization,
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}
