"use client";

import React from "react";
import {
  CodeBlock,
  CopyField,
  Callout,
  StatusPill,
} from "@/components/devhub";

export default function AuthenticationDocPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Authentication & API Keys
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          How to authenticate requests, manage key scopes, and understand test vs live credentials.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-text">Bearer Token Format</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          Every request to Relay REST APIs must include an <code className="text-text font-mono">Authorization</code> header with your API key formatted as a Bearer token:
        </p>

        <CodeBlock
          code={`Authorization: Bearer rk_test_9fa1b2e84c30294821a8ef9012`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-text">Key Prefixes & Environments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-[#E0A93B]/30 bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[#E0A93B]">rk_test_...</span>
              <StatusPill variant="test" size="sm" />
            </div>
            <p className="text-xs text-text-muted">
              Used in the sandbox. Mock carrier responses, zero charge, no KYC approval needed.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-[#3FB68B]/30 bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[#3FB68B]">rk_live_...</span>
              <StatusPill variant="live" size="sm" />
            </div>
            <p className="text-xs text-text-muted">
              Used in production. Sends real carrier messages. Requires approved MCA KYC and GSTIN.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-text">API Key Scopes</h2>
        <ul className="space-y-2 text-xs text-text-muted">
          <li className="flex items-center gap-2">
            <code className="text-accent font-mono bg-surface-2 px-1.5 py-0.5 rounded border border-border">messages:send</code>
            <span>Permission to queue outbound messages on SMS, RCS, or WhatsApp.</span>
          </li>
          <li className="flex items-center gap-2">
            <code className="text-accent font-mono bg-surface-2 px-1.5 py-0.5 rounded border border-border">events:write</code>
            <span>Permission to ingest customer behavioral events into the CDP.</span>
          </li>
          <li className="flex items-center gap-2">
            <code className="text-accent font-mono bg-surface-2 px-1.5 py-0.5 rounded border border-border">profiles:read</code>
            <span>Permission to query unified customer profiles and traits.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
