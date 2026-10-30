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
import { Activity, Layers, ArrowRight } from "lucide-react";

export default function IngestingEventsGuidePage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            CDP Guide
          </span>
          <span className="text-xs font-mono text-text-muted">Event Streaming</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Ingesting Events & Building Customer Profiles
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Relay CDP ingests real-time user actions from web, mobile apps, payment gateways, and backend services to construct a unified 360-degree customer profile identity graph.
        </p>
      </div>

      <div className="space-y-3">
        <h2 id="streaming-events" className="text-lg font-bold text-text">
          1. Streaming Events via POST /api/v1/events
        </h2>
        <p className="text-xs text-text-muted">
          Events can be dispatched asynchronously using <code className="text-accent font-mono">external_id</code> (your app's internal user ID) or <code className="text-accent font-mono">customer_id</code> (Relay's <code className="font-mono">prf_...</code> ID):
        </p>

        <CodeBlock
          snippets={{
            curl: `curl -X POST https://api.relay.in/v1/events \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "external_id": "cust_acme_7710",
    "event": "checkout_completed",
    "properties": {
      "order_id": "ord_9921",
      "amount": 2999,
      "payment_method": "upi",
      "currency": "INR"
    },
    "timestamp": 1793310000
  }'`,
            node: `await fetch("https://api.relay.in/v1/events", {
  method: "POST",
  headers: {
    "Authorization": "Bearer rl_test_demo_acmepay_key_01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    external_id: "cust_acme_7710",
    event: "checkout_completed",
    properties: { amount: 2999, payment_method: "upi" },
  }),
});`,
          }}
        />
      </div>

      <div className="space-y-3">
        <h2 id="identity-stitching" className="text-lg font-bold text-text">
          2. Automated Identity Graph Merging
        </h2>
        <p className="text-xs text-text-muted leading-relaxed">
          When an event arrives with an <code className="text-accent font-mono">external_id</code>, Relay checks if an existing profile exists. If found, the event is appended to the customer's timeline and aggregated traits (<code className="font-mono text-text">total_events</code>, <code className="font-mono text-text">last_seen</code>) are updated automatically.
        </p>
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Templates & DLT Headers", href: "/docs/guides/templates-dlt" }}
        next={{ title: "Reading Customer Profiles", href: "/docs/guides/reading-profiles" }}
      />
    </div>
  );
}
