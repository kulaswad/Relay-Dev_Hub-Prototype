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
import { Send, MessageSquare, Smartphone, Zap } from "lucide-react";

export default function SendingMessagesGuidePage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            Core Guide
          </span>
          <span className="text-xs font-mono text-text-muted">Omnichannel Dispatch</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Sending Messages Across SMS, RCS & WhatsApp
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Relay unifies telecom SMS gateways, Google Jibe RCS, and Meta WhatsApp Business Cloud APIs into a single API endpoint with automated fallback, intelligent routing, and TRAI DLT validation.
        </p>
      </div>

      {/* Channel Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-border bg-surface space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text">
            <Smartphone className="w-4 h-4 text-accent" />
            <span>Telecom SMS</span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            100% reach on feature phones and smartphones across India. Governed by 6-character TRAI DLT headers.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text">
            <Zap className="w-4 h-4 text-[#5B9DFF]" />
            <span>Google RCS</span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Rich cards, carousel carousels, action chips, and verified brand ticks on modern Android devices with automated SMS fallback.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text">
            <MessageSquare className="w-4 h-4 text-[#3FB68B]" />
            <span>WhatsApp Business</span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            High-engagement 2-way conversations, rich media documents, quick replies, and read receipts (blue ticks).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 id="sms-example" className="text-lg font-bold text-text">
          1. Sending High-Throughput SMS
        </h2>
        <p className="text-xs text-text-muted">
          Pass <code className="text-accent font-mono">channel: "sms"</code> along with your DLT approved Content Template ID:
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
    "variables": {"1": "481029"},
    "sender_id": "ACMEPY"
  }'`,
            node: `await relay.messages.send({
  to: "+919999900001",
  channel: "sms",
  templateId: "dlt_tmpl_otp_login",
  variables: { "1": "481029" },
  senderId: "ACMEPY",
});`,
          }}
        />
      </div>

      <div className="space-y-4">
        <h2 id="whatsapp-example" className="text-lg font-bold text-text">
          2. Sending WhatsApp Business Messages
        </h2>
        <p className="text-xs text-text-muted">
          Pass <code className="text-[#3FB68B] font-mono">channel: "whatsapp"</code>. Relay automatically verifies that the recipient's CDP profile has <code className="font-mono text-text">consent.whatsapp_opt_in: true</code>:
        </p>

        <CodeBlock
          snippets={{
            curl: `curl -X POST https://api.relay.in/v1/messages \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+919999900001",
    "channel": "whatsapp",
    "template_id": "dlt_tmpl_order_update",
    "variables": {"1": "Priya", "2": "ORD-4491", "3": "Delhivery", "4": "track.acmepay.in/4491"}
  }'`,
            node: `await relay.messages.send({
  to: "+919999900001",
  channel: "whatsapp",
  templateId: "dlt_tmpl_order_update",
  variables: {
    "1": "Priya",
    "2": "ORD-4491",
    "3": "Delhivery",
    "4": "track.acmepay.in/4491"
  },
});`,
          }}
        />
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Your First Message", href: "/docs/first-message" }}
        next={{ title: "Templates & DLT Headers", href: "/docs/guides/templates-dlt" }}
      />
    </div>
  );
}
