"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useDevHub } from "@/components/providers/DevHubContext";
import {
  StatusPill,
  CopyField,
  Callout,
  JsonViewer,
  WebhookAiExplanation,
} from "@/components/devhub";
import {
  Activity,
  RotateCw,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Bug,
  ShieldAlert,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  Copy,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Layers,
  Send,
  Zap,
  RefreshCw,
  X,
  FileCode,
  CornerDownRight,
  Check,
} from "lucide-react";

interface WebhookDeliveryItem {
  id: string;
  eventId: string;
  endpointId: string;
  endpointUrl: string;
  endpointSecret: string;
  attemptNumber: number;
  requestHeaders: string;
  requestBody: string;
  responseStatus: number | null;
  responseHeaders: string | null;
  responseBody: string | null;
  durationMs: number | null;
  errorType: "none" | "timeout" | "connection_refused" | "http_5xx" | "http_4xx" | "signature_rejected" | "ssl_error";
  status: "success" | "failed" | "retrying" | "abandoned";
  scheduledAt: string | null;
  attemptedAt: string | null;
  nextRetryAt: string | null;
  replayOfId: string | null;
  eventType: string | null;
  eventCreatedAt: string | null;
}

interface ApiRequestItem {
  id: string;
  keyId: string;
  environment: "test" | "live";
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestHeaders: string;
  requestBody: string | null;
  responseBody: string | null;
  idempotencyKey: string | null;
  errorCode: string | null;
  requestId: string;
  billedAmountWouldBe: number | null;
  billedActual: number | null;
  currency: string | null;
  createdAt: string;
}

