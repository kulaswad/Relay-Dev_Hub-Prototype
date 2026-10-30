"use client";

import React, { useState, useEffect } from "react";
import { ERROR_REGISTRY, ErrorDefinition } from "@/lib/sandbox/errors";
import {
  Callout,
  JsonViewer,
  DocVersionBanner,
  DocFeedback,
  DocMeta,
  DocPaginationNav,
} from "@/components/devhub";
import { Search, AlertCircle, ShieldAlert, Zap, CheckCircle2, Copy, Check, Hash } from "lucide-react";

export default function ErrorsDocPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const allErrors = Object.values(ERROR_REGISTRY);

  const filteredErrors = allErrors.filter(
    (e) =>
      e.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.status.toString().includes(searchTerm)
  );

  // If URL has hash, scroll into view on load
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const id = window.location.hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth" });
        }, 150);
      }
    }
  }, []);

  const handleCopyLink = (code: string) => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/docs/errors#${code}`;
      navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-2 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            Error Catalogue
          </span>
          <span className="text-xs font-mono text-text-muted">Single Source of Truth</span>
        </div>
        <h1 className="text-3xl font-extrabold text-text tracking-tight mt-1">
          Standardized Error Codes Catalogue
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Relay APIs return consistent, actionable JSON error structures with machine-readable error codes, parameter pointers, HTTP status codes, and direct links to remediation guides.
        </p>
      </div>

      <div className="space-y-3">
        <h2 id="envelope" className="text-base font-bold text-text">Standard Error Envelope</h2>
        <p className="text-xs text-text-muted">
          All HTTP 4xx and 5xx responses conform to this structured JSON payload schema:
        </p>
        <div className="p-4 rounded-xl bg-surface border border-border">
          <JsonViewer
            data={{
              error: {
                type: "invalid_request_error",
                code: "invalid_phone_number",
                message: "The recipient phone '+9112345' is not a valid Indian E.164 mobile number (+91XXXXXXXXXX).",
                param: "to",
                doc_url: "/docs/errors#invalid_phone_number",
                request_id: "req_01jb9x82k49zqp",
              },
            }}
            initialExpandedDepth={2}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 id="directory" className="text-base font-bold text-text">
            Error Codes Directory ({filteredErrors.length} entries)
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by code, HTTP, or message..."
              className="w-full bg-[#09090B] border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredErrors.map((err) => (
            <div
              key={err.code}
              id={err.code}
              className="p-5 rounded-xl border border-border bg-surface space-y-4 hover:border-border/80 transition-all scroll-mt-20 group"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <a
                    href={`#${err.code}`}
                    className="font-mono text-sm font-bold text-accent hover:underline flex items-center gap-1"
                  >
                    <Hash className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span>{err.code}</span>
                  </a>
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded border font-semibold ${
                      err.status === 401 || err.status === 403 || err.status === 402
                        ? "text-[#E0A93B] bg-[#E0A93B]/10 border-[#E0A93B]/30"
                        : err.status === 429
                        ? "text-[#5B9DFF] bg-[#5B9DFF]/10 border-[#5B9DFF]/30"
                        : "text-[#E5534B] bg-[#E5534B]/10 border-[#E5534B]/30"
                    }`}
                  >
                    HTTP {err.status}
                  </span>
                  <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
                    {err.type}
                  </span>
                </div>

                <button
                  onClick={() => handleCopyLink(err.code)}
                  className="text-text-muted hover:text-text text-[11px] font-mono flex items-center gap-1 transition-colors"
                  title="Copy Anchor Link"
                >
                  {copiedCode === err.code ? (
                    <Check className="w-3 h-3 text-[#3FB68B]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedCode === err.code ? "Copied" : "Copy Anchor"}</span>
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-text font-semibold leading-relaxed">
                  {err.message}
                </p>
                <p className="text-xs text-text-muted leading-relaxed">
                  {err.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-lg bg-surface-2/60 border border-border/80 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-text-muted uppercase text-[10px] tracking-wider font-mono">
                    <AlertCircle className="w-3.5 h-3.5 text-[#E0A93B]" /> Common Causes
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-text-muted text-[11px] leading-relaxed">
                    {err.commonCauses.map((cause, idx) => (
                      <li key={idx}>{cause}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0C0C0F] border border-border space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-accent uppercase text-[10px] tracking-wider font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#3FB68B]" /> Remediation Steps
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-text-muted text-[11px] leading-relaxed">
                    {err.howToFix.map((fix, idx) => (
                      <li key={idx}>{fix}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Sample Error Response Envelope */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-mono uppercase text-text-muted">Sample Error Response:</span>
                <pre className="p-3 rounded-lg bg-[#09090B] border border-border text-[11px] font-mono text-accent overflow-x-auto whitespace-pre-wrap leading-relaxed">
{JSON.stringify(
  {
    error: {
      type: err.type,
      code: err.code,
      message: err.message,
      doc_url: `/docs/errors#${err.code}`,
      request_id: `req_err_${err.code.slice(0, 6)}_${Math.random().toString(36).substring(2, 6)}`,
    },
  },
  null,
  2
)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Webhook Events Catalogue", href: "/docs/endpoints/webhook-events" }}
        next={{ title: "Official SDKs & Samples", href: "/docs/sdks" }}
      />
    </div>
  );
}
