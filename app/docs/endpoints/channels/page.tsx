"use client";

import React from "react";
import { EndpointHeader, Callout, DiffBadge } from "@/components/devhub";

export default function ChannelsDocPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Channels & Sender Identifiers
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          Overview of messaging channels supported by Relay: SMS, RCS Business Messaging, and WhatsApp Cloud API.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-lg border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-text">SMS</span>
            <DiffBadge type="added" label="TRAI DLT" />
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Standard telecom SMS across Indian carriers. Requires 6-character alphabetic header for transactional/service traffic or numeric header for promotional.
          </p>
          <div className="text-[11px] font-mono text-accent">
            Rates: ₹0.12 - ₹0.15 / SMS
          </div>
        </div>

        <div className="p-5 rounded-lg border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-text">RCS</span>
            <DiffBadge type="added" label="Rich Media" />
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Google Jibe RCS with verified brand tick, rich media cards, suggested reply action chips, and fallback to SMS when data is inactive.
          </p>
          <div className="text-[11px] font-mono text-accent">
            Rates: ₹0.20 - ₹0.24 / RCS
          </div>
        </div>

        <div className="p-5 rounded-lg border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-text">WhatsApp</span>
            <DiffBadge type="added" label="Meta Cloud" />
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            WhatsApp Business API with 24-hour customer service window, OTP auth templates, and interactive button catalogs.
          </p>
          <div className="text-[11px] font-mono text-accent">
            Rates: ₹0.35 - ₹0.40 / Msg
          </div>
        </div>
      </div>

      <Callout type="note" title="Unified Schema">
        All three channels share the same REST API endpoint (<code className="text-text font-mono">POST /v1/messages</code>). You only need to change the <code className="text-accent font-mono">channel</code> property in your request.
      </Callout>
    </div>
  );
}
