"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/devhub";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Activity,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Zap,
} from "lucide-react";

interface ComponentStatus {
  id: string;
  name: string;
  status: string;
  latencyMs: number;
  uptime: string;
  description: string;
}

interface IncidentUpdate {
  timestamp: string;
  status: string;
  body: string;
}

interface Incident {
  id: string;
  title: string;
  status: string;
  severity: string;
  impact: string;
  summary: string;
  affectedComponents: string[];
  updates: IncidentUpdate[];
  createdAt: string;
  resolvedAt: string | null;
}

interface KnownIssue {
  id: string;
  title: string;
  service: string;
  workaround: string;
  status: string;
  ticketUrl: string | null;
  createdAt: string;
}

export default function StatusPage() {
  const [data, setData] = useState<{
    status: string;
    region: string;
    components: ComponentStatus[];
    incidents: Incident[];
    knownIssues: KnownIssue[];
    lastChecked: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  // Live sandbox ping tester
  const [pingRunning, setPingRunning] = useState(false);
  const [pingResult, setPingResult] = useState<{
    status: number;
    latencyMs: number;
    time: string;
    response: any;
  } | null>(null);

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/internal/status", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load status:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualPing = async () => {
    setPingRunning(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/v1/health", { cache: "no-store" });
      const duration = Math.round(performance.now() - start);
      let payload = null;
      try {
        payload = await res.json();
      } catch {}
      setPingResult({
        status: res.status,
        latencyMs: duration,
        time: new Date().toLocaleTimeString(),
        response: payload,
      });
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setPingResult({
        status: 503,
        latencyMs: duration,
        time: new Date().toLocaleTimeString(),
        response: { error: err.message || "Failed to reach health endpoint" },
      });
    } finally {
      setPingRunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-10">
      {/* Page Header */}
      <div className="space-y-4 border-b border-border pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <StatusPill
              variant={data?.status === "operational" ? "live" : "warning"}
              label={data?.status === "operational" ? "All Core Systems Operational" : "System Degraded"}
              size="sm"
            />
            <span className="text-[11px] font-mono text-text-muted">
              Region: {data?.region || "Mumbai (ap-south-1)"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-text tracking-tight">
            Relay Platform & Carrier Status
          </h1>
          <p className="text-sm text-text-muted leading-relaxed">
            Real-time telemetry across telecom aggregators (Airtel, Jio, Vi), OTT channels (RCS, WhatsApp), and the API Sandbox.
          </p>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            loadStatus();
          }}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text bg-surface-2 border border-border hover:border-text-muted rounded-lg transition-colors self-start md:self-end"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Live Sandbox Ping Card */}
      <div className="p-5 rounded-xl border border-accent/30 bg-accent/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                Live Sandbox Health Ping
                <span className="font-mono text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                  GET /api/v1/health
                </span>
              </h3>
              <p className="text-xs text-text-muted">
                Execute a direct HTTP probe against the live sandbox instance right now.
              </p>
            </div>
          </div>
          <button
            onClick={handleManualPing}
            disabled={pingRunning}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-accent text-background text-xs font-bold hover:bg-accent/90 transition-all shadow-sm"
          >
            <Zap className={`w-3.5 h-3.5 ${pingRunning ? "animate-pulse" : ""}`} />
            <span>{pingRunning ? "Pinging..." : "Ping Sandbox"}</span>
          </button>
        </div>

        {pingResult && (
          <div className="p-3 rounded-lg bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                pingResult.status === 200
                  ? "bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/30"
                  : "bg-[#E5534B]/15 text-[#E5534B] border border-[#E5534B]/30"
              }`}>
                HTTP {pingResult.status}
              </span>
              <span className="text-text">
                Latency: <span className="text-accent font-bold">{pingResult.latencyMs}ms</span>
              </span>
              <span className="text-text-muted text-[11px]">
                Timestamp: {pingResult.time}
              </span>
            </div>
            <div className="text-[11px] text-text-muted truncate max-w-xs">
              {JSON.stringify(pingResult.response)}
            </div>
          </div>
        )}
      </div>

      {/* 90-Day Uptime Banner */}
      <div className="p-4 rounded-xl border border-[#3FB68B]/30 bg-[#3FB68B]/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#3FB68B]" />
          <div>
            <h3 className="text-sm font-bold text-text">99.99% Average 90-Day Gateway Uptime</h3>
            <p className="text-xs text-text-muted">
              Telecom carrier binds, webhooks, and sandbox APIs are operating within normal SLA bounds.
            </p>
          </div>
        </div>
        <span className="font-mono text-xs text-[#3FB68B] font-bold">100% Delivery SLA</span>
      </div>

      {/* Components List */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-text flex items-center gap-2">
          <Terminal className="w-4 h-4 text-accent" />
          Infrastructure Components
        </h2>
        <div className="divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
          {data?.components?.map((svc) => (
            <div key={svc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text text-sm">{svc.name}</span>
                  <span className="font-mono text-[11px] text-text-muted">
                    {svc.latencyMs}ms
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">{svc.description}</p>
              </div>

              <div className="flex items-center gap-4 self-start sm:self-center">
                <span className="font-mono text-text-muted text-[11px]">{svc.uptime} uptime</span>
                <StatusPill
                  variant={svc.status === "operational" ? "success" : "warning"}
                  label={svc.status === "operational" ? "Operational" : "Degraded"}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active & Past Incidents */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-text flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#E0A93B]" />
          Recent Telecom Incidents & Maintenance
        </h2>

        {data?.incidents && data.incidents.length > 0 ? (
          <div className="space-y-3">
            {data.incidents.map((inc) => {
              const isExpanded = expandedIncident === inc.id;
              return (
                <div
                  key={inc.id}
                  className="rounded-xl border border-border bg-surface overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedIncident(isExpanded ? null : inc.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-2/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          inc.status === "resolved"
                            ? "bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/30"
                            : "bg-[#E0A93B]/15 text-[#E0A93B] border border-[#E0A93B]/30"
                        }`}>
                          {inc.status}
                        </span>
                        <h3 className="text-sm font-bold text-text">{inc.title}</h3>
                      </div>
                      <p className="text-xs text-text-muted">{inc.summary}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-text-muted font-mono hidden sm:inline">
                        {new Date(inc.createdAt).toLocaleDateString()}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-text-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 pt-2 border-t border-border bg-surface-2/20 space-y-3 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 border-b border-border/50 text-[11px]">
                        <div>
                          <span className="text-text-muted block">Severity:</span>
                          <span className="font-semibold text-text uppercase">{inc.severity}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block">Impact:</span>
                          <span className="font-semibold text-text">{inc.impact}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block">Resolved:</span>
                          <span className="font-semibold text-text">
                            {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleTimeString() : "Ongoing"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="font-bold text-text text-[11px]">Timeline Updates:</span>
                        <div className="space-y-2 border-l border-border pl-3">
                          {inc.updates?.map((u, idx) => (
                            <div key={idx} className="space-y-0.5">
                              <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
                                <span>{new Date(u.timestamp).toLocaleTimeString()}</span>
                                <span className="uppercase text-accent font-semibold">{u.status}</span>
                              </div>
                              <p className="text-xs text-text leading-relaxed">{u.body}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-border bg-surface text-center text-xs text-text-muted">
            No incidents reported in the last 90 days.
          </div>
        )}
      </div>

      {/* Known Issues List */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-text flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-accent" />
          Known Issues & Platform Advisories
        </h2>
        <div className="divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
          {data?.knownIssues?.map((issue) => (
            <div key={issue.id} className="p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] bg-surface-2 px-2 py-0.5 rounded border border-border text-text-muted">
                    {issue.service}
                  </span>
                  <span className="font-bold text-text text-sm">{issue.title}</span>
                </div>
                <StatusPill
                  variant={issue.status === "investigating" ? "warning" : "info"}
                  label={issue.status}
                  size="sm"
                />
              </div>

              <div className="p-3 rounded-lg bg-surface-2/40 border border-border/60 text-xs text-text-muted leading-relaxed">
                <span className="font-semibold text-text block mb-1">Workaround / Guidance:</span>
                {issue.workaround}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Escalation CTA */}
      <div className="p-5 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-text">Experiencing an unlisted degradation?</h3>
          <p className="text-xs text-text-muted">
            Report carrier deliverability dips or open our support drawer with auto-collected diagnostics.
          </p>
        </div>
        <Link
          href="/support"
          className="px-4 py-2 rounded-lg bg-surface-2 border border-border hover:border-text-muted text-text text-xs font-bold transition-all text-center"
        >
          Open Support Portal
        </Link>
      </div>
    </div>
  );
}