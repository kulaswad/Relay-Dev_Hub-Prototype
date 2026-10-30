import { NextRequest, NextResponse } from "next/server";
import { authenticateDeveloper } from "@/lib/auth/session";
import { z } from "zod";

const SignInSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = SignInSchema.parse(body);

    const sessionContext = await authenticateDeveloper(
      validated.email,
      validated.password
    );

    return NextResponse.json({
      success: true,
      user: {
        id: sessionContext.user?.id,
        name: sessionContext.user?.name,
        email: sessionContext.user?.email,
        company: sessionContext.user?.company,
        role: sessionContext.user?.role,
      },
      workspace: sessionContext.workspace,
      organization: sessionContext.organization,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Authentication failed" },
      { status: 401 }
    );
  }
}
