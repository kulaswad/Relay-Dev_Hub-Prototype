import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      // Return demo workspace if unauthenticated to enable instant evaluation
      const [demoWs] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, "ws_acmepay_prod"))
        .limit(1);

      return NextResponse.json({
        authenticated: false,
        workspace: demoWs || null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      session: session.session,
      user: session.user,
      workspace: session.workspace,
      organization: session.organization,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
