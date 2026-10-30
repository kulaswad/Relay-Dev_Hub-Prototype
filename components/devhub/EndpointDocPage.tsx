"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDevHub } from "@/components/providers/DevHubContext";
import { API_SPECIFICATION, EndpointSpec } from "@/lib/docs/api-spec";
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
import {
  Play,
  Key,
  Repeat,
  Gauge,
  Calendar,
  AlertCircle,
  ExternalLink,
  Sparkles,
  GitCommit,
  CheckCircle2,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EndpointDocPageProps {
  endpointId: string;
  prevPage?: { title: string; href: string };
  nextPage?: { title: string; href: string };
}

export function EndpointDocPage({
  endpointId,
  prevPage,
  nextPage,
}: EndpointDocPageProps) {
  const { apiVersion } = useDevHub();
  const spec = API_SPECIFICATION.find((e) => e.id === endpointId);

  const [activeResponseTab, setActiveResponseTab] = useState<string>("success");

  if (!spec) {
    return (
      <div className="p-8 text-center text-xs text-text-muted font-mono">
        Endpoint specification '{endpointId}' not found.
      </div>
    );
  }

  // Version overrides for request/response schemas
  const override = spec.versionOverrides?.[apiVersion];
  const parameters = override?.parameters || spec.parameters;
  const requestBodyExample = override?.requestBodyExample || spec.requestBodyExample;
  const responseBodyExample = override?.responseBodyExample || spec.responseBodyExample;

  const headerParams = parameters.filter((p) => p.in === "header");
  const pathParams = parameters.filter((p) => p.in === "path");
  const queryParams = parameters.filter((p) => p.in === "query");
  const bodyParams = parameters.filter((p) => p.in === "body");

  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      {/* Header */}
      <div className="space-y-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase",
              spec.method === "POST"
                ? "bg-accent/15 border-accent/30 text-accent"
                : spec.method === "GET"
                ? "bg-[#3FB68B]/15 border-[#3FB68B]/30 text-[#3FB68B]"
                : spec.method === "PUT"
                ? "bg-[#E0A93B]/15 border-[#E0A93B]/30 text-[#E0A93B]"
                : "bg-[#E5534B]/15 border-[#E5534B]/30 text-[#E5534B]"
            )}
          >
            {spec.method}
          </span>
          <code className="text-sm font-mono text-text font-bold">{spec.path}</code>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
              Since {spec.availableSince}
            </span>
            {spec.changedIn && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent">
                Updated in {spec.changedIn}
              </span>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight">{spec.title}</h1>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">{spec.description}</p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-text-muted uppercase">Required Scopes:</span>
            {spec.requiredScopes.length > 0 ? (
              spec.requiredScopes.map((scope) => (
                <span
                  key={scope}
                  className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-2 border border-border text-accent font-medium"
                >
                  {scope}
                </span>
              ))
            ) : (
              <span className="text-[11px] font-mono text-[#3FB68B]">None (Public)</span>
            )}
          </div>

          <Link
            href={`/console/playground?endpoint=${spec.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Try in Playground</span>
          </Link>
        </div>
      </div>

      {/* Version Specific Note if applicable */}
      {override?.notes && (
        <Callout type="warning" title={`Version Differences in ${apiVersion}`}>
          <p className="text-xs leading-relaxed">{override.notes}</p>
        </Callout>
      )}

      {/* Request Parameters Section */}
      <div className="space-y-6">
        <h2 id="parameters" className="text-base font-bold text-text">
          Request Parameters
        </h2>

        {headerParams.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Header Parameters
            </h3>
            <ParamTable parameters={headerParams} />
          </div>
        )}

        {pathParams.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Path Parameters
            </h3>
            <ParamTable parameters={pathParams} />
          </div>
        )}

        {queryParams.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Query Parameters
            </h3>
            <ParamTable parameters={queryParams} />
          </div>
        )}

        {bodyParams.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-semibold uppercase text-text-muted">
              Request Body Attributes
            </h3>
            <ParamTable parameters={bodyParams} />
          </div>
        )}
      </div>

      {/* Code Examples */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="code-examples" className="text-base font-bold text-text">
            Client Request Example
          </h2>
          <span className="text-[11px] font-mono text-text-muted">
            Remembered across docs
          </span>
        </div>

        <CodeBlock snippets={spec.codeSnippets} />
      </div>

      {/* Response Examples */}
      <div className="space-y-3">
        <h2 id="responses" className="text-base font-bold text-text">
          Response Examples
        </h2>

        <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveResponseTab("success")}
            className={cn(
              "px-3 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5",
              activeResponseTab === "success"
                ? "bg-[#3FB68B]/15 border border-[#3FB68B]/40 text-[#3FB68B]"
                : "text-text-muted hover:text-text"
            )}
          >
            <span>{spec.responseStatus} Success</span>
          </button>

          {(spec.errorExamples || []).map((err) => (
            <button
              key={err.code}
              onClick={() => setActiveResponseTab(err.code)}
              className={cn(
                "px-3 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5",
                activeResponseTab === err.code
                  ? "bg-[#E5534B]/15 border border-[#E5534B]/40 text-[#E5534B]"
                  : "text-text-muted hover:text-text"
              )}
            >
              <span>{err.status} {err.code}</span>
            </button>
          ))}
        </div>

        {activeResponseTab === "success" ? (
          <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
              <span>HTTP Status: {spec.responseStatus} OK</span>
              <span>Content-Type: application/json</span>
            </div>
            <JsonViewer data={responseBodyExample} initialExpandedDepth={3} />
          </div>
        ) : (
          (() => {
            const selectedErr = (spec.errorExamples || []).find(
              (e) => e.code === activeResponseTab
            );
            if (!selectedErr) return null;
            return (
              <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#E5534B] font-bold">
                    HTTP {selectedErr.status} — {selectedErr.title}
                  </span>
                  <Link
                    href={`/docs/errors#${selectedErr.code}`}
                    className="text-accent hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>View in Error Catalogue</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                <JsonViewer data={selectedErr.body} initialExpandedDepth={3} />
              </div>
            );
          })()
        )}
      </div>

      {/* Rate Limits & Idempotency Notes */}
      {(spec.rateLimitNote || spec.idempotencyNote) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {spec.rateLimitNote && (
            <div className="p-4 rounded-xl border border-border bg-surface space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-mono font-semibold text-text">
                <Gauge className="w-4 h-4 text-accent" />
                <span>Rate Limit Details</span>
              </div>
              <p className="text-text-muted leading-relaxed text-[11px]">{spec.rateLimitNote}</p>
            </div>
          )}

          {spec.idempotencyNote && (
            <div className="p-4 rounded-xl border border-border bg-surface space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-mono font-semibold text-text">
                <Repeat className="w-4 h-4 text-accent" />
                <span>Idempotency Guarantee</span>
              </div>
              <p className="text-text-muted leading-relaxed text-[11px]">{spec.idempotencyNote}</p>
            </div>
          )}
        </div>
      )}

      {/* Feedback & Meta */}
      <DocFeedback />
      <DocMeta />
      <DocPaginationNav prev={prevPage} next={nextPage} />
    </div>
  );
}
