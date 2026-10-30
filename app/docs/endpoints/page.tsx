"use client";

import React from "react";
import Link from "next/link";
import { API_SPECIFICATION } from "@/lib/docs/api-spec";
import { DocVersionBanner, DocFeedback, DocMeta } from "@/components/devhub";
import {
  Download,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Send,
  Activity,
  Layers,
  FileCode,
  Gauge,
  Webhook,
} from "lucide-react";

export default function EndpointsIndexPage() {
  const sections = Array.from(new Set(API_SPECIFICATION.map((e) => e.section)));

  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-2 border-b border-border pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold text-text tracking-tight">API Reference</h1>
          <div className="flex items-center gap-2">
            <a
              href="/api/openapi.json"
              target="_blank"
              download="relay-openapi.json"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-text-muted text-xs font-mono text-text transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-accent" />
              <span>OpenAPI Spec</span>
            </a>
            <a
              href="/api/postman.json"
              target="_blank"
              download="relay-postman-collection.json"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-text-muted text-xs font-mono text-text transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#3FB68B]" />
              <span>Postman Collection</span>
            </a>
          </div>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Comprehensive reference documentation for Relay's REST APIs. Authenticate requests using <code className="text-accent font-mono">Authorization: Bearer rl_test_...</code> or <code className="text-[#3FB68B] font-mono">rl_live_...</code>.
        </p>
      </div>

      <div className="space-y-8">
        {sections.map((section) => {
          const endpoints = API_SPECIFICATION.filter((e) => e.section === section);
          return (
            <div key={section} className="space-y-3">
              <h2 id={section.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="text-base font-bold text-text">
                {section}
              </h2>
              <div className="divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
                {endpoints.map((ep) => (
                  <Link
                    key={ep.id}
                    href={`/docs/endpoints/${ep.id}`}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/40 transition-colors group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                            ep.method === "POST"
                              ? "bg-accent/15 border-accent/30 text-accent"
                              : ep.method === "GET"
                              ? "bg-[#3FB68B]/15 border-[#3FB68B]/30 text-[#3FB68B]"
                              : ep.method === "PUT"
                              ? "bg-[#E0A93B]/15 border-[#E0A93B]/30 text-[#E0A93B]"
                              : "bg-[#E5534B]/15 border-[#E5534B]/30 text-[#E5534B]"
                          }`}
                        >
                          {ep.method}
                        </span>
                        <span className="font-mono text-xs font-bold text-text group-hover:text-accent transition-colors">
                          {ep.path}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">{ep.summary}</p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className="text-[10px] font-mono text-text-muted">Since {ep.availableSince}</span>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <DocFeedback />
      <DocMeta />
    </div>
  );
}
