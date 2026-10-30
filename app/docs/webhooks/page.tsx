"use client";

import React from "react";
import {
  CodeBlock,
  Callout,
  Timeline,
  DiffBadge,
} from "@/components/devhub";

export default function WebhooksDocPage() {
  const verifySnippetNode = `import crypto from "crypto";

export function verifyRelayWebhook(payloadString: string, signatureHeader: string, secret: string): boolean {
  // Signature header format: t=1793318400,v1=9fa1b2e84c...
  const parts = signatureHeader.split(",");
  const timestamp = parts.find(p => p.startsWith("t="))?.slice(2);
  const signature = parts.find(p => p.startsWith("v1="))?.slice(3);

  if (!timestamp || !signature) return false;

  const signedPayload = \`\${timestamp}.\${payloadString}\`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}`;

  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-accent uppercase tracking-wider font-semibold">
            Event Visibility
          </span>
          <DiffBadge type="security" label="HMAC SHA-256" />
        </div>
        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Webhooks & Signature Verification
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          Relay delivers delivery receipts, inbound replies, and profile updates directly to your backend via secure HTTP webhooks.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-text">Webhook Headers</h2>
        <div className="p-4 rounded-lg border border-border bg-surface text-xs font-mono space-y-1">
          <div><span className="text-accent font-semibold">X-Relay-Signature:</span> t=1793318400,v1=6b45a...</div>
          <div><span className="text-accent font-semibold">X-Relay-Event:</span> message.delivered</div>
          <div><span className="text-accent font-semibold">X-Relay-Delivery-Id:</span> del_01JB9X7V...</div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-text">Verifying Webhook Signatures (Node.js)</h2>
        <CodeBlock code={verifySnippetNode} language="ts" filename="verify_webhook.ts" showLineNumbers />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-text">Automatic Retry Schedule</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          If your server returns anything other than a 2xx HTTP response (or times out after 10 seconds), Relay automatically queues the webhook for retry using exponential backoff:
        </p>
        <div className="p-4 rounded-lg border border-border bg-surface">
          <Timeline
            items={[
              { id: 1, time: "Initial Attempt", title: "Immediate POST", status: "danger", description: "Your server returned 502 Bad Gateway" },
              { id: 2, time: "Attempt 2 (+30s)", title: "First Retry", status: "danger", description: "Connection timed out (10s threshold)" },
              { id: 3, time: "Attempt 3 (+5m)", title: "Second Retry", status: "danger", description: "Your server returned 500 Internal Error" },
              { id: 4, time: "Attempt 4 (+30m)", title: "Third Retry", status: "success", description: "HTTP 200 OK received — event marked as delivered" },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
