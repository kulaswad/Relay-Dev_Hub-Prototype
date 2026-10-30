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
import { ShieldCheck, FileCheck, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

export default function TemplatesDltGuidePage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            Regulatory Guide
          </span>
          <span className="text-xs font-mono text-text-muted">TRAI TCCCPR 2018</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Templates & Sender IDs: DLT Explained in Plain Language
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          In India, the Telecom Regulatory Authority of India (TRAI) mandates Distributed Ledger Technology (DLT) registration for all commercial, promotional, and transactional SMS messages. Here is what developers need to know.
        </p>
      </div>

      <div className="space-y-4">
        <h2 id="core-concepts" className="text-lg font-bold text-text">
          The 3 Building Blocks of TRAI DLT
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
            <span className="text-xs font-bold text-text font-mono">1. Entity Registration</span>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Your company registers as a <strong>Principal Entity (PE)</strong> on telecom portals (Airtel, Jio, Vodafone Idea, or BSNL) with your PAN, Certificate of Incorporation, and GSTIN.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
            <span className="text-xs font-bold text-text font-mono">2. Headers (Sender IDs)</span>
            <p className="text-[11px] text-text-muted leading-relaxed">
              A 6-character alphabetic sender name representing your brand (e.g. <code className="text-accent font-mono font-bold">ACMEPY</code>, <code className="text-accent font-mono font-bold">RELAYI</code>). Headers are case-sensitive.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
            <span className="text-xs font-bold text-text font-mono">3. Content Templates</span>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Exact message scripts approved with placeholders <code className="text-accent font-mono">{"{#var#}"}</code>. Any discrepancy between the sent string and approved template causes carrier rejection.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 id="variable-matching" className="text-lg font-bold text-text">
          How Relay Automates Template Matching
        </h2>
        <p className="text-xs text-text-muted leading-relaxed">
          Instead of having your backend construct fragile raw strings and risk carrier rejection, Relay handles string injection on the gateway:
        </p>
        <div className="p-4 rounded-xl bg-[#09090B] border border-border space-y-2 text-xs font-mono">
          <div className="text-text-muted text-[11px]">Approved Template:</div>
          <div className="text-text bg-surface p-2.5 rounded border border-border">
            Your AcmePay verification code is {"{#var#}"}. Valid for 10 minutes. - AcmePay
          </div>
          <div className="text-text-muted text-[11px] pt-1">Your API Request:</div>
          <div className="text-accent bg-surface p-2.5 rounded border border-border">
            {`"variables": {"1": "481029"}`}
          </div>
          <div className="text-[#3FB68B] text-[11px] pt-1">
            ✓ Gatekeeper checks hash match with carrier registry before dispatching to radio towers.
          </div>
        </div>
      </div>

      <Callout type="tip" title="Sandbox Bypass">
        In the Relay Test sandbox (<code className="text-accent font-mono">rl_test_...</code>), you can immediately test using the pre-approved templates <code className="text-text font-mono">dlt_tmpl_otp_login</code> and <code className="text-text font-mono">dlt_tmpl_order_update</code> with zero regulatory registration required.
      </Callout>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Omnichannel Messaging", href: "/docs/guides/sending-messages" }}
        next={{ title: "Ingesting Events & Profiles", href: "/docs/guides/ingesting-events" }}
      />
    </div>
  );
}
