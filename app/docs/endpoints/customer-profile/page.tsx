"use client";

import React from "react";
import {
  EndpointHeader,
  ParamTable,
  ResponseTabs,
  CodeBlock,
  JsonViewer,
} from "@/components/devhub";

export default function CustomerProfileDocPage() {
  const params = [
    {
      name: "id",
      type: "string",
      required: true,
      description: "Profile ID or external customer ID to query.",
      example: "cust_77210",
    },
  ];

  const snippets = {
    curl: `curl -X GET https://api.relay.internal/v1/profiles/cust_77210 \\
  -H "Authorization: Bearer rk_test_9fa1b2e84c3"`,
    node: `const profile = await relay.profiles.get("cust_77210");
console.log(profile.traits.lifetimeSpend);`,
  };

  const responses = [
    {
      status: 200,
      label: "200 Found",
      body: {
        id: "prf_meridian_77210",
        external_id: "cust_77210",
        phone: "+919876543210",
        email: "rahul.verma@example.com",
        name: "Rahul Verma",
        traits: {
          lifetime_value_inr: 48900,
          kyc_verified: true,
          preferred_channel: "whatsapp",
          city: "Bengaluru",
        },
        first_seen_at: "2026-01-14T08:20:00Z",
        last_seen_at: "2026-10-30T01:50:00Z",
      },
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Read Customer Profile
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          Retrieve unified customer identity records, calculated behavioral traits, and channel preferences.
        </p>
      </div>

      <EndpointHeader
        method="GET"
        path="/v1/profiles/:id"
        description="Reads unified profile traits and identifiers."
        auth="Bearer rk_test_... or rk_live_..."
      />

      <div className="space-y-4">
        <h2 className="text-base font-bold text-text">Code Examples</h2>
        <CodeBlock snippets={snippets} filename="get_profile" />
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-bold text-text">Path Parameters</h2>
        <ParamTable params={params} />
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-bold text-text">Response</h2>
        <ResponseTabs responses={responses} />
      </div>
    </div>
  );
}
