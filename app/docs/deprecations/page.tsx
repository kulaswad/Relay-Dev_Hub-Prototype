"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DiffBadge, DocVersionBanner, DocFeedback, DocMeta, DocPaginationNav } from "@/components/devhub";
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Calendar,
  CheckCircle2,
  GitBranch,
} from "lucide-react";

export default function DeprecationsDocPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [migrationNotice, setMigrationNotice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChangelog() {
      try {
        const res = await fetch("/api/internal/changelog");
        const data = await res.json();
        if (data.entries) {
          // Filter to only deprecation and breaking changes
          const deprecations = data.entries.filter(
            (e: any) => e.type === "deprecated" || e.type === "removed" || e.breaking === true
          );
          setEntries(deprecations);
        }
        if (data.userMigrationNotice) setMigrationNotice(data.userMigrationNotice);
      } catch {}
      setLoading(false);
    }
    loadChangelog();
  }, []);

  const calculateDaysRemaining = (sunsetDateStr: string | null) => {
    if (!sunsetDateStr) return null;
    const target = new Date(sunsetDateStr).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((target - now) / (1000 * 3600 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-[#E0A93B]/10 border-[#E0A93B]/30 text-[#E0A93B]">
            Deprecations & Sunsets
          </span>
          <span className="text-xs font-mono text-text-muted">Lifecycle Schedules</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          API Deprecations & Sunset Policy
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Relay maintains API versions for a minimum of 24 months after deprecation notices are issued. Below are all active deprecations, scheduled sunset dates, countdowns, and migration pathways.
        </p>
      </div>

      {/* Personalized Logged-in Migration Notice */}
      {migrationNotice && (
        <div className="p-4 rounded-xl border border-[#E0A93B]/40 bg-[#E0A93B]/10 text-xs text-text space-y-2">
          <div className="flex items-center gap-2 font-bold text-[#E0A93B]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Personalized Key Telemetry Warning</span>
          </div>
          <p className="text-text-muted leading-relaxed">
            Your key <code className="text-accent font-mono font-bold">{migrationNotice.keyId}</code> is pinned to deprecated version <code className="text-[#E5534B] font-mono">{migrationNotice.pinnedVersion}</code> and made <strong className="text-text">{migrationNotice.callsLast7Days} calls</strong> in the last 7 days.
          </p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#E0A93B] font-mono">
              Migrate before {migrationNotice.sunsetDate} to prevent incoming 400 version_unsupported errors.
            </span>
            <Link
              href="/docs/migrating-between-versions"
              className="text-accent hover:underline flex items-center gap-1 font-mono text-[11px] font-semibold"
            >
              <span>View Migration Checklist</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Deprecations Timeline */}
      <div className="space-y-6">
        <h2 id="active-deprecations" className="text-lg font-bold text-text">
          Scheduled Deprecations & Sunsets
        </h2>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted font-mono">
            Loading deprecation schedules...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border bg-surface text-xs text-text-muted font-mono">
            No active deprecation schedules found.
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((dep) => {
              const daysLeft = calculateDaysRemaining(dep.sunsetDate);
              let affectedEndpoints = [];
              try {
                affectedEndpoints = JSON.parse(dep.affectedEndpoints || "[]");
              } catch {}

              return (
                <div
                  key={dep.id}
                  className="p-5 rounded-xl border border-border bg-surface space-y-4 hover:border-border/80 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-accent px-2 py-0.5 rounded bg-surface-2 border border-border">
                        {dep.version}
                      </span>
                      {dep.breaking ? (
                        <span className="font-mono text-[10px] font-bold text-white bg-[#E5534B] px-2 py-0.5 rounded flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> BREAKING
                        </span>
                      ) : (
                        <DiffBadge type={dep.type} />
                      )}
                      <span className="text-xs font-bold text-text">{dep.title}</span>
                    </div>

                    {dep.sunsetDate && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#E5534B] bg-[#E5534B]/10 px-2 py-1 rounded border border-[#E5534B]/30 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{daysLeft} days remaining</span>
                        </span>
                        <span className="text-[11px] font-mono text-text-muted">
                          (Sunset: {dep.sunsetDate})
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed">{dep.body}</p>

                  {affectedEndpoints.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-mono uppercase text-text-muted font-semibold">
                        Affected Endpoints:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {affectedEndpoints.map((ep: string) => (
                          <span
                            key={ep}
                            className="px-2 py-0.5 rounded bg-[#09090B] text-accent text-[11px] font-mono border border-border"
                          >
                            {ep}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-text-muted text-[11px]">
                      Announced on {new Date(dep.date).toLocaleDateString()}
                    </span>
                    <Link
                      href="/docs/migrating-between-versions"
                      className="text-accent hover:underline flex items-center gap-1 font-mono text-[11px]"
                    >
                      <span>Read Migration Steps</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Compare Versions", href: "/docs/compare-versions" }}
        next={{ title: "Error Codes Catalogue", href: "/docs/errors" }}
      />
    </div>
  );
}
