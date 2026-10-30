import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { solutionsInquiries } from "@/lib/db/schema";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, company, monthlyVolume, channels, useCase } = body;

    if (!name || !email || !company || !monthlyVolume) {
      return NextResponse.json(
        { error: "Name, email, company, and monthly volume are required." },
        { status: 400 }
      );
    }

    const inquiryId = `inq_${crypto.randomBytes(8).toString("hex")}`;
    const now = new Date();

    await db.insert(solutionsInquiries).values({
      id: inquiryId,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      company: String(company).trim(),
      monthlyVolume: String(monthlyVolume),
      channels: Array.isArray(channels) ? JSON.stringify(channels) : channels ? JSON.stringify([channels]) : "[]",
      useCase: useCase ? String(useCase).trim() : null,
      status: "new",
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      inquiryId,
      message: "Thank you! A solutions engineer from our Bengaluru engineering team will reach out within 2 hours.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to submit inquiry" },
      { status: 500 }
    );
  }
}
