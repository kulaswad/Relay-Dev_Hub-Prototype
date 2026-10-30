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
import { Layers, UserCheck, ShieldCheck } from "lucide-react";

export default function ReadingProfilesGuidePage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            CDP Guide
          </span>
          <span className="text-xs font-mono text-text-muted">360° Identity Graph</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Reading & Querying Customer Profiles
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Access unified customer records containing calculated behavioral traits, channel consent preferences, contact details, and cross-channel event timelines.
        </p>
      </div>

      <div className="space-y-3">
        <h2 id="lookup-by-external-id" className="text-lg font-bold text-text">
          Lookup by External ID (ext_...)
        </h2>
        <p className="text-xs text-text-muted">
          You don't need to store Relay's internal <code className="font-mono text-text">prf_...</code> IDs. You can query directly using your app's own user ID by prefixing the path with <code className="text-accent font-mono font-bold">ext_</code>:
        </p>

        <CodeBlock
          snippets={{
            curl: `curl -X GET https://api.relay.in/v1/customers/ext_cust_acmepay_7710 \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01"`,
            node: `const res = await fetch("https://api.relay.in/v1/customers/ext_cust_acmepay_7710", {
  headers: { "Authorization": "Bearer rl_test_demo_acmepay_key_01" },
});
const profile = await res.json();
console.log(profile.attributes.name);
console.log(profile.traits.preferred_channel); // 'whatsapp'`,
          }}
        />
      </div>

      <div className="space-y-3">
        <h2 id="profile-structure" className="text-lg font-bold text-text">
          Unified Profile Schema Anatomy
        </h2>
        <p className="text-xs text-text-muted">
          Every profile returned by GET /api/v1/customers/:id follows this structure:
        </p>
        <div className="p-4 rounded-xl bg-surface border border-border font-mono text-xs text-accent overflow-x-auto">
{`{
  "id": "prf_acme_9921",
  "external_ids": ["cust_acmepay_7710"],
  "attributes": {
    "name": "Rahul Verma",
    "phone": "+919876543210",
    "email": "rahul@example.com"
  },
  "traits": {
    "total_events": 14,
    "last_seen": "2026-10-30T01:15:00.000Z",
    "preferred_channel": "whatsapp",
    "kyc_verified": true
  },
  "consent": {
    "sms_opt_in": true,
    "whatsapp_opt_in": true
  }
}`}
        </div>
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Ingesting Events & Profiles", href: "/docs/guides/ingesting-events" }}
        next={{ title: "Handling Delivery Status (DLR)", href: "/docs/guides/delivery-status" }}
      />
    </div>
  );
}
