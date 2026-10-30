import React from "react";
import Link from "next/link";
import {
  Callout,
  StatusPill,
  DiffBadge,
  CodeBlock,
} from "@/components/devhub";
import {
  Sparkles,
  ArrowRight,
  Send,
  Activity,
  Webhook,
  Key,
  ShieldCheck,
  Terminal,
} from "lucide-react";

export const metadata = {
  title: "Documentation Overview | Relay Developer Hub",
  description: "Official guide to integrating Relay Messaging APIs and Customer Data Platform.",
};

export default function DocsOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-accent uppercase tracking-wider font-semibold">
            Guides & Reference
          </span>
          <DiffBadge type="added" label="v2025-10-01" />
        </div>
        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Relay Developer Documentation
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          Welcome to the developer hub for Relay — India's enterprise messaging and customer data platform. Integrate SMS, RCS, and WhatsApp with approved TRAI DLT templates, and ingest real-time customer behavioral events.
        </p>
      </div>

      {/* 15-Minute Quickstart Banner */}
      <div className="p-5 rounded-xl border border-accent/40 bg-gradient-to-r from-accent/10 via-surface to-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-accent font-semibold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Recommended: 15-Minute Quickstart</span>
          </div>
          <p className="text-xs text-text-muted max-w-xl">
            Go from zero to sending your first verified sandbox message and receiving a delivery status webhook in under 15 minutes.
          </p>
        </div>
        <Link
          href="/docs/quickstart"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all shrink-0"
        >
          <span>Get Started</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Core Products Grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-text">Core API Capabilities</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/docs/endpoints/messages-send"
            className="p-4 rounded-lg border border-border bg-surface hover:border-text-muted/60 transition-colors space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded bg-[#7C7CFF]/15 border border-[#7C7CFF]/30 flex items-center justify-center text-[#7C7CFF]">
                <Send className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-text transition-colors" />
            </div>
            <h3 className="text-sm font-semibold text-text">Telecom Messaging</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Dispatch transactional, OTP, and promotional messages over SMS, RCS rich cards, and WhatsApp Business API.
            </p>
          </Link>

          <Link
            href="/docs/endpoints/events-ingest"
            className="p-4 rounded-lg border border-border bg-surface hover:border-text-muted/60 transition-colors space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded bg-[#3FB68B]/15 border border-[#3FB68B]/30 flex items-center justify-center text-[#3FB68B]">
                <Activity className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-text transition-colors" />
            </div>
            <h3 className="text-sm font-semibold text-text">Customer Data Platform (CDP)</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Ingest high-frequency user actions, sync CRM traits, and query unified customer profiles with full activity timelines.
            </p>
          </Link>

          <Link
            href="/docs/webhooks"
            className="p-4 rounded-lg border border-border bg-surface hover:border-text-muted/60 transition-colors space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded bg-[#E0A93B]/15 border border-[#E0A93B]/30 flex items-center justify-center text-[#E0A93B]">
                <Webhook className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-text transition-colors" />
            </div>
            <h3 className="text-sm font-semibold text-text">Webhooks & Event Visibility</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Receive delivery receipts, read statuses, and inbound replies with HMAC SHA-256 signatures, failure retries, and replay tools.
            </p>
          </Link>

          <Link
            href="/docs/compliance-guide"
            className="p-4 rounded-lg border border-border bg-surface hover:border-text-muted/60 transition-colors space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded bg-[#5B9DFF]/15 border border-[#5B9DFF]/30 flex items-center justify-center text-[#5B9DFF]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-text transition-colors" />
            </div>
            <h3 className="text-sm font-semibold text-text">TRAI DLT & MCA KYC</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Understand Indian telecom regulations, register Principal Entities, acquire Sender IDs (Headers), and map message templates.
            </p>
          </Link>
        </div>
      </section>

      {/* Environments Callout */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-text">Dual Environments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-[#E0A93B]/30 bg-[#E0A93B]/5 space-y-2">
            <div className="flex items-center justify-between">
              <StatusPill variant="test" />
              <span className="font-mono text-[10px] text-[#E0A93B]">rk_test_...</span>
            </div>
            <h4 className="text-xs font-semibold text-text">Test Sandbox Mode</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              Available immediately upon signup. Does not require MCA KYC or TRAI approvals. Zero cost, mock telecom dispatch, and full webhook emulation.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-[#3FB68B]/30 bg-[#3FB68B]/5 space-y-2">
            <div className="flex items-center justify-between">
              <StatusPill variant="live" />
              <span className="font-mono text-[10px] text-[#3FB68B]">rk_live_...</span>
            </div>
            <h4 className="text-xs font-semibold text-text">Live Production Mode</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              Dispatches real SMS, RCS and WhatsApp messages to Indian handsets. Requires verified GSTIN, approved MCA KYC, and approved DLT templates.
            </p>
          </div>
        </div>
      </section>

      {/* Authentication Snapshot */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text">Authentication</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          All Relay API endpoints require an API Key passed as a Bearer token in the <code className="text-text bg-surface-2 px-1 py-0.5 rounded font-mono">Authorization</code> header.
        </p>

        <CodeBlock
          code={`# Example API call with sandbox test key
curl -X GET https://api.relay.internal/v1/profiles/cust_01JB \\
  -H "Authorization: Bearer rk_test_9fa1b2e84c3" \\
  -H "Content-Type: application/json"`}
          language="bash"
          filename="request.sh"
        />
      </section>
    </div>
  );
}
