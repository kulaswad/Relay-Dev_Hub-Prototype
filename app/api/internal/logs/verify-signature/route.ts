import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

const VerifySchema = z.object({
  payload: z.string(),
  signatureHeader: z.string(),
  secret: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payload, signatureHeader, secret } = VerifySchema.parse(body);

    const trimmedSecret = secret.trim();
    const trimmedHeader = signatureHeader.trim();

    // 1. Extract t=... and all v1=... values
    const tMatch = trimmedHeader.match(/t=(\d+)/);
    if (!tMatch) {
      return NextResponse.json({
        isValid: false,
        verdict: "INVALID_HEADER_FORMAT",
        message: "Missing 't={timestamp}' in Relay-Signature header.",
        hint: "Expected format: t=1793300000,v1=41496b...",
      });
    }

    const timestamp = parseInt(tMatch[1], 10);
    const nowEpoch = Math.floor(Date.now() / 1000);
    const driftSeconds = Math.abs(nowEpoch - timestamp);

    // Extract all v1 signatures in header
    const v1Matches = Array.from(trimmedHeader.matchAll(/v1=([a-f0-9]{64})/g)).map(
      (m) => m[1]
    );

    if (v1Matches.length === 0) {
      return NextResponse.json({
        isValid: false,
        verdict: "MISSING_V1_HASH",
        message: "No valid 64-character SHA-256 hex string found in v1 parameter.",
        hint: "Ensure v1 contains the 64-hex lowercase HMAC-SHA256 digest.",
      });
    }

    // 2. Compute canonical HMAC against raw payload: "{t}.{payload}"
    const expectedRaw = crypto
      .createHmac("sha256", trimmedSecret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    // Check if any provided v1 matches the canonical calculation
    const isDirectMatch = v1Matches.some((v1) => {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(v1, "hex"),
          Buffer.from(expectedRaw, "hex")
        );
      } catch {
        return false;
      }
    });

    if (isDirectMatch) {
      return NextResponse.json({
        isValid: true,
        verdict: "VALID_MATCH",
        timestamp,
        driftSeconds,
        timestampStatus: driftSeconds <= 300 ? "within_tolerance" : "warning_drift_exceeded",
        computedSignature: expectedRaw,
        receivedSignatures: v1Matches,
        message:
          driftSeconds <= 300
            ? "✓ Signature verified successfully! The raw payload and secret match the Relay-Signature header."
            : "⚠️ Signature hash is mathematically valid, but timestamp drift is > 300s. In production, reject to prevent replay attacks.",
      });
    }

    // 3. Diagnostic Heuristics for Developer Pitfalls
    let diagnosticHint = "Calculated HMAC does not match the received v1 signature header.";

    try {
      // Diagnostic check 1: Did they serialize JSON with spaces?
      const parsed = JSON.parse(payload);
      const spacedJson = JSON.stringify(parsed, null, 2);
      const hashSpaced = crypto
        .createHmac("sha256", trimmedSecret)
        .update(`${timestamp}.${spacedJson}`)
        .digest("hex");

      if (v1Matches.includes(hashSpaced)) {
        diagnosticHint =
          "Root Cause Identified: Your signature matches the JSON re-serialized with indentation/spaces! In your webhook handler, you must verify against the untouched raw request body bytes before parsing JSON.";
      }

      // Diagnostic check 2: Did they serialize compact JSON?
      const compactJson = JSON.stringify(parsed);
      const hashCompact = crypto
        .createHmac("sha256", trimmedSecret)
        .update(`${timestamp}.${compactJson}`)
        .digest("hex");

      if (v1Matches.includes(hashCompact) && compactJson !== payload) {
        diagnosticHint =
          "Root Cause Identified: Your signature matches parsed-and-re-serialized JSON! Verify HMAC directly over req.rawBody or express.raw().";
      }

      // Diagnostic check 3: Did they forget the '{t}.' prefix?
      const hashNoTimestamp = crypto
        .createHmac("sha256", trimmedSecret)
        .update(payload)
        .digest("hex");

      if (v1Matches.includes(hashNoTimestamp)) {
        diagnosticHint =
          "Root Cause Identified: You calculated HMAC over payload only! Relay signs '${timestamp}.${rawBody}'. Prepend the timestamp from the header.";
      }
    } catch {
      // Non-JSON payload
    }

    return NextResponse.json({
      isValid: false,
      verdict: "SIGNATURE_MISMATCH",
      timestamp,
      driftSeconds,
      computedSignature: expectedRaw,
      receivedSignatures: v1Matches,
      hint: diagnosticHint,
      message: "Signature verification failed.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
