"use client";

import React, { useState } from "react";
import Link from "next/link";
import { WEBHOOK_EVENTS_CATALOGUE, WebhookEventSpec } from "@/lib/docs/api-spec";
import {
  JsonViewer,
  Callout,
  DocVersionBanner,
  DocFeedback,
  DocMeta,
  DocPaginationNav,
} from "@/components/devhub";
import { Zap, ShieldCheck, ArrowRight, Copy, Check } from "lucide-react";

export default function WebhookEventsCataloguePage() {
  const [selectedEvent, setSelectedEvent] = useState<WebhookEventSpec>(WEBHOOK_EVENTS_CATALOGUE[0]);
  const [copied, setCopied] = useState(false);

  const categories = Array.from(new Set(WEBHOOK_EVENTS_CATALOGUE.map((e) => e.category)));

  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            Event Catalogue
          </span>
          <span className="text-xs font-mono text-text-muted">Standard Event Envelopes</span>
        </div>

        <h1 className="text-2xl font-extrabold text-text tracking-tight">
          Webhook Event Payloads Reference
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Relay webhook deliveries encapsulate carrier receipts, status changes, and customer profile updates into a consistent, cryptographically-signed JSON event envelope.
        </p>

        <div className="pt-1 flex items-center gap-2">
          <Link
            href="/docs/webhooks"
            className="text-xs font-mono text-accent hover:underline flex items-center gap-1"
          >
            <span>Learn HMAC-SHA256 Signature Verification</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Two-Column Event Selector & Inspector */}
      <div className="space-y-4">
        <h2 id="catalogue" className="text-base font-bold text-text">
          Subscribed Event Types ({WEBHOOK_EVENTS_CATALOGUE.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {categories.map((category) => (
            <div key={category} className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-text-muted font-bold tracking-wider">
                {category}
              </span>
              <div className="space-y-1">
                {WEBHOOK_EVENTS_CATALOGUE.filter((e) => e.category === category).map((evt) => (
                  <button
                    key={evt.type}
                    onClick={() => setSelectedEvent(evt)}
                    className={`w-full text-left p-2 rounded-lg text-xs font-mono transition-all border ${
                      selectedEvent.type === evt.type
                        ? "bg-accent/15 border-accent text-accent font-bold shadow-sm"
                        : "bg-surface hover:bg-surface-2 border-border text-text-muted hover:text-text"
                    }`}
                  >
                    <div className="truncate">{evt.type}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Selected Event Detail */}
        <div className="p-5 rounded-xl border border-border bg-surface space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-text">
                  {selectedEvent.type}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-text-muted border border-border">
                  Since {selectedEvent.availableSince}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">{selectedEvent.description}</p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(selectedEvent.samplePayload, null, 2));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface border border-border text-xs font-mono text-text flex items-center gap-1.5 transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#3FB68B]" /> : <Copy className="w-3.5 h-3.5 text-text-muted" />}
              <span>{copied ? "Copied" : "Copy Payload"}</span>
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase text-text-muted font-semibold">
              Sample Event Envelope:
            </span>
            <div className="p-3 rounded-lg bg-[#09090B] border border-border">
              <JsonViewer data={selectedEvent.samplePayload} initialExpandedDepth={3} />
            </div>
          </div>
        </div>
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Webhook Endpoints API", href: "/docs/endpoints/webhook-endpoints" }}
        next={{ title: "Error Codes Catalogue", href: "/docs/errors" }}
      />
    </div>
  );
}
