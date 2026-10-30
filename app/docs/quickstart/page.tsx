"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CodeBlock,
  EndpointHeader,
  ParamTable,
  ResponseTabs,
  StatusPill,
  CopyField,
  Callout,
  Stepper,
  Timeline,
} from "@/components/devhub";
import { Sparkles, ArrowRight, CheckCircle2, Play, Key, Terminal } from "lucide-react";

export default function QuickstartPage() {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { id: 1, title: "1. Obtain Test Key", duration: "1 min" },
    { id: 2, title: "2. Prepare Payload", duration: "2 min" },
    { id: 3, title: "3. Send to Sandbox", duration: "4 min" },
    { id: 4, title: "4. Verify Delivery", duration: "8 min" },
  ];

  const quickstartSnippets = {
    curl: `curl -X POST https://api.relay.internal/v1/messages \\
  -H "Authorization: Bearer rk_test_9fa1b2e84c3" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "sms",
    "recipient": "+919876543210",
    "sender_id": "RELAYI",
    "template_id": "dlt_tmpl_otp_login",
    "body": "Your Relay OTP is 482910. Valid for 10 minutes. Do not share.",
    "metadata": {
      "lead_source": "quickstart_test"
    }
  }'`,
    node: `import { RelayClient } from "@relay/sdk";

const relay = new RelayClient({
  apiKey: "rk_test_9fa1b2e84c3",
  environment: "test"
});

const res = await relay.messages.send({
  channel: "sms",
  recipient: "+919876543210",
  senderId: "RELAYI",
  templateId: "dlt_tmpl_otp_login",
  body: "Your Relay OTP is 482910. Valid for 10 minutes. Do not share.",
  metadata: { leadSource: "quickstart_test" }
});

console.log("Success! Message ID:", res.id);`,
    python: `from relay import RelayClient

relay = RelayClient(api_key="rk_test_9fa1b2e84c3", environment="test")

msg = relay.messages.send(
    channel="sms",
    recipient="+919876543210",
    sender_id="RELAYI",
    template_id="dlt_tmpl_otp_login",
    body="Your Relay OTP is 482910. Valid for 10 minutes. Do not share.",
    metadata={"lead_source": "quickstart_test"}
)

print(f"Message ID: {msg.id}, Status: {msg.status}")`,
    go: `package main

import (
    "context"
    "fmt"
    "github.com/relay/relay-go"
)

func main() {
    client := relay.NewClient("rk_test_9fa1b2e84c3", relay.WithEnvironment("test"))

    res, err := client.Messages.Send(context.Background(), &relay.SendMessageParams{
        Channel:    "sms",
        Recipient:  "+919876543210",
        SenderID:   "RELAYI",
        TemplateID: "dlt_tmpl_otp_login",
        Body:       "Your Relay OTP is 482910. Valid for 10 minutes. Do not share.",
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Queued ID: %s\\n", res.ID)
}`,
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="space-y-2 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-accent uppercase tracking-wider font-semibold">
            Onboarding Walkthrough
          </span>
          <StatusPill variant="test" label="Sandbox Ready" size="sm" />
        </div>
        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          15-Minute Integration Quickstart
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          This step-by-step tutorial takes you from registration to sending your first verified API call in Relay's test sandbox.
        </p>
      </div>

      {/* Stepper overview */}
      <div className="p-4 rounded-xl border border-border bg-surface">
        <Stepper
          steps={steps}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />
      </div>

      {/* Step 1 */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-mono text-xs font-bold text-accent">
            1
          </span>
          <h2 className="text-lg font-bold text-text">
            Obtain Your Sandbox API Key
          </h2>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Every new workspace is automatically provisioned with a sandbox key (<code className="text-[#E0A93B]">rk_test_...</code>). You can copy your test key below or generate a scoped key in the console.
        </p>

        <CopyField
          label="Your Sandbox Test Key"
          value="rk_test_9fa1b2e84c30294821a8ef9012"
          prefix="rk_test_"
          isSecret
        />

        <Callout type="note" title="No KYC Needed For Sandbox">
          You do <strong className="text-text">not need to submit Indian business documents (GSTIN or MCA KYC)</strong> to use test keys. You can test all APIs immediately.
        </Callout>
      </section>

      {/* Step 2 */}
      <section className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-mono text-xs font-bold text-accent">
            2
          </span>
          <h2 className="text-lg font-bold text-text">
            Prepare Your Request Payload
          </h2>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Relay unifies Indian SMS, RCS and WhatsApp into a single REST schema. For SMS delivery in India, TRAI requires specifying a 6-character registered Header (<code className="text-text font-mono">sender_id</code>) and a registered template (<code className="text-text font-mono">template_id</code>). In the sandbox, default pre-registered test templates like <code className="text-accent font-mono">dlt_tmpl_otp_login</code> are readily available.
        </p>

        <EndpointHeader
          method="POST"
          path="/v1/messages"
          description="Queues a message for immediate transmission."
          auth="Bearer rk_test_..."
        />
      </section>

      {/* Step 3 */}
      <section className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-mono text-xs font-bold text-accent">
            3
          </span>
          <h2 className="text-lg font-bold text-text">
            Execute Your First API Call
          </h2>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Run this request using your favorite language tab. The language choice is remembered across the entire hub.
        </p>

        <CodeBlock
          snippets={quickstartSnippets}
          filename="quickstart_request"
          showLineNumbers
        />

        <div className="space-y-2">
          <h4 className="text-xs font-mono font-semibold uppercase text-text-muted">
            Expected Sandbox Response (200 Queued):
          </h4>
          <CodeBlock
            language="json"
            code={`{
  "id": "msg_01JB9X7V2T4KZQ8M",
  "status": "queued",
  "channel": "sms",
  "recipient": "+919876543210",
  "sender_id": "RELAYI",
  "template_id": "dlt_tmpl_otp_login",
  "cost": 0.12,
  "currency": "INR",
  "environment": "test",
  "created_at": "2026-10-30T01:55:00Z"
}`}
          />
        </div>
      </section>

      {/* Step 4 */}
      <section className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-mono text-xs font-bold text-accent">
            4
          </span>
          <h2 className="text-lg font-bold text-text">
            Verify Delivery Event & Webhook
          </h2>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          In sandbox mode, our telecom simulator automatically transitions the message status from <code className="text-text font-mono">queued</code> to <code className="text-[#3FB68B] font-mono">delivered</code> within 800ms and fires a delivery webhook.
        </p>

        <div className="p-4 rounded-lg border border-border bg-surface">
          <Timeline
            items={[
              {
                id: 1,
                time: "00:00.000",
                title: "POST /v1/messages Received",
                status: "success",
                description: "Authenticated with rk_test_...; 200 Queued response returned.",
              },
              {
                id: 2,
                time: "00:00.450",
                title: "Carrier Handset Acknowledged",
                status: "success",
                description: "Simulated Airtel/Jio SMSC delivery receipt (DLR) received.",
              },
              {
                id: 3,
                time: "00:00.820",
                title: "Webhook 'message.delivered' Emitted",
                status: "info",
                description: "Dispatched to registered webhook endpoint with HMAC signature.",
              },
            ]}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-surface-2 border border-border">
          <div className="space-y-0.5">
            <h4 className="text-xs font-semibold text-text">
              Try it interactively in the Playground
            </h4>
            <p className="text-[11px] text-text-muted">
              You can test all endpoints with live responses in the Console Playground.
            </p>
          </div>
          <Link
            href="/console/playground"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors shrink-0"
          >
            <span>Open Playground</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
