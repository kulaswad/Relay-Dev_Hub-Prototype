"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DiffBadge } from "@/components/devhub";
import {
  AlertTriangle,
  Calendar,
  ShieldAlert,
  Rss,
  Mail,
  Check,
  Search,
  Filter,
  ArrowRight,
  Clock,
  ExternalLink,
} from "lucide-react";

export default function ChangelogPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [migrationNotice, setMigrationNotice] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedVersion, setSelectedVersion] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadChangelog() {
      try {
        const res = await fetch("/api/internal/changelog");
        const data = await res.json();
        if (data.entries) setEntries(data.entries);
        if (data.versions) setVersions(data.versions);
        if (data.userMigrationNotice) setMigrationNotice(data.userMigrationNotice);
        if (data.isSubscribedToBreakingChanges !== undefined) {
          setIsSubscribed(data.isSubscribedToBreakingChanges);
        }
        if (data.userEmail) setUserEmail(data.userEmail);
      } catch {}
      setLoading(false);
    }
    loadChangelog();
  }, []);

  const handleToggleSubscription = async () => {
    setSubscribing(true);
    const newStatus = !isSubscribed;
    try {
      const res = await fetch("/api/internal/changelog/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, subscribed: newStatus }),
      });
      if (res.ok) {
        setIsSubscribed(newStatus);
      }
    } catch {} finally {
      setSubscribing(false);
    }
  };

  // Filter entries
  const filteredEntries = entries.filter((e) => {
    if (selectedType !== "all" && e.type !== selectedType) return false;
    if (selectedVersion !== "all" && e.version !== selectedVersion) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchBody = e.body.toLowerCase().includes(q);
      const matchEndpoints = e.affectedEndpoints?.toLowerCase().includes(q);
      if (!matchTitle && !matchBody && !matchEndpoints) return false;
    }
    return true;
  });

  // Group by date
  const groupedByDate: Record<string, any[]> = {};
  filteredEntries.forEach((entry) => {
    if (!groupedByDate[entry.date]) groupedByDate[entry.date] = [];
    groupedByDate[entry.date].push(entry);
  });

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-10">
      {/* Header */}
      <div className="space-y-4 border-b border-border pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
                Changelog
              </span>
              <span className="text-xs font-mono text-text-muted">Release Notes & Sunsets</span>
            </div>
            <h1 className="text-3xl font-extrabold text-text tracking-tight mt-1">
              API Changelog & Deprecations
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="/changelog.xml"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-text-muted text-xs font-mono text-text transition-colors"
            >
              <Rss className="w-3.5 h-3.5 text-[#E0A93B]" />
              <span>RSS Feed</span>
            </a>

            <button
              onClick={handleToggleSubscription}
              disabled={subscribing}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isSubscribed
                  ? "bg-[#3FB68B]/10 border-[#3FB68B]/30 text-[#3FB68B]"
                  : "bg-surface-2 border-border text-text-muted hover:text-text"
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{isSubscribed ? "Subscribed to Breaking Alerts" : "Email me Breaking Alerts"}</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-text-muted leading-relaxed">
          Chronological record of new features, breaking schema adjustments, deprecation notices, and sunset countdowns across Relay API versions.
        </p>
      </div>

      {/* Personalized Logged-in Migration Notice */}
      {migrationNotice && (
        <div className="p-4 rounded-xl border border-[#E0A93B]/40 bg-[#E0A93B]/10 text-xs text-text space-y-2">
          <div className="flex items-center gap-2 font-bold text-[#E0A93B]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Personalized Migration Telemetry Alert</span>
          </div>
          <p className="text-text-muted leading-relaxed">
            Your key <code className="text-accent font-mono font-bold">{migrationNotice.keyId}</code> is pinned to deprecated version <code className="text-[#E5534B] font-mono">{migrationNotice.pinnedVersion}</code> and made <strong className="text-text">{migrationNotice.callsLast7Days} calls</strong> in the last 7 days.
          </p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#E0A93B] font-mono">
              ⚠️ Migrate before {migrationNotice.sunsetDate} to prevent service disruption.
            </span>
            <Link
              href="/docs/migrating-between-versions"
              className="text-accent hover:underline flex items-center gap-1 font-mono text-[11px] font-semibold"
            >
              <span>View Migration Steps</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border text-xs">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter by endpoint, feature, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs font-mono text-text outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-border text-xs font-mono text-text outline-none"
          >
            <option value="all">All Versions</option>
            <option value="v2025-10-01">v2025-10-01 (Current GA)</option>
            <option value="v2025-01-15">v2025-01-15 (Supported)</option>
            <option value="v2024-06-01">v2024-06-01 (Deprecated)</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-border text-xs font-mono text-text outline-none uppercase"
          >
            <option value="all">All Types</option>
            <option value="added">Added</option>
            <option value="changed">Changed</option>
            <option value="deprecated">Deprecated</option>
            <option value="removed">Removed</option>
            <option value="fixed">Fixed</option>
            <option value="security">Security</option>
          </select>
        </div>
      </div>

      {/* Timeline Stream */}
      {loading ? (
        <div className="p-12 text-center text-xs text-text-muted font-mono">
          Loading changelog stream...
        </div>
      ) : dates.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border bg-surface space-y-2 text-xs text-text-muted font-mono">
          <Calendar className="w-8 h-8 mx-auto text-text-muted/40" />
          <p>No changelog entries match your filters.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {dates.map((date) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-accent bg-surface px-2.5 py-1 rounded border border-border">
                  {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-4 pl-2 sm:pl-4 border-l border-border/60">
                {groupedByDate[date].map((entry) => {
                  let affectedEndpoints = [];
                  try {
                    affectedEndpoints = JSON.parse(entry.affectedEndpoints || "[]");
                  } catch {}

                  return (
                    <article
                      key={entry.id}
                      id={entry.id}
                      className="p-5 rounded-xl border border-border bg-surface space-y-3 hover:border-border/80 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <DiffBadge type={entry.type} />
                          <span className="font-mono text-xs font-bold text-text">
                            {entry.version}
                          </span>
                          {entry.breaking ? (
                            <span className="font-mono text-[10px] text-white bg-[#E5534B] px-2 py-0.2 rounded font-bold flex items-center gap-1 shadow-sm">
                              <ShieldAlert className="w-3 h-3" />
                              <span>BREAKING</span>
                            </span>
                          ) : null}
                        </div>

                        {entry.sunsetDate && (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-[#E0A93B] bg-[#E0A93B]/10 px-2 py-0.5 rounded border border-[#E0A93B]/30">
                            <Clock className="w-3 h-3" />
                            <span>Sunset: {entry.sunsetDate}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-text">{entry.title}</h3>
                        <p className="text-xs text-text-muted leading-relaxed">{entry.body}</p>
                      </div>

                      {affectedEndpoints.length > 0 && (
                        <div className="pt-2 border-t border-border flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-mono uppercase text-text-muted">
                            Affected:
                          </span>
                          {affectedEndpoints.map((ep: string) => (
                            <span
                              key={ep}
                              className="px-1.5 py-0.5 rounded bg-[#09090B] text-accent text-[10px] font-mono border border-border"
                            >
                              {ep}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
