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
import { FileCode, Radio, Clock, CheckCircle2 } from "lucide-react";

export default function DeliveryStatusGuidePage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            Telemetry Guide
          </span>
          <span className="text-xs font-mono text-text-muted">Carrier Receipts</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Handling Delivery Status (DLR)
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Understanding mobile telecom delivery reports, radio tower acknowledgments, carrier circle routing, and error diagnostics across Indian cellular operators.
        </p>
      </div>

      <div className="space-y-3">
        <h2 id="lifecycle-states" className="text-lg font-bold text-text">
          Message Lifecycle Progression
        </h2>
        <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-accent font-bold">1. queued</span>
            <span className="text-text-muted">Validated by DLT engine, placed in cellular queue</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#5B9DFF] font-bold">2. sent</span>
            <span className="text-text-muted">Accepted by Airtel/Jio/Vi telecom core network</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#3FB68B] font-bold">3. delivered</span>
            <span className="text-text-muted">Handset returns cryptographic radio acknowledgment</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#E5534B] font-bold">4. failed</span>
            <span className="text-text-muted">DND active, handset off, or out of cellular coverage</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 id="querying-dlr" className="text-lg font-bold text-text">
          Querying DLR Reports via API
        </h2>
        <p className="text-xs text-text-muted">
          Inspect telecom cellular circle, operator DLR code, and delivery timestamp:
        </p>

        <CodeBlock
          snippets={{
            curl: `curl -X GET https://api.relay.in/v1/delivery-status/msg_01JB9X7V2T4KZQ8M \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01"`,
            node: `const res = await fetch("https://api.relay.in/v1/delivery-status/msg_01JB9X7V2T4KZQ8M", {
  headers: { "Authorization": "Bearer rl_test_demo_acmepay_key_01" },
});
const dlr = await res.json();
console.log(dlr.carrier, dlr.circle, dlr.dlr_code);`,
          }}
        />
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Reading Customer Profiles", href: "/docs/guides/reading-profiles" }}
        next={{ title: "Webhooks Architecture", href: "/docs/webhooks" }}
      />
    </div>
  );
}
