"use client";

import React from "react";
import { DiffBadge } from "@/components/devhub";

export default function LimitsDocPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Rate Limits & Quotas
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          Throughput constraints, burst allowances, and HTTP headers returned with every API response.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-border bg-surface space-y-1">
          <span className="text-[11px] font-mono text-text-muted uppercase">Sandbox Throughput</span>
          <div className="text-2xl font-bold font-mono text-[#E0A93B]">50 TPS</div>
          <p className="text-xs text-text-muted">Simulated test rate for local debugging.</p>
        </div>

        <div className="p-4 rounded-lg border border-border bg-surface space-y-1">
          <span className="text-[11px] font-mono text-text-muted uppercase">Live Starter Plan</span>
          <div className="text-2xl font-bold font-mono text-accent">100 TPS</div>
          <p className="text-xs text-text-muted">Direct carrier SMPP pipe.</p>
        </div>

        <div className="p-4 rounded-lg border border-border bg-surface space-y-1">
          <span className="text-[11px] font-mono text-text-muted uppercase">Enterprise Plan</span>
          <div className="text-2xl font-bold font-mono text-[#3FB68B]">5,000+ TPS</div>
          <p className="text-xs text-text-muted">Dedicated telco queues with priority routes.</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-text">Rate Limit Response Headers</h2>
        <div className="p-4 rounded-lg border border-border bg-surface text-xs font-mono space-y-1.5">
          <div><span className="text-accent">X-RateLimit-Limit:</span> 50</div>
          <div><span className="text-accent">X-RateLimit-Remaining:</span> 48</div>
          <div><span className="text-accent">X-RateLimit-Reset:</span> 1793318401</div>
        </div>
      </section>
    </div>
  );
}
