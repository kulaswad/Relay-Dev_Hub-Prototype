"use client";

import React from "react";
import Link from "next/link";
import {
  CodeBlock,
  Callout,
  DocVersionBanner,
  DocFeedback,
  DocMeta,
  DocPaginationNav,
} from "@/components/devhub";
import { Repeat, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function IdempotencyGuidePage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            Reliability Guide
          </span>
          <span className="text-xs font-mono text-text-muted">Safe Network Retries</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Idempotency & Replay Protection
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          The Relay API supports idempotency keys to guarantee that network timeouts, client reconnects, and retries never result in duplicate message dispatches or multiple charges.
        </p>
      </div>

      <div className="space-y-3">
        <h2 id="how-it-works" className="text-lg font-bold text-text">
          How Idempotency Keys Work
        </h2>
        <p className="text-xs text-text-muted leading-relaxed">
          Attach the <code className="text-accent font-mono font-bold">Idempotency-Key: &lt;uuid&gt;</code> header to any <code className="font-mono text-text">POST</code> request. Relay records the key and the exact HTTP response in a dedicated cache:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-xs text-text-muted pl-1">
          <li><strong>First Request:</strong> The request processes normally, charges the wallet (in live mode), saves the message, and caches the response.</li>
          <li><strong>Subsequent Requests (within 24 hours):</strong> If a request arrives with the same idempotency key and identical payload, Relay immediately returns the cached response with zero duplicate message creation and zero duplicate wallet deductions.</li>
          <li><strong>Conflicting Payload:</strong> If the same key is reused with a different request payload, the gateway returns <code className="text-[#E5534B] font-mono">409 idempotency_conflict</code>.</li>
        </ul>
      </div>

      <div className="space-y-3">
        <h2 id="code-sample" className="text-lg font-bold text-text">
          Generating UUID v4 Idempotency Keys
        </h2>
        <CodeBlock
          snippets={{
            curl: `curl -X POST https://api.relay.in/v1/messages \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: b7f39446-5f21-4d3b-9e81-79b9409ce810" \\
  -d '{
    "to": "+919999900001",
    "channel": "sms",
    "template_id": "dlt_tmpl_otp_login",
    "variables": {"1": "392819"}
  }'`,
            node: `import crypto from "crypto";

const idempotencyKey = crypto.randomUUID();

const res = await fetch("https://api.relay.in/v1/messages", {
  method: "POST",
  headers: {
    "Authorization": "Bearer rl_test_demo_acmepay_key_01",
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  },
  body: JSON.stringify({
    to: "+919999900001",
    channel: "sms",
    template_id: "dlt_tmpl_otp_login",
    variables: { "1": "392819" },
  }),
});`,
          }}
        />
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Webhooks Architecture", href: "/docs/webhooks" }}
        next={{ title: "Pagination & Cursors", href: "/docs/guides/pagination" }}
      />
    </div>
  );
}
