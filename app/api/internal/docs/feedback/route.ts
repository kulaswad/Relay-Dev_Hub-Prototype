import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { docFeedback } from "@/lib/db/schema";
import { z } from "zod";
import crypto from "crypto";

const FeedbackSchema = z.object({
  pagePath: z.string().min(1),
  helpful: z.boolean(),
  comment: z.string().optional(),
  version: z.string().default("v2025-10-01"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = FeedbackSchema.parse(body);

    const feedbackId = `fb_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;

    await db.insert(docFeedback).values({
      id: feedbackId,
      pagePath: validated.pagePath,
      helpful: validated.helpful,
      comment: validated.comment || null,
      version: validated.version,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      id: feedbackId,
      message: "Thank you for helping us improve the Relay documentation!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
