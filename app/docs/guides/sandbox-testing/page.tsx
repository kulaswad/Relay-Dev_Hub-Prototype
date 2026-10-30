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
import { FlaskConical, CheckCircle2, ShieldAlert, PhoneCall, Clock, ArrowRight } from "lucide-react";

export default function SandboxTestingGuidePage() {
  const testNumbers = [
    {
      phone: "+919999900001",
      behavior: "Immediate Happy Path Delivery",
      lifecycle: "queued → sent (1.2s) → delivered (2.8s) → read (4.0s for WhatsApp/RCS)",
      dlrCode: "DELIVRD",
      carrier: "Bharti Airtel (Karnataka circle)",
      cost: "₹0.00 (Test Sandbox)",
    },
    {
      phone: "+919999900002",
      behavior: "Handset Unreachable Simulation",
      lifecycle: "queued → failed (1.2s, failure_reason: handset_unreachable)",
      dlrCode: "UNDELIV_HANDSET_OFF",
      carrier: "Reliance Jio (Mumbai circle)",
      cost: "₹0.00 (Test Sandbox)",
    },
    {
      phone: "+919999900003",
      behavior: "TRAI NDNC DND Active Rejection",
      lifecycle: "queued → failed (1.0s, failure_reason: dnd_registered)",
      dlrCode: "DND_BLOCKED_TRAI",
      carrier: "Vodafone Idea (Delhi circle)",
      cost: "₹0.00 (Test Sandbox)",
    },
    {
      phone: "+919999900004",
      behavior: "Stays in 'Sent' (Lagging / Missing DLR)",
      lifecycle: "queued → sent (1.2s) → remains 'sent' indefinitely",
      dlrCode: "PENDING_NETWORK_ACK",
      carrier: "BSNL (Tamil Nadu circle)",
      cost: "₹0.00 (Test Sandbox)",
    },
    {
      phone: "+919999900005",
      behavior: "Triggers Rate Limit Warning",
      lifecycle: "Simulates high-velocity traffic for stress-testing client exponential backoff",
      dlrCode: "HTTP 429",
      carrier: "Gateway Middleware",
      cost: "₹0.00 (Test Sandbox)",
    },
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-[#E0A93B]/10 border-[#E0A93B]/30 text-[#E0A93B]">
            Sandbox Simulation
          </span>
          <span className="text-xs font-mono text-text-muted">Zero Carrier Charges</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Testing in the Sandbox
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          The Relay Sandbox lets your engineers develop, test edge cases, simulate carrier dropouts, and verify webhook consumers without sending real telecom traffic or paying SMS tariffs.
        </p>
      </div>

      <Callout type="note" title="Sandbox Key Prefix">
        Requests to the sandbox must use a Test API key prefixed with <code className="text-accent font-mono font-bold">rl_test_...</code>. In Test mode, Relay bypasses live Indian telecom DLT registration, skips MCA incorporation verification, and simulates realistic network transitions.
      </Callout>

      {/* Test Numbers Table */}
      <div className="space-y-3">
        <h2 id="magic-numbers" className="text-lg font-bold text-text">
          Deterministic Test Numbers
        </h2>
        <p className="text-xs text-text-muted">
          Dispatching messages to these dedicated test numbers triggers deterministic telecom carrier behaviors:
        </p>

        <div className="overflow-x-auto border border-border rounded-xl bg-surface">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-[#0C0C0F] text-[11px] text-text-muted uppercase">
                <th className="py-3 px-4">Test Mobile Number</th>
                <th className="py-3 px-4">Simulated Behavior</th>
                <th className="py-3 px-4">DLR Status & Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {testNumbers.map((num) => (
                <tr key={num.phone} className="hover:bg-surface-2/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-accent select-all">
                    {num.phone}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-text font-medium block">{num.behavior}</span>
                    <span className="text-[11px] text-text-muted block mt-0.5 font-sans">
                      {num.lifecycle}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                        num.dlrCode === "DELIVRD"
                          ? "bg-[#3FB68B]/10 border-[#3FB68B]/30 text-[#3FB68B]"
                          : num.dlrCode === "HTTP 429"
                          ? "bg-[#E0A93B]/10 border-[#E0A93B]/30 text-[#E0A93B]"
                          : "bg-[#E5534B]/10 border-[#E5534B]/30 text-[#E5534B]"
                      }`}
                    >
                      {num.dlrCode}
                    </span>
                    <span className="text-[11px] text-text-muted block mt-0.5">
                      {num.carrier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preapproved Templates */}
      <div className="space-y-3">
        <h2 id="preapproved-templates" className="text-lg font-bold text-text">
          Pre-Approved Sandbox Templates
        </h2>
        <p className="text-xs text-text-muted">
          In Test mode, you can immediately test message dispatch using these pre-approved DLT templates:
        </p>

        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-text">dlt_tmpl_otp_login</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent/15 text-accent border border-accent/30">
                OTP / Transactional
              </span>
            </div>
            <p className="text-xs font-mono text-text-muted bg-[#09090B] p-2.5 rounded-lg border border-border">
              Your AcmePay verification code is {"{#var#}"}. Valid for 10 minutes. Do not share this OTP with anyone. - AcmePay
            </p>
            <div className="text-[11px] font-mono text-text-muted">
              Variables required: <code className="text-accent">{`{"1": "481920"}`}</code>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-text">dlt_tmpl_order_update</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/30">
                Service Implicit
              </span>
            </div>
            <p className="text-xs font-mono text-text-muted bg-[#09090B] p-2.5 rounded-lg border border-border">
              Hi {"{#var#}"}, your order #{"{#var#}"} has been shipped via {"{#var#}"}. Track at {"{#var#}"}. - Relay
            </p>
            <div className="text-[11px] font-mono text-text-muted">
              Variables required: <code className="text-accent">{`{"1": "Aditya", "2": "ORD-991", "3": "Bluedart", "4": "track.relay.in/991"}`}</code>
            </div>
          </div>
        </div>
      </div>

      {/* Code Snippet Example */}
      <div className="space-y-3">
        <h2 id="example-call" className="text-lg font-bold text-text">
          Dispatching to a Sandbox Test Number
        </h2>
        <CodeBlock
          snippets={{
            curl: `curl -X POST https://api.relay.in/v1/messages \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+919999900001",
    "channel": "sms",
    "template_id": "dlt_tmpl_otp_login",
    "variables": {"1": "928104"}
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
    variables: { "1": "928104" },
  }),
});
const data = await res.json();
console.log("Status:", data.status); // 'queued' -> auto advances to 'delivered'`,
          }}
        />
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Rate Limits & Quotas", href: "/docs/limits" }}
        next={{ title: "Going Live (KYC Checklist)", href: "/docs/compliance-guide" }}
      />
    </div>
  );
}
