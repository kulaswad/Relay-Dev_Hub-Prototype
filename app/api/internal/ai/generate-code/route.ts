import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { executeStructuredAI } from "@/lib/ai/client";
import { API_SPECIFICATION } from "@/lib/docs/api-spec";
import { z } from "zod";

export const dynamic = "force-dynamic";

const GenerateCodeRequestSchema = z.object({
  useCase: z.string().min(3).optional(),
  prompt: z.string().min(3).optional(),
  language: z.enum(["curl", "node", "python", "php", "go"]).default("node"),
  action: z.enum(["generate", "fix"]).default("generate"),
  previousCode: z.string().optional(),
  validationIssues: z.array(z.string()).optional(),
});

const GeneratedCodeSchema = z.object({
  code: z.string(),
  explanation: z.string(),
  endpointsUsed: z.array(z.string()),
  channelsUsed: z.array(z.string()),
  includesIdempotencyKey: z.boolean(),
  includesBackoff: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wsId = session?.workspace.id || "ws_acmepay_prod";

    const body = await req.json();
    const validated = GenerateCodeRequestSchema.parse(body);
    const useCase = validated.useCase || validated.prompt || "Send OTP message";
    const { language, action, previousCode, validationIssues } = validated;

    // Fetch workspace test key for reference
    const [testKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.workspaceId, wsId), eq(apiKeys.environment, "test")))
      .limit(1);

    // Summary of real endpoints from api-spec for context
    const specSummary = API_SPECIFICATION.map(
      (e) => `${e.method} ${e.path} (Summary: ${e.summary}, Scopes: ${e.requiredScopes.join(", ")})`
    ).join("\n");

    // Fallback Code Generator (grounded in real api-spec)
    const fallbackFn = () => {
      const lower = useCase.toLowerCase();
      let code = "";
      let explanation = "";
      const endpointsUsed: string[] = [];
      const channelsUsed: string[] = [];

      if (lower.includes("whatsapp") || lower.includes("wa")) channelsUsed.push("whatsapp");
      if (lower.includes("sms") || lower.includes("otp")) channelsUsed.push("sms");
      if (lower.includes("rcs")) channelsUsed.push("rcs");
      if (channelsUsed.length === 0) channelsUsed.push("sms");

      const channel = channelsUsed[0];
      endpointsUsed.push("POST /v1/messages");
      if (lower.includes("profile") || lower.includes("event") || lower.includes("customer")) {
        endpointsUsed.push("POST /v1/events");
      }

      if (language === "node") {
        code = `// Relay Integration: ${useCase}
// AI-generated, review before using in production
const crypto = require("crypto");

const RELAY_API_KEY = process.env.RELAY_API_KEY;
if (!RELAY_API_KEY) {
  throw new Error("Missing RELAY_API_KEY environment variable");
}

const RELAY_BASE_URL = "https://api.relay.internal/v1";

async function sendWithExponentialBackoff(endpoint, payload, maxRetries = 3) {
  const idempotencyKey = \`idem_\${crypto.randomUUID()}\`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(\`\${RELAY_BASE_URL}\${endpoint}\`, {
        method: "POST",
        headers: {
          "Authorization": \`Bearer \${RELAY_API_KEY}\`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "Relay-Version": "2025-10-01",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "1", 10);
        const jitter = Math.floor(Math.random() * 200);
        const delayMs = (retryAfter * 1000) + jitter;
        console.warn(\`[Relay Rate Limit] Backing off for \${delayMs}ms (Attempt \${attempt + 1})\`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || \`HTTP \${response.status}\`);
      }

      return await response.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

async function run() {
  // 1. Send outbound message
  const messageResult = await sendWithExponentialBackoff("/messages", {
    channel: "${channel}",
    to: "+919876543210",
    template_id: "${channel === "sms" ? "dlt_tmpl_otp_login" : "dlt_tmpl_order_update"}",
    variables: { code: "481902", order_id: "ORD-9821" },
  });
  console.log("Message queued:", messageResult.id);

  ${
    endpointsUsed.includes("POST /v1/events")
      ? `// 2. Stream customer CDP event
  const eventResult = await sendWithExponentialBackoff("/events", {
    customer_id: "prf_acme_customer_01",
    event_name: "order.placed",
    properties: {
      order_id: "ORD-9821",
      amount_inr: 1499.0,
      channel: "${channel}",
    },
  });
  console.log("CDP Event recorded:", eventResult.id);`
      : ""
  }
}

run().catch(console.error);`;
        explanation = `Generates a modular Node.js workflow using standard fetch. Includes UUIDv4 idempotency key, automatic Retry-After exponential backoff with jitter on 429s, and environment-variable key loading.`;
      } else if (language === "python") {
        code = `# Relay Integration: ${useCase}
# AI-generated, review before using in production
import os
import time
import uuid
import random
import requests

RELAY_API_KEY = os.environ.get("RELAY_API_KEY")
if not RELAY_API_KEY:
    raise ValueError("Missing RELAY_API_KEY environment variable")

RELAY_BASE_URL = "https://api.relay.internal/v1"

def call_relay_with_backoff(endpoint, payload, max_retries=3):
    url = f"{RELAY_BASE_URL}{endpoint}"
    idempotency_key = f"idem_{uuid.uuid4()}"
    headers = {
        "Authorization": f"Bearer {RELAY_API_KEY}",
        "Content-Type": "application/json",
        "Idempotency-Key": idempotency_key,
        "Relay-Version": "2025-10-01",
    }

    for attempt in range(max_retries + 1):
        resp = requests.post(url, headers=headers, json=payload)
        if resp.status_code == 429 and attempt < max_retries:
            retry_after = int(resp.headers.get("Retry-After", 1))
            delay = retry_after + random.uniform(0.1, 0.3)
            print(f"[Relay 429] Rate limit hit. Sleeping {delay:.2f}s...")
            time.sleep(delay)
            continue
        resp.raise_for_status()
        return resp.json()

# Execute integration
message = call_relay_with_backoff("/messages", {
    "channel": "${channel}",
    "to": "+919876543210",
    "template_id": "${channel === "sms" ? "dlt_tmpl_otp_login" : "dlt_tmpl_order_update"}",
    "variables": {"code": "481902", "order_id": "ORD-9821"}
})
print(f"Message Dispatched: {message.get('id')}")

${
  endpointsUsed.includes("POST /v1/events")
    ? `# Stream customer CDP event
event = call_relay_with_backoff("/events", {
    "customer_id": "prf_acme_customer_01",
    "event": "order.placed",
    "properties": {
        "order_id": "ORD-9821",
        "amount_inr": 1499.0,
        "channel": "${channel}"
    }
})
print(f"CDP Event Recorded: {event.get('total')}")`
    : ""
}`;
        explanation = `Python 3 script utilizing the requests library. Implements idempotency key generation, automatic exponential backoff on HTTP 429, and clean error raising.`;
      } else {
        // cURL
        code = `#!/bin/bash
# Relay Integration: ${useCase}
# AI-generated, review before using in production

if [ -z "$RELAY_API_KEY" ]; then
  echo "Error: RELAY_API_KEY environment variable is required"
  exit 1
fi

IDEM_KEY="idem_$(date +%s)_$RANDOM"

curl -s -X POST "https://api.relay.internal/v1/messages" \\
  -H "Authorization: Bearer $RELAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $IDEM_KEY" \\
  -H "Relay-Version: 2025-10-01" \\
  --retry 3 \\
  --retry-delay 1 \\
  --retry-max-time 15 \\
  -d '{
    "channel": "${channel}",
    "to": "+919876543210",
    "template_id": "dlt_tmpl_otp_login",
    "variables": { "code": "481902" }
  }'`;
        explanation = `Production-grade cURL script featuring retry parameters for network blips, unique idempotency headers, and environment token protection.`;
      }

      return {
        code,
        explanation,
        endpointsUsed,
        channelsUsed,
        includesIdempotencyKey: true,
        includesBackoff: true,
      };
    };

    const systemPrompt = `You are Relay's Senior Developer Experience Engineer.
Write production-grade integration code for the developer's requested use case.

MANDATORY RULES:
1. Ground your solution STRICTLY in Relay's API Specification:
${specSummary}
2. Always generate code in the requested language: ${language}.
3. ALWAYS include an Idempotency-Key header using a UUID/timestamp format.
4. ALWAYS implement robust error handling and exponential backoff checking for HTTP 429 with Retry-After header.
5. NEVER embed raw API keys in the code! Always read from environment variables (e.g. process.env.RELAY_API_KEY, os.environ.get("RELAY_API_KEY")).
6. Add the comment header: "// AI-generated, review before using in production" (or '#' for Python/bash).
7. Validate body parameters against the schema:
   - For POST /v1/messages: requires "channel" ('sms'|'rcs'|'whatsapp'), "to" (+91... E.164), and "template_id".
   - For POST /v1/events: requires "event_name" and optional "customer_id", "properties".
8. Return JSON matching the schema.`;

    let prompt = `Developer Request: "${useCase}"\nTarget Language: ${language}`;
    if (action === "fix" && previousCode && validationIssues) {
      prompt = `Developer Request: "${useCase}"\nTarget Language: ${language}
PREVIOUS CODE HAD STATIC VALIDATION ERRORS:
${validationIssues.join("\n")}

Please fix the code so it strictly satisfies Relay's API Specification and resolves all issues.`;
    }

    const aiResult = await executeStructuredAI({
      feature: "generate_code",
      userId: session?.user?.id || "usr_acmepay_demo",
      workspaceId: wsId,
      systemPrompt,
      prompt,
      schema: GeneratedCodeSchema,
      fallbackFn,
      inputsForHashAndSummary: { useCase, language, action },
    });

    // Static Validation Check of the generated code
    const generatedCode = aiResult.data.code;
    const issues: string[] = [];

    // Check 1: Live key leakage check
    if (generatedCode.includes("rk_live_") || generatedCode.includes("rl_live_")) {
      issues.push("Security violation: Hardcoded live API key found in code snippet. Must use environment variables.");
    }

    // Check 2: Idempotency Key presence
    if (!generatedCode.toLowerCase().includes("idempotency-key") && !generatedCode.toLowerCase().includes("idempotencykey")) {
      issues.push("Missing required 'Idempotency-Key' header for safe replay.");
    }

    // Check 3: Backoff / 429 handling
    if (!generatedCode.includes("429") && !generatedCode.includes("Retry-After") && !generatedCode.includes("--retry")) {
      issues.push("Missing HTTP 429 rate limit backoff logic.");
    }

    // Check 4: Check endpoint paths
    const validPaths = new Set([
      ...API_SPECIFICATION.map((e) => e.path),
      ...API_SPECIFICATION.map((e) => e.path.replace(/^\/api/, "")),
    ]);
    for (const ep of aiResult.data.endpointsUsed) {
      const parts = ep.split(" ");
      const p = parts.length > 1 ? parts[1] : parts[0];
      const normalizedPath = p?.replace(/\/msg_[^/\s]+/, "/:id") || "";
      if (p && !validPaths.has(p) && !validPaths.has(normalizedPath)) {
        issues.push(`Unknown or hallucinated endpoint: '${p}' does not exist in Relay v2025-10-01 API.`);
      }
    }

    const isValid = issues.length === 0;

    // Determine target execution endpoint and payload for sandbox runner
    const lowerUseCase = useCase.toLowerCase();
    let method = "POST";
    let path = "/v1/messages";
    let extractedPayload: any = {
      channel: aiResult.data.channelsUsed[0] || "sms",
      to: "+919999900001",
      template_id: "dlt_tmpl_otp_login",
      variables: { code: "481092" },
    };

    if (lowerUseCase.includes("event") || lowerUseCase.includes("purchase") || lowerUseCase.includes("cart")) {
      path = "/v1/events";
      extractedPayload = {
        event: "order_completed",
        customer_id: "cust_acmepay_7710",
        properties: { amount: 2499, currency: "INR" },
      };
    } else if (lowerUseCase.includes("read") || lowerUseCase.includes("profile") || lowerUseCase.includes("customer")) {
      method = "GET";
      path = "/v1/customers/cust_acmepay_7710";
      extractedPayload = null;
    }

    return NextResponse.json({
      code: generatedCode,
      explanation: aiResult.data.explanation,
      endpointsUsed: aiResult.data.endpointsUsed,
      channelsUsed: aiResult.data.channelsUsed,
      language,
      method,
      path,
      extractedPayload,
      validation: {
        isValid,
        issues,
      },
      isFallback: aiResult.isFallback,
      fallbackReason: aiResult.fallbackReason,
      model: aiResult.model,
      runId: aiResult.runId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
