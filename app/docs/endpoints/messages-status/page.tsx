"use client";

import React from "react";
import {
  EndpointHeader,
  ParamTable,
  ResponseTabs,
  CodeBlock,
  Timeline,
} from "@/components/devhub";

export default function MessageStatusDocPage() {
  const params = [
    {
      name: "id",
      type: "string (path param)",
      required: true,
      description: "The unique Relay message ID returned in the send response.",
      example: "msg_01JB9X7V2T4KZQ8M",
    },
  ];

  const snippets = {
    curl: `curl -X GET https://api.relay.internal/v1/messages/msg_01JB9X7V2T4KZQ8M \\
  -H "Authorization: Bearer rk_test_9fa1b2e84c3"`,
    node: `const msg = await relay.messages.get("msg_01JB9X7V2T4KZQ8M");
console.log(msg.status, msg.deliveredAt);`,
    python: `msg = relay.messages.get("msg_01JB9X7V2T4KZQ8M")
print(msg.status, msg.delivered_at)`,
    go: `msg, err := client.Messages.Get(context.Background(), "msg_01JB9X7V2T4KZQ8M")`,
  };

  const responses = [
    {
      status: 200,
      label: "200 Delivered",
      body: {
        id: "msg_01JB9X7V2T4KZQ8M",
        status: "delivered",
        channel: "sms",
        recipient: "+919876543210",
        sender_id: "RELAYI",
        carrier: "Bharti Airtel",
        circle: "Karnataka",
        cost: 0.12,
        currency: "INR",
        created_at: "2026-10-30T01:55:00Z",
        delivered_at: "2026-10-30T01:55:01Z",
      },
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Get Message Status
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          Poll delivery progress, error reasons, handset delivery receipts (DLRs), and message cost.
        </p>
      </div>

      <EndpointHeader
        method="GET"
        path="/v1/messages/:id"
        description="Retrieves the current lifecycle state of a message."
        auth="Bearer rk_test_... or rk_live_..."
      />

      <div className="space-y-4">
        <h2 className="text-base font-bold text-text">Code Examples</h2>
        <CodeBlock snippets={snippets} filename="get_message" showLineNumbers />
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
