"use client";

import React, { useState } from "react";
import Link from "next/link";
import { API_SPECIFICATION } from "@/lib/docs/api-spec";
import {
  DocVersionBanner,
  DocFeedback,
  DocMeta,
  DocPaginationNav,
  JsonViewer,
} from "@/components/devhub";
import { ArrowRightLeft, GitBranch, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

export default function CompareVersionsDocPage() {
  const [sourceVersion, setSourceVersion] = useState("v2024-06-01");
  const [targetVersion, setTargetVersion] = useState("v2025-10-01");

  const endpointDiffs = [
    {
      endpoint: "POST /api/v1/messages",
      summary: "Message Dispatching Schema",
      v2024_06_01: {
        requestBody: {
          phone: "+919999900001",
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
          variables: { "1": "749201" },
        },
        responseBody: {
          id: "msg_legacy_01928",
          status: "submitted",
          phone: "+9199•••01",
          created_at: 1717200000,
        },
        changes: [
          "Parameter 'phone' was renamed to 'to' in v2025-10-01.",
          "Initial status value was 'submitted' instead of 'queued'.",
          "RCS and WhatsApp channels were not supported in v2024-06-01.",
          "Timestamps were integer unix epochs instead of ISO 8601 strings.",
        ],
      },
      v2025_10_01: {
        requestBody: {
          to: "+919999900001",
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
          variables: { "1": "749201" },
          sender_id: "RELAYI",
        },
        responseBody: {
          id: "msg_01JB9X7V2T4KZQ8M",
          object: "message",
          status: "queued",
          channel: "sms",
          to: "+9199•••01",
          cost: { estimated: 0.12, currency: "INR", charged: 0 },
          created_at: "2026-10-30T02:00:00.000Z",
        },
      },
    },
    {
      endpoint: "GET /api/v1/customers/{id}",
      summary: "Customer CDP Profile Schema",
      v2024_06_01: {
        requestBody: null,
        responseBody: {
          id: "prf_acme_9921",
          external_ids: ["cust_acmepay_7710"],
          attributes: {
            name: "Rahul Verma",
            phone: "+919876543210",
          },
        },
        changes: [
          "Customer profile lacked computed 'traits' dictionary (total_events, preferred_channel, last_seen).",
          "Lacked 'consent' object for channel opt-in/opt-out status.",
          "Could only be queried by internal profile ID (ext_ external lookup introduced in v2025-01-15).",
        ],
      },
      v2025_10_01: {
        requestBody: null,
        responseBody: {
          id: "prf_acme_9921",
          external_ids: ["cust_acmepay_7710"],
          attributes: {
            name: "Rahul Verma",
            phone: "+919876543210",
            email: "rahul@example.com",
          },
          traits: {
            total_events: 14,
            last_seen: "2026-10-30T01:15:00.000Z",
            preferred_channel: "whatsapp",
          },
          consent: {
            sms_opt_in: true,
            whatsapp_opt_in: true,
          },
        },
      },
    },
    {
      endpoint: "POST /api/v1/events",
      summary: "CDP Event Streaming Engine",
      v2024_06_01: {
        requestBody: null,
        responseBody: {
          error: {
            type: "invalid_request_error",
            code: "endpoint_not_found",
            message: "The requested endpoint does not exist on API version v2024-06-01.",
          },
        },
        changes: [
          "POST /api/v1/events did not exist in v2024-06-01.",
          "Constructing Customer Data Platform graphs via real-time ingestion was introduced in v2025-01-15.",
        ],
      },
      v2025_10_01: {
        requestBody: {
          external_id: "cust_acme_7710",
          event: "checkout_completed",
          properties: { order_value_inr: 2999 },
        },
        responseBody: {
          total: 1,
          accepted: 1,
          rejected: 0,
          errors: [],
        },
      },
    },
    {
      endpoint: "Webhooks Dispatcher",
      summary: "HMAC Cryptographic Verification Header",
      v2024_06_01: {
        requestBody: null,
        responseBody: {
          header: "X-Relay-Signature: sha256=41496b8c...",
        },
        changes: [
          "Legacy header format was 'X-Relay-Signature: sha256=...' without timestamp prefix.",
          "v2025-10-01 introduces 'Relay-Signature: t={timestamp},v1={hash}' preventing replay attacks.",
          "v2025-10-01 supports zero-downtime dual-signing during secret rotation.",
        ],
      },
      v2025_10_01: {
        requestBody: null,
        responseBody: {
          header: "Relay-Signature: t=1793310000,v1=41496b8c...,v1=9fa1b2e8...",
        },
      },
    },
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            Schema Diff
          </span>
          <span className="text-xs font-mono text-text-muted">Version Comparison Tool</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Compare API Versions
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Inspect structural schema differences, parameter changes, and response payload changes between API releases.
        </p>

        {/* Version Switchers */}
        <div className="flex items-center gap-3 pt-2 font-mono text-xs">
          <div className="flex items-center gap-1.5 bg-surface p-1 rounded-lg border border-border">
            <span className="text-text-muted px-2">From:</span>
            <select
              value={sourceVersion}
              onChange={(e) => setSourceVersion(e.target.value)}
              className="bg-[#09090B] px-2 py-1 rounded text-text font-bold border border-border outline-none"
            >
              <option value="v2024-06-01">v2024-06-01 (Deprecated)</option>
              <option value="v2025-01-15">v2025-01-15 (Supported)</option>
            </select>
          </div>

          <ArrowRight className="w-4 h-4 text-text-muted" />

          <div className="flex items-center gap-1.5 bg-surface p-1 rounded-lg border border-border">
            <span className="text-text-muted px-2">To:</span>
            <select
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              className="bg-[#09090B] px-2 py-1 rounded text-[#3FB68B] font-bold border border-border outline-none"
            >
              <option value="v2025-10-01">v2025-10-01 (Current GA)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Diffs List */}
      <div className="space-y-6">
        {endpointDiffs.map((diff) => (
          <div
            key={diff.endpoint}
            className="p-5 rounded-xl border border-border bg-surface space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <span className="font-mono text-sm font-bold text-accent">{diff.endpoint}</span>
                <span className="text-xs text-text-muted block mt-0.5">{diff.summary}</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 text-text-muted border border-border">
                {diff.v2024_06_01.changes.length} Differences
              </span>
            </div>

            {/* Changes bullet points */}
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase text-text-muted font-semibold">
                Summary of Schema Changes:
              </span>
              <ul className="list-disc list-inside space-y-1 text-xs text-text leading-relaxed pl-1">
                {diff.v2024_06_01.changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            {/* Side by side payloads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#E5534B]">
                  <span>{sourceVersion} (Old)</span>
                </div>
                <div className="p-3 rounded-lg bg-[#09090B] border border-[#E5534B]/30 max-h-56 overflow-y-auto">
                  <JsonViewer data={diff.v2024_06_01.responseBody} initialExpandedDepth={2} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#3FB68B]">
                  <span>{targetVersion} (Latest GA)</span>
                </div>
                <div className="p-3 rounded-lg bg-[#09090B] border border-[#3FB68B]/30 max-h-56 overflow-y-auto">
                  <JsonViewer data={diff.v2025_10_01.responseBody} initialExpandedDepth={2} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Migrating Between Versions", href: "/docs/migrating-between-versions" }}
        next={{ title: "All Endpoints Reference", href: "/docs/endpoints" }}
      />
    </div>
  );
}
