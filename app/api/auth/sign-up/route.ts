import { NextRequest, NextResponse } from "next/server";
import { registerDeveloper } from "@/lib/auth/session";
import { z } from "zod";

const SignUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid work email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  company: z.string().min(2, "Company name is required"),
  role: z.enum(["Backend dev", "Mobile dev", "Data/CDP", "Other"]).default("Backend dev"),
  intent: z.enum(["Evaluating Relay", "Already a Relay customer"]).default("Evaluating Relay"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = SignUpSchema.parse(body);

    const sessionContext = await registerDeveloper(validated);

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
      { success: false, error: error.message || "Failed to sign up" },
      { status: 400 }
    );
  }
}
