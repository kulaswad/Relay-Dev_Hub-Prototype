"use client";

import React from "react";
import Link from "next/link";
import {
  Callout,
  DocVersionBanner,
  DocFeedback,
  DocMeta,
  DocPaginationNav,
} from "@/components/devhub";
import { ArrowRightLeft, ShieldAlert, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

export default function TestVsLiveDocPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-[#3FB68B]/10 border-[#3FB68B]/30 text-[#3FB68B]">
            Environments
          </span>
          <span className="text-xs font-mono text-text-muted">Sandbox vs Production</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Test vs. Live Environments
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Relay strictly separates the Test sandbox environment from Live production to ensure evaluating developers never cause billing accidents, send unintended messages to customers, or get blocked by regulatory compliance delays.
        </p>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border border-[#E0A93B]/30 bg-surface space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E0A93B]" />
            <h2 className="text-sm font-bold text-text">Test Sandbox Environment</h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Instant evaluation and unit testing for developers without paperwork or carrier approvals.
          </p>
          <ul className="space-y-2 text-xs font-mono text-text-muted pt-2 border-t border-border">
            <li className="flex items-start gap-2">
              <span className="text-[#3FB68B]">✓</span>
              <span>Key Prefix: <code className="text-accent font-bold">rl_test_...</code></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3FB68B]">✓</span>
              <span>Tariff: <strong>₹0.00</strong> (Wallet never charged)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3FB68B]">✓</span>
              <span>KYC Requirement: <strong>Bypassed completely</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3FB68B]">✓</span>
              <span>Pre-approved DLT templates & headers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3FB68B]">✓</span>
              <span>Localhost HTTP webhook endpoints allowed</span>
            </li>
          </ul>
        </div>

        <div className="p-5 rounded-xl border border-[#3FB68B]/30 bg-surface space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3FB68B] animate-pulse" />
            <h2 className="text-sm font-bold text-text">Live Carrier Environment</h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Real commercial telecommunications dispatch across Airtel, Jio, Vi, and WhatsApp Business.
          </p>
          <ul className="space-y-2 text-xs font-mono text-text-muted pt-2 border-t border-border">
            <li className="flex items-start gap-2">
              <span className="text-[#3FB68B]">✓</span>
              <span>Key Prefix: <code className="text-[#3FB68B] font-bold">rl_live_...</code></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3FB68B]">✓</span>
              <span>Tariff: Debits wallet or postpaid credit line</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#E0A93B]">⚠️</span>
              <span>KYC: <strong>Indian MCA & TRAI DLT verification mandatory</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#E0A93B]">⚠️</span>
              <span>Only your approved 6-character Headers allowed</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#E0A93B]">⚠️</span>
              <span>Webhooks must use valid HTTPS (SSL/TLS required)</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        <h2 id="environment-switching" className="text-lg font-bold text-text">
          How the Gateway Determines Environment
        </h2>
        <p className="text-xs text-text-muted leading-relaxed">
          The environment is determined strictly by the API key provided in the <code className="text-accent font-mono">Authorization: Bearer &lt;key&gt;</code> header:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs text-text-muted pl-1">
          <li>Keys starting with <code className="text-accent font-mono">rl_test_</code> execute in the Test sandbox.</li>
          <li>Keys starting with <code className="text-[#3FB68B] font-mono">rl_live_</code> execute in Live production.</li>
          <li>If a live key is invoked on a workspace that has not completed KYC, the gateway immediately rejects the request with <code className="text-[#E5534B] font-mono">403 workspace_not_verified</code> and returns a link to the KYC checklist.</li>
        </ul>
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "15-Minute Quickstart", href: "/docs/quickstart" }}
        next={{ title: "Authentication & Keys", href: "/docs/authentication" }}
      />
    </div>
  );
}
