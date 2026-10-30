"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDevHub } from "@/components/providers/DevHubContext";
import { API_SPECIFICATION } from "@/lib/docs/api-spec";
import {
  CodeBlock,
  ParamTable,
  JsonViewer,
  Callout,
  DocVersionBanner,
  DocFeedback,
  DocMeta,
  DocPaginationNav,
} from "@/components/devhub";
import { Webhook, Plus, Trash2, List, ShieldCheck, ArrowRight } from "lucide-react";

export default function WebhookEndpointsDocPage() {
  const postSpec = API_SPECIFICATION.find((e) => e.id === "webhook-endpoints-post")!;
  const listSpec = API_SPECIFICATION.find((e) => e.id === "webhook-endpoints-list")!;
  const deleteSpec = API_SPECIFICATION.find((e) => e.id === "webhook-endpoints-delete")!;

  const [activeTab, setActiveTab] = useState<"create" | "list" | "delete">("create");

  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-4 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            REST API
          </span>
          <code className="text-sm font-mono text-text font-bold">/api/v1/webhook_endpoints</code>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight">
            Webhook Endpoints Management
          </h1>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Programmatically configure, list, and decommission webhook subscriber URLs for real-time delivery callbacks, carrier receipts, and CDP event notifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/console/webhooks"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
          >
            <Webhook className="w-3.5 h-3.5" />
            <span>Manage in Console</span>
          </Link>
          <Link
            href="/docs/endpoints/webhook-events"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text hover:border-text-muted transition-colors font-mono"
          >
            <span>View Event Payloads Catalogue</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        {[
          { id: "create", label: "POST /webhook_endpoints", badge: "POST", method: "POST" },
          { id: "list", label: "GET /webhook_endpoints", badge: "GET", method: "GET" },
          { id: "delete", label: "DELETE /webhook_endpoints/{id}", badge: "DELETE", method: "DELETE" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
              activeTab === t.id
                ? "bg-surface-2 text-text border border-border shadow-sm font-bold"
                : "text-text-muted hover:text-text"
            }`}
          >
            <span
              className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                t.method === "POST"
                  ? "bg-accent/20 text-accent"
                  : t.method === "GET"
                  ? "bg-[#3FB68B]/20 text-[#3FB68B]"
                  : "bg-[#E5534B]/20 text-[#E5534B]"
              }`}
            >
              {t.badge}
            </span>
            <span>{t.id === "create" ? "Create" : t.id === "list" ? "List" : "Delete"}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "create" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 id="create-endpoint" className="text-base font-bold text-text">
              Create Webhook Receiver Endpoint
            </h2>
            <p className="text-xs text-text-muted">{postSpec.description}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Request Body Parameters
            </h3>
            <ParamTable parameters={postSpec.parameters} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Request Example
            </h3>
            <CodeBlock snippets={postSpec.codeSnippets} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Response (201 Created)
            </h3>
            <div className="p-4 rounded-xl bg-surface border border-border">
              <JsonViewer data={postSpec.responseBodyExample} initialExpandedDepth={2} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "list" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 id="list-endpoints" className="text-base font-bold text-text">
              List Configured Webhook Endpoints
            </h2>
            <p className="text-xs text-text-muted">{listSpec.description}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Request Example
            </h3>
            <CodeBlock snippets={listSpec.codeSnippets} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Response (200 OK)
            </h3>
            <div className="p-4 rounded-xl bg-surface border border-border">
              <JsonViewer data={listSpec.responseBodyExample} initialExpandedDepth={2} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "delete" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 id="delete-endpoint" className="text-base font-bold text-text">
              Delete Webhook Endpoint
            </h2>
            <p className="text-xs text-text-muted">{deleteSpec.description}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Path Parameters
            </h3>
            <ParamTable parameters={deleteSpec.parameters} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Request Example
            </h3>
            <CodeBlock snippets={deleteSpec.codeSnippets} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Response (200 OK)
            </h3>
            <div className="p-4 rounded-xl bg-surface border border-border">
              <JsonViewer data={deleteSpec.responseBodyExample} initialExpandedDepth={2} />
            </div>
          </div>
        </div>
      )}

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "GET /usage", href: "/docs/endpoints/usage-get" }}
        next={{ title: "Webhook Events Catalogue", href: "/docs/endpoints/webhook-events" }}
      />
    </div>
  );
}
