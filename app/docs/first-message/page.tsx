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
import { Send, CheckCircle2, Terminal, ArrowRight, Play } from "lucide-react";

export default function FirstMessageDocPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            Tutorial
          </span>
          <span className="text-xs font-mono text-text-muted">Under 5 Minutes</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Sending Your First Message
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Step-by-step walkthrough to dispatch your first transactional OTP SMS using the Relay Sandbox API.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-text">
            <span className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center text-xs font-mono">
              1
            </span>
            <span>Obtain Your Test API Key</span>
          </div>
          <p className="text-xs text-text-muted">
            Navigate to the <Link href="/console/keys" className="text-accent hover:underline">API Keys</Link> page in the Relay Console. Copy your active sandbox key (<code className="text-accent font-mono">rl_test_...</code>).
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-text">
            <span className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center text-xs font-mono">
              2
            </span>
            <span>Send the HTTP Request</span>
          </div>
          <p className="text-xs text-text-muted">
            Send a POST request to <code className="text-accent font-mono">https://api.relay.in/v1/messages</code> with the pre-approved template <code className="font-mono text-text">dlt_tmpl_otp_login</code> and the magic test number <code className="text-[#3FB68B] font-mono">+919999900001</code>:
          </p>

          <CodeBlock
            snippets={{
              curl: `curl -X POST https://api.relay.in/v1/messages \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+919999900001",
    "channel": "sms",
    "template_id": "dlt_tmpl_otp_login",
    "variables": {"1": "592014"}
  }'`,
              node: `const res = await fetch("https://api.relay.in/v1/messages", {
  method: "POST",
  headers: {
    "Authorization": "Bearer rl_test_demo_acmepay_key_01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: "+919999900001",
    channel: "sms",
    template_id: "dlt_tmpl_otp_login",
    variables: { "1": "592014" },
  }),
});
const data = await res.json();
console.log("Message queued:", data.id);`,
              python: `import requests
res = requests.post(
    "https://api.relay.in/v1/messages",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"},
    json={
        "to": "+919999900001",
        "channel": "sms",
        "template_id": "dlt_tmpl_otp_login",
        "variables": {"1": "592014"},
    }
)
print(res.json())`,
            }}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-text">
            <span className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center text-xs font-mono">
              3
            </span>
            <span>Observe the Carrier Lifecycle</span>
          </div>
          <p className="text-xs text-text-muted">
            The API returns an initial HTTP 202 Accepted status with <code className="font-mono text-accent">"status": "queued"</code>. Over the next 3 seconds, the background simulator advances the message to <code className="text-text font-mono">sent</code> and finally <code className="text-[#3FB68B] font-mono">delivered</code>.
          </p>
          <div className="p-4 rounded-xl bg-surface border border-border space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>Expected Response (HTTP 202)</span>
              <span className="text-[#3FB68B]">Accepted</span>
            </div>
            <pre className="text-accent overflow-x-auto">
{`{
  "id": "msg_01JB9X7V2T4KZQ8M",
  "object": "message",
  "status": "queued",
  "channel": "sms",
  "to": "+9199•••••01",
  "sender_id": "RELAYI",
  "template_id": "dlt_tmpl_otp_login",
  "cost": {
    "estimated": 0.12,
    "currency": "INR",
    "charged": 0
  },
  "created_at": "2026-10-30T02:00:00.000Z"
}`}
            </pre>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-surface-2 border border-border flex items-center justify-between text-xs">
        <span className="text-text font-medium">Want to test interactively without code?</span>
        <Link
          href="/console/playground"
          className="px-3 py-1.5 rounded-lg bg-accent text-white font-semibold flex items-center gap-1.5 hover:bg-accent/90 transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Open API Playground</span>
        </Link>
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Authentication & Keys", href: "/docs/authentication" }}
        next={{ title: "Omnichannel Messaging (SMS/RCS/WA)", href: "/docs/guides/sending-messages" }}
      />
    </div>
  );
}
