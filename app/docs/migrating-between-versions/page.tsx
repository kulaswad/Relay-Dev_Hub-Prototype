"use client";

import React from "react";
import Link from "next/link";
import {
  Callout,
  DocVersionBanner,
  DocFeedback,
  DocMeta,
  DocPaginationNav,
  CodeBlock,
} from "@/components/devhub";
import { GitBranch, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function MigratingBetweenVersionsDocPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            Migration Guide
          </span>
          <span className="text-xs font-mono text-text-muted">v2024-06-01 → v2025-10-01</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Migrating Between API Versions
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Step-by-step checklist to upgrade your application from deprecated version <code className="text-[#E5534B] font-mono">v2024-06-01</code> to the current GA release <code className="text-[#3FB68B] font-mono">v2025-10-01</code>.
        </p>
      </div>

      <Callout type="warning" title="Sunset Deadline: June 1, 2027">
        API version <code className="text-accent font-mono">v2024-06-01</code> will be permanently shut down on <strong>June 1, 2027</strong>. After this date, all requests carrying <code className="font-mono">Relay-Version: 2024-06-01</code> will return <code className="text-[#E5534B] font-mono">400 version_unsupported</code>.
      </Callout>

      <div className="space-y-6">
        <h2 id="breaking-differences" className="text-lg font-bold text-text">
          Key Breaking Changes & Differences
        </h2>

        {/* Change 1 */}
        <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E5534B]/20 text-[#E5534B] border border-[#E5534B]/30">
              BREAKING
            </span>
            <span className="text-sm font-bold text-text">1. Recipient Parameter: 'phone' → 'to'</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            In <code className="text-[#E5534B] font-mono">v2024-06-01</code>, message dispatch required the <code className="font-mono text-text">"phone"</code> body field. In <code className="text-[#3FB68B] font-mono">v2025-10-01</code>, this parameter is standardized to <code className="font-mono text-accent font-bold">"to"</code> to accommodate omnichannel address formats across SMS, RCS, and WhatsApp.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-[#E5534B]/10 border border-[#E5534B]/30 space-y-1">
              <span className="text-[#E5534B] font-bold">Old (v2024-06-01):</span>
              <pre className="text-text">{`{ "phone": "+919999900001" }`}</pre>
            </div>
            <div className="p-3 rounded-lg bg-[#3FB68B]/10 border border-[#3FB68B]/30 space-y-1">
              <span className="text-[#3FB68B] font-bold">New (v2025-10-01):</span>
              <pre className="text-text">{`{ "to": "+919999900001" }`}</pre>
            </div>
          </div>
        </div>

        {/* Change 2 */}
        <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E5534B]/20 text-[#E5534B] border border-[#E5534B]/30">
              BREAKING
            </span>
            <span className="text-sm font-bold text-text">2. Customer Profile 'traits' and 'consent'</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            In <code className="text-[#E5534B] font-mono">v2024-06-01</code>, the customer profile returned only flat contact attributes. In <code className="text-[#3FB68B] font-mono">v2025-10-01</code>, aggregated CDP traits (<code className="font-mono text-text">total_events</code>, <code className="font-mono text-text">last_seen</code>, <code className="font-mono text-text">preferred_channel</code>) and channel consent opt-ins are grouped in dedicated objects.
          </p>
        </div>

        {/* Change 3 */}
        <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-accent/20 text-accent border border-accent/30">
              NEW FEATURE
            </span>
            <span className="text-sm font-bold text-text">3. Mandatory HMAC-SHA256 Relay-Signature</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Webhooks in <code className="text-[#3FB68B] font-mono">v2025-10-01</code> must be verified using the standard <code className="text-accent font-mono">Relay-Signature</code> header with 300s replay tolerance and zero-downtime dual-signing secret rotation support.
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-surface-2 border border-border flex items-center justify-between text-xs">
        <span className="text-text font-medium">Want to see side-by-side endpoint schemas?</span>
        <Link
          href="/docs/compare-versions"
          className="px-3 py-1.5 rounded-lg bg-accent text-white font-semibold flex items-center gap-1.5 hover:bg-accent/90 transition-colors"
        >
          <span>Compare Versions Table</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Going Live (KYC Checklist)", href: "/docs/compliance-guide" }}
        next={{ title: "Compare Versions", href: "/docs/compare-versions" }}
      />
    </div>
  );
}