export default function LogsConsolePage() {
  const { environment, workspace } = useDevHub();
  const [tab, setTab] = useState<"webhooks" | "requests">("webhooks");

  // Data states
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [requests, setRequests] = useState<ApiRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer states
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDeliveryItem | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ApiRequestItem | null>(null);
  const [drawerTab, setDrawerTab] = useState<"request" | "response" | "timeline" | "entities">("request");

  // Action states
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [bulkReplaying, setBulkReplaying] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Inline Signature Verifier Modal inside Drawer
  const [isVerifierOpen, setIsVerifierOpen] = useState(false);
  const [verifierPayload, setVerifierPayload] = useState("");
  const [verifierHeader, setVerifierHeader] = useState("");
  const [verifierSecret, setVerifierSecret] = useState("");
  const [verifierResult, setVerifierResult] = useState<any>(null);
  const [verifierLoading, setVerifierLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tab,
        status: statusFilter,
        eventType: eventTypeFilter,
        search: searchQuery,
      });

      const res = await fetch(`/api/internal/logs?${params.toString()}`);
      const data = await res.json();
      if (tab === "webhooks") {
        setDeliveries(data.deliveries || []);
      } else {
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab, statusFilter, eventTypeFilter]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Replay single delivery
  const handleReplaySingle = async (deliveryId: string) => {
    setReplayingId(deliveryId);
    try {
      const res = await fetch("/api/internal/webhooks/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId, action: "replay" }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error);
      else {
        await loadData();
        if (data.delivery) {
          setSelectedDelivery(data.delivery);
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReplayingId(null);
    }
  };

  // Retry now for retrying delivery (skip schedule)
  const handleRetryNow = async (deliveryId: string) => {
    setReplayingId(deliveryId);
    try {
      const res = await fetch("/api/internal/webhooks/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId, action: "retry_now" }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error);
      else {
        await loadData();
        if (data.delivery) {
          setSelectedDelivery(data.delivery);
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReplayingId(null);
    }
  };

  // Bulk replay all failed
  const handleReplayAllFailed = async () => {
    if (!confirm("Replay all failed webhook deliveries (up to 100)?")) return;
    setBulkReplaying(true);
    try {
      const res = await fetch("/api/internal/webhooks/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replay_all_failed" }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Replayed ${data.replayedCount} deliveries`);
        await loadData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBulkReplaying(false);
    }
  };

  // Open Signature Verifier pre-populated
  const openSignatureVerifierForDelivery = (d: WebhookDeliveryItem) => {
    let sigHeader = "";
    try {
      const headers = JSON.parse(d.requestHeaders || "{}");
      sigHeader =
        headers["Relay-Signature"] ||
        headers["relay-signature"] ||
        headers["X-Relay-Signature"] ||
        "";
    } catch {}

    setVerifierPayload(d.requestBody || "");
    setVerifierHeader(sigHeader);
    setVerifierSecret(d.endpointSecret || "");
    setVerifierResult(null);
    setIsVerifierOpen(true);
  };

  const handleRunVerification = async () => {
    setVerifierLoading(true);
    try {
      const res = await fetch("/api/internal/logs/verify-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: verifierPayload,
          signatureHeader: verifierHeader,
          secret: verifierSecret,
        }),
      });
      const data = await res.json();
      setVerifierResult(data);
    } catch (err: any) {
      setVerifierResult({ isValid: false, message: err.message });
    } finally {
      setVerifierLoading(false);
    }
  };

  // Parse helper for JSON
  const safeParseJson = (str: string | null) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-text">Event Logs & Audits</h1>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                environment === "test"
                  ? "bg-[#E0A93B]/10 border-[#E0A93B]/30 text-[#E0A93B]"
                  : "bg-[#3FB68B]/10 border-[#3FB68B]/30 text-[#3FB68B]"
              }`}
            >
              {environment === "test" ? "Sandbox Audit Stream" : "Live Production Audit Stream"}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Complete cryptographic audit trail of all webhook deliveries and inbound API gateway requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {tab === "webhooks" && (
            <button
              onClick={handleReplayAllFailed}
              disabled={bulkReplaying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-border hover:border-text-muted text-xs font-semibold text-text transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 text-accent ${bulkReplaying ? "animate-spin" : ""}`} />
              <span>{bulkReplaying ? "Replaying All..." : "Replay All Failed (Max 100)"}</span>
            </button>
          )}

          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-text-muted text-xs font-semibold text-text transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => {
            setTab("webhooks");
            setSelectedDelivery(null);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
            tab === "webhooks"
              ? "bg-surface-2 text-text border border-border shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-accent" />
          <span>Webhook Deliveries ({deliveries.length})</span>
        </button>

        <button
          onClick={() => {
            setTab("requests");
            setSelectedRequest(null);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
            tab === "requests"
              ? "bg-surface-2 text-text border border-border shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-[#3FB68B]" />
          <span>API Requests ({requests.length})</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              tab === "webhooks"
                ? "Search by Event ID (evt_...), Delivery ID, or payload text..."
                : "Search by Request ID (req_...), Path, or Idempotency Key..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs font-mono text-text outline-none"
          />
        </form>

        <div className="flex items-center gap-2">
          {tab === "webhooks" && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-border text-xs font-mono text-text outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="success">Success (2xx)</option>
                <option value="failed">Failed (4xx/5xx)</option>
                <option value="retrying">Retrying (Scheduled)</option>
                <option value="abandoned">Abandoned (Exhausted)</option>
              </select>

              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-border text-xs font-mono text-text outline-none"
              >
                <option value="all">All Events</option>
                <option value="message.delivered">message.delivered</option>
                <option value="message.failed">message.failed</option>
                <option value="message.sent">message.sent</option>
                <option value="message.queued">message.queued</option>
                <option value="customer.profile.updated">customer.profile.updated</option>
                <option value="workspace.kyc.updated">workspace.kyc.updated</option>
              </select>
            </>
          )}

          <button
            onClick={loadData}
            className="px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface border border-border text-xs font-mono text-text transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="border border-border rounded-xl bg-surface overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-text-muted font-mono">
            Loading ledger audit stream...
          </div>
        ) : tab === "webhooks" ? (
          deliveries.length === 0 ? (
            <div className="p-12 text-center text-xs text-text-muted font-mono space-y-2">
              <Zap className="w-8 h-8 mx-auto text-text-muted/30" />
              <p>No webhook delivery attempts match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-[#0C0C0F] text-[11px] font-mono text-text-muted uppercase">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Destination Endpoint</th>
                    <th className="py-3 px-4">Attempt #</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Next Retry / Error</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {deliveries.map((d) => {
                    const isSuccess = d.responseStatus && d.responseStatus >= 200 && d.responseStatus < 300;
                    const is500Crash = d.responseStatus === 500;
                    const is401Sig = d.responseStatus === 401;

                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-surface-2/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedDelivery(d)}
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border inline-flex items-center gap-1 ${
                              isSuccess
                                ? "bg-[#3FB68B]/10 border-[#3FB68B]/30 text-[#3FB68B]"
                                : d.status === "retrying"
                                ? "bg-[#E0A93B]/10 border-[#E0A93B]/30 text-[#E0A93B]"
                                : "bg-[#E5534B]/10 border-[#E5534B]/30 text-[#E5534B]"
                            }`}
                          >
                            {d.responseStatus ? `HTTP ${d.responseStatus}` : d.status.toUpperCase()}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-text font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span>{d.eventType || "unknown.event"}</span>
                            {d.replayOfId && (
                              <span
                                className="px-1.5 py-0.2 rounded text-[10px] bg-accent/15 text-accent border border-accent/30"
                                title={`Replay of ${d.replayOfId}`}
                              >
                                Replay
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-text-muted block font-normal">
                            {d.eventId}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-text max-w-xs truncate">
                          <span className="truncate block" title={d.endpointUrl}>
                            {d.endpointUrl}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-text-muted">
                          <span>Attempt {d.attemptNumber} of 7</span>
                        </td>

                        <td className="py-3 px-4 text-text-muted">
                          {d.durationMs !== null ? `${d.durationMs}ms` : "-"}
                        </td>

                        <td className="py-3 px-4">
                          {d.status === "retrying" ? (
                            <span className="text-[#E0A93B] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                {d.nextRetryAt
                                  ? `Retry ${new Date(d.nextRetryAt).toLocaleTimeString()}`
                                  : "Scheduled"}
                              </span>
                            </span>
                          ) : d.errorType !== "none" ? (
                            <span
                              className={`text-[10px] uppercase font-bold ${
                                is500Crash ? "text-[#E5534B]" : is401Sig ? "text-[#E0A93B]" : "text-text-muted"
                              }`}
                            >
                              {d.errorType}
                            </span>
                          ) : (
                            <span className="text-[#3FB68B]">Delivered</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-text-muted">
                          {d.attemptedAt ? new Date(d.attemptedAt).toLocaleTimeString() : "-"}
                        </td>

                        <td
                          className="py-3 px-4 text-right space-x-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {d.status === "retrying" ? (
                            <button
                              onClick={() => handleRetryNow(d.id)}
                              disabled={replayingId === d.id}
                              className="px-2 py-1 rounded bg-[#E0A93B] hover:bg-[#E0A93B]/90 text-black font-semibold text-[11px] transition-colors inline-flex items-center gap-1"
                              title="Skip exponential delay and retry immediately"
                            >
                              <RotateCw className={`w-3 h-3 ${replayingId === d.id ? "animate-spin" : ""}`} />
                              <span>Retry Now</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReplaySingle(d.id)}
                              disabled={replayingId === d.id}
                              className="px-2 py-1 rounded bg-surface-2 hover:bg-surface border border-border hover:border-text-muted text-text font-medium text-[11px] transition-colors inline-flex items-center gap-1"
                              title="Replay this exact event delivery"
                            >
                              <RotateCw className={`w-3 h-3 text-accent ${replayingId === d.id ? "animate-spin" : ""}`} />
                              <span>Replay</span>
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedDelivery(d)}
                            className="px-2 py-1 rounded bg-surface-2 hover:bg-surface border border-border text-text-muted hover:text-text font-medium text-[11px] transition-colors"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // API Requests Table
          requests.length === 0 ? (
            <div className="p-12 text-center text-xs text-text-muted font-mono space-y-2">
              <Terminal className="w-8 h-8 mx-auto text-text-muted/30" />
              <p>No inbound API gateway requests match your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-[#0C0C0F] text-[11px] font-mono text-text-muted uppercase">
                    <th className="py-3 px-4">Method & Status</th>
                    <th className="py-3 px-4">Endpoint Path</th>
                    <th className="py-3 px-4">Key ID</th>
                    <th className="py-3 px-4">Latency</th>
                    <th className="py-3 px-4">Request ID</th>
                    <th className="py-3 px-4">Billed Cost</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {requests.map((r) => {
                    const isSuccess = r.status >= 200 && r.status < 300;
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-surface-2/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedRequest(r)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                r.method === "POST"
                                  ? "bg-accent/15 border-accent/30 text-accent"
                                  : "bg-[#3FB68B]/15 border-[#3FB68B]/30 text-[#3FB68B]"
                              }`}
                            >
                              {r.method}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                isSuccess
                                  ? "text-[#3FB68B]"
                                  : r.status === 429
                                  ? "text-[#E0A93B]"
                                  : "text-[#E5534B]"
                              }`}
                            >
                              {r.status}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-semibold text-text">
                          {r.path}
                        </td>

                        <td className="py-3 px-4 text-text-muted">
                          {r.keyId}
                        </td>

                        <td className="py-3 px-4 text-text-muted">
                          {r.durationMs}ms
                        </td>

                        <td className="py-3 px-4 text-text-muted">
                          {r.requestId}
                        </td>

                        <td className="py-3 px-4 text-text-muted">
                          {r.environment === "test" ? (
                            <span className="text-text-muted">₹0 (Test)</span>
                          ) : (
                            <span className="text-[#3FB68B]">
                              ₹{r.billedActual !== null ? r.billedActual.toFixed(4) : "0.00"}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-text-muted">
                          {new Date(r.createdAt).toLocaleTimeString()}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedRequest(r)}
                            className="px-2 py-1 rounded bg-surface-2 hover:bg-surface border border-border text-text-muted hover:text-text font-medium text-[11px] transition-colors"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Slide-over Detail Drawer for Webhook Delivery */}
      {selectedDelivery && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[#0C0C0F] border-l border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border flex items-start justify-between bg-surface">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded font-bold border ${
                      selectedDelivery.responseStatus && selectedDelivery.responseStatus < 300
                        ? "bg-[#3FB68B]/15 text-[#3FB68B] border-[#3FB68B]/30"
                        : selectedDelivery.status === "retrying"
                        ? "bg-[#E0A93B]/15 text-[#E0A93B] border-[#E0A93B]/30"
                        : "bg-[#E5534B]/15 text-[#E5534B] border-[#E5534B]/30"
                    }`}
                  >
                    {selectedDelivery.responseStatus
                      ? `HTTP ${selectedDelivery.responseStatus}`
                      : selectedDelivery.status.toUpperCase()}
                  </span>
                  <span className="font-mono text-sm font-bold text-text">
                    {selectedDelivery.eventType}
                  </span>
                  {selectedDelivery.replayOfId && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent/15 text-accent border border-accent/30">
                      Replay of {selectedDelivery.replayOfId.slice(0, 12)}...
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-text-muted flex items-center gap-2">
                  <span>ID: {selectedDelivery.id}</span>
                  <span>•</span>
                  <span>Event: {selectedDelivery.eventId}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedDelivery(null)}
                className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper / Timeline Banner */}
            <div className="p-4 bg-surface-2/40 border-b border-border space-y-2">
              <div className="text-[11px] font-mono uppercase text-text-muted tracking-wider flex items-center justify-between">
                <span>Attempt Timeline & Circuit State</span>
                <span className="text-text">
                  Attempt {selectedDelivery.attemptNumber} of 7 (
                  {selectedDelivery.durationMs !== null ? `${selectedDelivery.durationMs}ms` : "-"})
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <div className="flex-1 bg-surface p-2 rounded-lg border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedDelivery.responseStatus && selectedDelivery.responseStatus < 300
                          ? "bg-[#3FB68B]"
                          : "bg-[#E5534B]"
                      }`}
                    />
                    <span className="text-text">
                      Attempt #{selectedDelivery.attemptNumber}
                    </span>
                  </div>
                  <span className="text-text-muted text-[11px]">
                    {selectedDelivery.attemptedAt ? new Date(selectedDelivery.attemptedAt).toLocaleTimeString() : "-"}
                  </span>
                </div>

                {selectedDelivery.status === "retrying" && (
                  <>
                    <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                    <div className="flex-1 bg-[#E0A93B]/10 p-2 rounded-lg border border-[#E0A93B]/30 flex items-center justify-between text-[#E0A93B]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Next Retry</span>
                      </div>
                      <span className="text-[11px] font-bold">
                        {selectedDelivery.nextRetryAt
                          ? new Date(selectedDelivery.nextRetryAt).toLocaleTimeString()
                          : "Scheduled"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Automated AI & Deterministic Diagnostics for Failed Webhooks */}
            {(selectedDelivery.status !== "success" ||
              (selectedDelivery.responseStatus && selectedDelivery.responseStatus >= 400)) && (
              <div className="px-4 pt-4">
                <WebhookAiExplanation
                  deliveryId={selectedDelivery.id}
                  onReplay={handleReplaySingle}
                  isReplaying={replayingId === selectedDelivery.id}
                />
              </div>
            )}

            {/* Drawer Tabs */}
            <div className="px-5 border-b border-border flex items-center gap-4 text-xs font-mono">
              <button
                onClick={() => setDrawerTab("request")}
                className={`py-3 border-b-2 font-medium transition-colors ${
                  drawerTab === "request"
                    ? "border-accent text-text"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                Request Headers & Body
              </button>
              <button
                onClick={() => setDrawerTab("response")}
                className={`py-3 border-b-2 font-medium transition-colors ${
                  drawerTab === "response"
                    ? "border-accent text-text"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                Recipient Response
              </button>
              <button
                onClick={() => setDrawerTab("entities")}
                className={`py-3 border-b-2 font-medium transition-colors ${
                  drawerTab === "entities"
                    ? "border-accent text-text"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                Related Entities
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {drawerTab === "request" && (
                <div className="space-y-4">
                  {/* Headers */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono uppercase text-text-muted">
                      <span>Request Headers</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedDelivery.requestHeaders);
                          setCopiedRaw(true);
                          setTimeout(() => setCopiedRaw(false), 2000);
                        }}
                        className="text-accent hover:underline flex items-center gap-1"
                      >
                        {copiedRaw ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>Copy Headers</span>
                      </button>
                    </div>

                    <pre className="p-3 rounded-xl bg-[#09090B] border border-border text-xs font-mono text-accent overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(safeParseJson(selectedDelivery.requestHeaders), null, 2)}
                    </pre>
                  </div>

                  {/* Relay-Signature shortcut button */}
                  <div className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-text font-mono">HMAC Cryptographic Header</span>
                      <p className="text-[11px] text-text-muted">
                        Test this delivery's raw payload against the endpoint's signing secret.
                      </p>
                    </div>
                    <button
                      onClick={() => openSignatureVerifierForDelivery(selectedDelivery)}
                      className="px-3 py-1.5 rounded-lg bg-accent text-white font-mono text-xs font-semibold hover:bg-accent/90 transition-colors flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify Here</span>
                    </button>
                  </div>

                  {/* Body */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono uppercase text-text-muted">
                      <span>Raw Request Body Payload</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedDelivery.requestBody);
                          setCopiedRaw(true);
                          setTimeout(() => setCopiedRaw(false), 2000);
                        }}
                        className="text-accent hover:underline flex items-center gap-1"
                      >
                        {copiedRaw ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>Copy Raw Bytes</span>
                      </button>
                    </div>

                    <JsonViewer
                      data={safeParseJson(selectedDelivery.requestBody)}
                      initialExpandedDepth={3}
                    />
                  </div>
                </div>
              )}

              {drawerTab === "response" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono uppercase text-text-muted">
                      Recipient HTTP Status & Latency
                    </div>
                    <div className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between font-mono text-xs">
                      <span className="text-text font-bold">
                        HTTP {selectedDelivery.responseStatus || "Connection Failed"}
                      </span>
                      <span className="text-text-muted">
                        Response Duration: {selectedDelivery.durationMs}ms
                      </span>
                    </div>
                  </div>

                  {selectedDelivery.responseHeaders && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-mono uppercase text-text-muted">
                        Response Headers
                      </div>
                      <pre className="p-3 rounded-xl bg-[#09090B] border border-border text-xs font-mono text-text overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(safeParseJson(selectedDelivery.responseHeaders), null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono uppercase text-text-muted">
                      Response Body (Server Output)
                    </div>
                    <pre
                      className={`p-3.5 rounded-xl border font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72 ${
                        selectedDelivery.responseStatus && selectedDelivery.responseStatus >= 500
                          ? "bg-[#E5534B]/10 border-[#E5534B]/30 text-[#E5534B]"
                          : "bg-[#09090B] border border-border text-text"
                      }`}
                    >
                      {selectedDelivery.responseBody || "<Empty response body>"}
                    </pre>
                  </div>
                </div>
              )}

              {drawerTab === "entities" && (
                <div className="space-y-3">
                  <div className="text-xs text-text-muted">
                    Related entities linked to this webhook delivery:
                  </div>

                  {/* Try parsing payload to find links */}
                  {(() => {
                    const parsed = safeParseJson(selectedDelivery.requestBody);
                    const msgId = parsed?.data?.object?.id || parsed?.data?.id;
                    const custId = parsed?.data?.object?.external_id || parsed?.data?.external_id;

                    return (
                      <div className="space-y-2">
                        {msgId && (
                          <div className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between text-xs">
                            <div className="space-y-0.5 font-mono">
                              <span className="text-text-muted text-[11px]">Message Record:</span>
                              <div className="text-accent font-semibold">{msgId}</div>
                            </div>
                            <Link
                              href={`/console/playground?messageId=${msgId}`}
                              className="px-2.5 py-1 rounded bg-surface-2 hover:bg-surface border border-border text-text flex items-center gap-1 font-mono text-[11px]"
                            >
                              <span>Inspect in Playground</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        )}

                        {custId && (
                          <div className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between text-xs">
                            <div className="space-y-0.5 font-mono">
                              <span className="text-text-muted text-[11px]">Customer CDP Profile:</span>
                              <div className="text-[#3FB68B] font-semibold">{custId}</div>
                            </div>
                            <span className="text-[11px] font-mono text-text-muted">
                              Unified CDP Ledger
                            </span>
                          </div>
                        )}

                        <div className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between text-xs">
                          <div className="space-y-0.5 font-mono">
                            <span className="text-text-muted text-[11px]">Destination Webhook:</span>
                            <div className="text-text truncate max-w-sm">{selectedDelivery.endpointUrl}</div>
                          </div>
                          <Link
                            href="/console/webhooks"
                            className="px-2.5 py-1 rounded bg-surface-2 hover:bg-surface border border-border text-text flex items-center gap-1 font-mono text-[11px]"
                          >
                            <span>Manage Endpoint</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Drawer Action Footer */}
            <div className="p-4 border-t border-border bg-surface flex items-center justify-between">
              <div className="text-[11px] font-mono text-text-muted">
                Endpoint: <span className="text-text">{selectedDelivery.endpointId}</span>
              </div>

              <div className="flex items-center gap-2">
                {selectedDelivery.status === "retrying" ? (
                  <button
                    onClick={() => handleRetryNow(selectedDelivery.id)}
                    disabled={replayingId === selectedDelivery.id}
                    className="px-3.5 py-2 rounded-lg bg-[#E0A93B] hover:bg-[#E0A93B]/90 text-black font-semibold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${replayingId === selectedDelivery.id ? "animate-spin" : ""}`} />
                    <span>Retry Immediately (Skip Wait)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleReplaySingle(selectedDelivery.id)}
                    disabled={replayingId === selectedDelivery.id}
                    className="px-3.5 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${replayingId === selectedDelivery.id ? "animate-spin" : ""}`} />
                    <span>Replay Delivery</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Detail Drawer for API Request */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[#0C0C0F] border-l border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border flex items-start justify-between bg-surface">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded font-bold border ${
                      selectedRequest.status >= 200 && selectedRequest.status < 300
                        ? "bg-[#3FB68B]/15 text-[#3FB68B] border-[#3FB68B]/30"
                        : "bg-[#E5534B]/15 text-[#E5534B] border-[#E5534B]/30"
                    }`}
                  >
                    HTTP {selectedRequest.status}
                  </span>
                  <span className="font-mono text-sm font-bold text-text">
                    {selectedRequest.method} {selectedRequest.path}
                  </span>
                </div>
                <div className="text-xs font-mono text-text-muted flex items-center gap-2">
                  <span>Req ID: {selectedRequest.requestId}</span>
                  <span>•</span>
                  <span>Key: {selectedRequest.keyId}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Request Meta */}
            <div className="p-4 bg-surface-2/40 border-b border-border grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-surface border border-border">
                <div className="text-[10px] text-text-muted uppercase">Latency</div>
                <div className="font-bold text-text">{selectedRequest.durationMs}ms</div>
              </div>
              <div className="p-2 rounded-lg bg-surface border border-border">
                <div className="text-[10px] text-text-muted uppercase">Environment</div>
                <div className="font-bold text-text">{selectedRequest.environment.toUpperCase()}</div>
              </div>
              <div className="p-2 rounded-lg bg-surface border border-border">
                <div className="text-[10px] text-text-muted uppercase">Tariff Charged</div>
                <div className="font-bold text-[#3FB68B]">
                  ₹{selectedRequest.billedActual !== null ? selectedRequest.billedActual.toFixed(4) : "0.00"}
                </div>
              </div>
            </div>

            {/* Request Body & Response */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-text-muted">
                  Inbound Request Headers
                </div>
                <pre className="p-3 rounded-xl bg-[#09090B] border border-border text-xs font-mono text-accent overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(safeParseJson(selectedRequest.requestHeaders), null, 2)}
                </pre>
              </div>

              {selectedRequest.requestBody && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono uppercase text-text-muted">
                    Inbound Request Body
                  </div>
                  <JsonViewer
                    data={safeParseJson(selectedRequest.requestBody)}
                    initialExpandedDepth={2}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-text-muted">
                  Gateway Response Body
                </div>
                <JsonViewer
                  data={safeParseJson(selectedRequest.responseBody)}
                  initialExpandedDepth={3}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Signature Verifier Modal (from Drawer shortcut) */}
      {isVerifierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <h3 className="text-base font-bold text-text">Verify Relay-Signature</h3>
              </div>
              <button
                onClick={() => setIsVerifierOpen(false)}
                className="text-text-muted hover:text-text text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                  Relay-Signature Header
                </label>
                <input
                  type="text"
                  value={verifierHeader}
                  onChange={(e) => setVerifierHeader(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs font-mono text-text outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                  Endpoint Signing Secret
                </label>
                <input
                  type="text"
                  value={verifierSecret}
                  onChange={(e) => setVerifierSecret(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs font-mono text-text outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                  Raw Payload Bytes
                </label>
                <textarea
                  rows={4}
                  value={verifierPayload}
                  onChange={(e) => setVerifierPayload(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs font-mono text-text outline-none resize-none"
                />
              </div>

              <button
                onClick={handleRunVerification}
                disabled={verifierLoading}
                className="w-full py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{verifierLoading ? "Testing HMAC..." : "Run HMAC Diagnostic Check"}</span>
              </button>

              {verifierResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    verifierResult.isValid
                      ? "bg-[#3FB68B]/10 border-[#3FB68B]/30 text-[#3FB68B]"
                      : "bg-[#E5534B]/10 border-[#E5534B]/30 text-[#E5534B]"
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {verifierResult.isValid ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <ShieldAlert className="w-4 h-4" />
                    )}
                    <span>{verifierResult.isValid ? "VERIFICATION SUCCESS" : "VERIFICATION FAILED"}</span>
                  </div>
                  <p className="text-text">{verifierResult.message}</p>
                  {verifierResult.hint && (
                    <div className="p-2 rounded bg-surface border border-accent/30 text-accent text-[11px]">
                      <strong>Diagnostic:</strong> {verifierResult.hint}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
