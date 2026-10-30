"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useDevHub } from "@/components/providers/DevHubContext";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  Percent,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  Sliders,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
  Zap,
} from "lucide-react";

interface UsageData {
  environment: "test" | "live";
  range: "1h" | "24h" | "7d" | "30d";
  workspace: {
    id: string;
    name: string;
    planTier: string;
    rateLimitPerMin: number;
    monthlyQuota: number;
    walletBalance: number;
  };
  overview: {
    totalRequests: number;
    successfulRequests: number;
    clientErrors: number;
    serverErrors: number;
    errorRate: string;
    p50LatencyMs: number;
    p95LatencyMs: number;
    avgLatencyMs: number;
  };
  requestsOverTime: Array<{
    bucketIndex: number;
    startTime: number;
    label: string;
    count2xx: number;
    count4xx: number;
    count5xx: number;
    total: number;
  }>;
  topEndpoints: Array<{
    path: string;
    count: number;
    errors: number;
    errorRate: string;
    avgDuration: number;
  }>;
  topErrorCodes: Array<{
    code: string;
    count: number;
    lastSeen: string;
    docUrl: string;
    logsUrl: string;
    definition: {
      code: string;
      type: string;
      status: number;
      message: string;
      description: string;
      commonCauses: string[];
      howToFix: string[];
      docUrl: string;
    };
  }>;
  perKeyBreakdown: Array<{
    id: string;
    name: string;
    prefix: string;
    secretMasked: string;
    environment: string;
    status: string;
    requestCount: number;
    errorCount: number;
    errorRate: string;
    lastUsedAt: string | null;
  }>;
  rateLimitsAndQuotas: {
    planTier: string;
    rateLimitPerMin: number;
    currentMinuteUsage: number;
    currentMinuteRemaining: number;
    currentMinuteReset: number;
    monthlyQuota: number;
    monthlyQuotaUsed: number;
    monthlyQuotaRemaining: number;
    projectedExhaustionDate: string | null;
    tierSpecs: {
      tps: number;
      reqPerMin: number;
      burst: number;
      eventBatchSize: number;
      webhookEndpoints: number;
    };
    allTiers: Record<
      string,
      {
        tps: number;
        reqPerMin: number;
        burst: number;
        eventBatchSize: number;
        webhookEndpoints: number;
      }
    >;
    recent429Hits: Array<{
      id: string;
      path: string;
      method: string;
      createdAt: string;
      keyId: string | null;
      ip: string;
      retryAfter: number;
      message: string;
    }>;
  };
  costVisibility: {
    environment: string;
    testWouldHaveCost: number;
    liveCharged: number;
    walletBalance: number;
    lowBalanceThreshold: number;
    channelBreakdown: {
      sms: { count: number; cost: number; rate: number };
      rcs: { count: number; cost: number; rate: number };
      whatsapp: { count: number; cost: number; rate: number };
    };
    costPerDay: Array<{
      date: string;
      smsCost: number;
      rcsCost: number;
      whatsappCost: number;
      totalCost: number;
    }>;
  };
  errorsView: Array<{
    errorCode: string;
    path: string;
    count: number;
    lastSeen: string;
    sampleRequestId: string;
    sampleStatus: number;
    samplePayload: any;
    sampleResponse: any;
    logsUrl: string;
    errorDefinition: {
      code: string;
      type: string;
      status: number;
      message: string;
      description: string;
      commonCauses: string[];
      howToFix: string[];
      docUrl: string;
    };
  }>;
}

export default function UsagePage() {
  const { environment, setEnvironment } = useDevHub();
  const [range, setRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [activeTab, setActiveTab] = useState<"overview" | "limits" | "cost" | "errors">("overview");
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedError, setSelectedError] = useState<string | null>(null);

  // Higher limits modal state
  const [isLimitsModalOpen, setIsLimitsModalOpen] = useState(false);
  const [requestedTps, setRequestedTps] = useState(250);
  const [limitReason, setLimitReason] = useState("");
  const [limitChannels, setLimitChannels] = useState<string[]>(["sms", "rcs", "whatsapp"]);
  const [submittingLimit, setSubmittingLimit] = useState(false);
  const [limitSuccessMsg, setLimitSuccessMsg] = useState<string | null>(null);

  // Alert preferences state
  const [alertThreshold80, setAlertThreshold80] = useState(true);
  const [alertThreshold95, setAlertThreshold95] = useState(true);
  const [alertSpike429, setAlertSpike429] = useState(true);
  const [alertEmailNotify, setAlertEmailNotify] = useState(true);
  const [alertEmail, setAlertEmail] = useState("alerts@acmepay.in");
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(500);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertToast, setAlertToast] = useState<string | null>(null);

  // Cost calculator state
  const [calcSmsCount, setCalcSmsCount] = useState(50000);
  const [calcRcsCount, setCalcRcsCount] = useState(20000);
  const [calcWaCount, setCalcWaCount] = useState(15000);

  // Code snippet tab for 429
  const [backoffSnippetLang, setBackoffSnippetLang] = useState<"ts" | "py" | "curl">("ts");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Fetch Usage Data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`/api/internal/usage?range=${range}&environment=${environment}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Failed to load usage data", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [range, environment]);

  // Fetch Alert Preferences
  useEffect(() => {
    async function loadAlerts() {
      try {
        const res = await fetch("/api/internal/usage/alerts");
        if (res.ok) {
          const pref = await res.json();
          setAlertThreshold80(pref.threshold80 ?? true);
          setAlertThreshold95(pref.threshold95 ?? true);
          setAlertSpike429(pref.spike429 ?? true);
          setAlertEmailNotify(pref.emailNotifications ?? true);
          if (pref.notificationEmail) setAlertEmail(pref.notificationEmail);
          if (pref.lowBalanceThreshold) setLowBalanceThreshold(pref.lowBalanceThreshold);
        }
      } catch (err) {
        console.error("Failed to load alert preferences", err);
      }
    }
    loadAlerts();
  }, []);

  // Initial and polling fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time polling every 3 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Handle Save Alerts
  const handleSaveAlerts = async (sendTest = false) => {
    setSavingAlerts(true);
    setAlertToast(null);
    try {
      const res = await fetch("/api/internal/usage/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threshold80: alertThreshold80,
          threshold95: alertThreshold95,
          spike429: alertSpike429,
          lowBalanceThreshold,
          emailNotifications: alertEmailNotify,
          notificationEmail: alertEmail,
          testAlert: sendTest,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setAlertToast(
          sendTest
            ? `✅ Simulated alert email sent to ${alertEmail} and logged to notifications!`
            : "✅ Alert preferences saved successfully."
        );
        setTimeout(() => setAlertToast(null), 5000);
      } else {
        setAlertToast(`❌ Error: ${result.error || "Failed to save"}`);
      }
    } catch (err: any) {
      setAlertToast(`❌ Error: ${err.message}`);
    } finally {
      setSavingAlerts(false);
    }
  };

  // Handle Limit Elevation Request
  const handleSubmitLimitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLimit(true);
    setLimitSuccessMsg(null);
    try {
      const res = await fetch("/api/internal/usage/limits-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedTps: Number(requestedTps),
          reason: limitReason,
          channels: limitChannels,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setLimitSuccessMsg(result.message);
        setTimeout(() => {
          setIsLimitsModalOpen(false);
          setLimitSuccessMsg(null);
          setLimitReason("");
        }, 3000);
      } else {
        alert(result.error || "Failed to submit limit elevation request");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setSubmittingLimit(false);
    }
  };

  // Calculated cost estimator
  const calcTotals = useMemo(() => {
    const smsCost = calcSmsCount * 0.12;
    const rcsCost = calcRcsCount * 0.2;
    const waCost = calcWaCount * 0.35;
    const subtotal = smsCost + rcsCost + waCost;
    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    return { smsCost, rcsCost, waCost, subtotal, gst, total };
  }, [calcSmsCount, calcRcsCount, calcWaCount]);

  // Max bucket count for stacked chart scaling
  const maxBucketTotal = useMemo(() => {
    if (!data?.requestsOverTime || data.requestsOverTime.length === 0) return 10;
    const maxVal = Math.max(...data.requestsOverTime.map((b) => b.total));
    return maxVal > 0 ? maxVal : 10;
  }, [data]);

  // Rate limiter consumption percent
  const rateLimitPercent = useMemo(() => {
    if (!data?.rateLimitsAndQuotas) return 0;
    const { currentMinuteUsage, rateLimitPerMin } = data.rateLimitsAndQuotas;
    return Math.min(100, Math.round((currentMinuteUsage / (rateLimitPerMin || 60)) * 100));
  }, [data]);

  // Monthly quota consumption percent
  const quotaPercent = useMemo(() => {
    if (!data?.rateLimitsAndQuotas) return 0;
    const { monthlyQuotaUsed, monthlyQuota } = data.rateLimitsAndQuotas;
    return Math.min(100, Math.round((monthlyQuotaUsed / (monthlyQuota || 25000)) * 100));
  }, [data]);

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const backoffCodeTs = `// Exponential backoff with jitter on Relay HTTP 429
async function relayApiCall<T>(url: string, options: RequestInit, retries = 4): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (res.status === 429 && retries > 0) {
      // Read Retry-After header (seconds) or fallback to exponential curve
      const retryAfterSec = parseInt(res.headers.get("Retry-After") || "1", 10);
      const jitterMs = Math.floor(Math.random() * 250);
      const delayMs = (retryAfterSec * 1000) + jitterMs;
      console.warn(\`[Relay 429] Rate limit hit. Backing off for \${delayMs}ms (\${retries} retries left)\`);
      await new Promise((r) => setTimeout(r, delayMs));
      return relayApiCall<T>(url, options, retries - 1);
    }
    if (!res.ok) {
      const errPayload = await res.json();
      throw new Error(errPayload.error?.message || \`HTTP \${res.status}\`);
    }
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return relayApiCall<T>(url, options, retries - 1);
    }
    throw err;
  }
}`;

  const backoffCodePy = `# Python backoff handling for Relay HTTP 429
import time
import random
import requests

def send_with_backoff(url, headers, json_data, max_retries=4):
    for attempt in range(max_retries):
        resp = requests.post(url, headers=headers, json=json_data)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 1))
            jitter = random.uniform(0.05, 0.25)
            delay = retry_after + jitter
            print(f"[Relay 429] Rate limit hit. Backing off for {delay:.2f}s...")
            time.sleep(delay)
            continue
        resp.raise_for_status()
        return resp.json()
    raise Exception("Max rate limit retries exceeded")`;

  const backoffCodeCurl = `# cURL with retry flags for 429 response
curl -X POST https://api.relay.internal/v1/messages \\
  -H "Authorization: Bearer rk_test_..." \\
  -H "Content-Type: application/json" \\
  --retry 4 \\
  --retry-delay 1 \\
  --retry-max-time 10 \\
  -d '{"channel":"sms","to":"+919876543210","body":"OTP: 489102"}'`;

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text">Usage, Limits & Errors</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border ${
                environment === "test"
                  ? "bg-[#7C7CFF]/10 text-[#7C7CFF] border-[#7C7CFF]/30"
                  : "bg-[#3FB68B]/10 text-[#3FB68B] border-[#3FB68B]/30"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  environment === "test" ? "bg-[#7C7CFF]" : "bg-[#3FB68B]"
                }`}
              />
              {environment.toUpperCase()} ENVIRONMENT
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Real-time API throughput telemetry, active sliding-window meters, tariff accounting, and categorized error diagnostics.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Switcher */}
          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs">
            <button
              onClick={() => setEnvironment("test")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                environment === "test"
                  ? "bg-surface-2 text-text shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Test Mode
            </button>
            <button
              onClick={() => setEnvironment("live")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                environment === "live"
                  ? "bg-surface-2 text-[#3FB68B] shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Live Mode
            </button>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs font-mono">
            {(["1h", "24h", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-all ${
                  range === r
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto-refreshing every 3 seconds"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              autoRefresh
                ? "border-[#3FB68B]/40 bg-[#3FB68B]/10 text-[#3FB68B]"
                : "border-border bg-surface text-text-muted hover:text-text"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? "bg-[#3FB68B] animate-pulse" : "bg-text-muted/40"
              }`}
            />
            {autoRefresh ? "Live 3s" : "Paused"}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-text hover:bg-surface-2 transition-all"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-accent" : ""}`} />
          </button>

          {/* Export CSV */}
          <a
            href={`/api/internal/usage/export-csv?range=${range}&environment=${environment}`}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 text-xs text-text font-medium transition-all"
          >
            <Download className="w-3.5 h-3.5 text-text-muted" />
            Export CSV
          </a>

          {/* Request Limits Button */}
          <button
            onClick={() => setIsLimitsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-all shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            Request Limits
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-2">
        {[
          { id: "overview", label: "Overview & Throughput", icon: BarChart3 },
          { id: "limits", label: "Rate Limits & Quotas", icon: Gauge },
          { id: "cost", label: "Cost Visibility & Tariffs", icon: DollarSign },
          {
            id: "errors",
            label: "Errors & Diagnostics",
            icon: AlertTriangle,
            badge: data?.overview?.clientErrors || data?.overview?.serverErrors ? `${(data.overview.clientErrors + data.overview.serverErrors)}` : undefined,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-surface-2 text-text font-semibold border border-border shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface/50"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-accent" : "text-text-muted"}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#E5534B]/20 text-[#E5534B] border border-[#E5534B]/30 font-semibold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Top Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Requests */}
        <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-mono uppercase text-[10px]">Total Requests</span>
            <Activity className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="text-2xl font-bold font-mono text-text">
            {data ? data.overview.totalRequests.toLocaleString() : "..."}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
            <span className="text-[#3FB68B]">{data?.overview.successfulRequests || 0} 2xx</span>
            <span>•</span>
            <span className="text-[#E0A93B]">{data?.overview.clientErrors || 0} 4xx</span>
            <span>•</span>
            <span className="text-[#E5534B]">{data?.overview.serverErrors || 0} 5xx</span>
          </div>
        </div>

        {/* Error Rate */}
        <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-mono uppercase text-[10px]">Error Rate</span>
            <Percent className="w-3.5 h-3.5 text-[#E0A93B]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                parseFloat(data?.overview.errorRate || "0") > 5
                  ? "text-[#E5534B]"
                  : parseFloat(data?.overview.errorRate || "0") > 0
                  ? "text-[#E0A93B]"
                  : "text-[#3FB68B]"
              }`}
            >
              {data ? data.overview.errorRate : "0.0%"}
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            {data?.overview.clientErrors || 0} client / {data?.overview.serverErrors || 0} server
          </p>
        </div>

        {/* Latencies (p50 / p95) */}
        <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-mono uppercase text-[10px]">Latency (p50 / p95)</span>
            <Clock className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div className="text-2xl font-bold font-mono text-text">
            {data ? `${data.overview.p50LatencyMs}ms` : "..."}
            <span className="text-xs text-text-muted font-normal ml-1.5">
              / {data ? `${data.overview.p95LatencyMs}ms` : "..."}
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            Avg: {data ? `${data.overview.avgLatencyMs}ms` : "..."} across window
          </p>
        </div>

        {/* Minute Rate Limit Meter */}
        <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-mono uppercase text-[10px]">Active Minute Usage</span>
            <Flame
              className={`w-3.5 h-3.5 ${
                rateLimitPercent > 80 ? "text-[#E5534B] animate-bounce" : "text-[#7C7CFF]"
              }`}
            />
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-2xl font-bold text-text">
              {data?.rateLimitsAndQuotas.currentMinuteUsage || 0}
            </span>
            <span className="text-xs text-text-muted">
              / {data?.rateLimitsAndQuotas.rateLimitPerMin || 60} req/min
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                rateLimitPercent > 85
                  ? "bg-[#E5534B]"
                  : rateLimitPercent > 65
                  ? "bg-[#E0A93B]"
                  : "bg-[#3FB68B]"
              }`}
              style={{ width: `${rateLimitPercent}%` }}
            />
          </div>
        </div>

        {/* Monthly Quota Consumption */}
        <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-mono uppercase text-[10px]">Monthly Quota</span>
            <CreditCard className="w-3.5 h-3.5 text-[#3FB68B]" />
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-2xl font-bold text-text">
              {data?.rateLimitsAndQuotas.monthlyQuotaUsed.toLocaleString() || 0}
            </span>
            <span className="text-xs text-text-muted">
              / {data?.rateLimitsAndQuotas.monthlyQuota.toLocaleString() || "25,000"}
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB 1: OVERVIEW & THROUGHPUT */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Requests Over Time Stacked Chart */}
          <div className="p-5 rounded-xl border border-border bg-surface space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-text flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" />
                  Request Volume Over Time ({range})
                </h2>
                <p className="text-xs text-text-muted">
                  Stacked by HTTP response class: 2xx success, 4xx client errors, 5xx gateway faults.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#3FB68B]" /> 2xx Success
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#E0A93B]" /> 4xx Client Err
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#E5534B]" /> 5xx Server Err
                </span>
              </div>
            </div>

            {/* Custom SVG / HTML Stacked Bar Chart */}
            <div className="h-48 w-full flex items-end gap-1 sm:gap-2 pt-6 border-b border-border/60">
              {data?.requestsOverTime && data.requestsOverTime.length > 0 ? (
                data.requestsOverTime.map((bucket, i) => {
                  const heightPercent =
                    bucket.total > 0
                      ? Math.min(100, Math.max(8, (bucket.total / maxBucketTotal) * 100))
                      : 3;
                  const pct2xx = bucket.total > 0 ? (bucket.count2xx / bucket.total) * 100 : 0;
                  const pct4xx = bucket.total > 0 ? (bucket.count4xx / bucket.total) * 100 : 0;
                  const pct5xx = bucket.total > 0 ? (bucket.count5xx / bucket.total) * 100 : 0;

                  return (
                    <div
                      key={i}
                      className="group relative flex-1 h-full flex flex-col justify-end items-center"
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col z-20 p-2 rounded-lg border border-border bg-[#16161A] shadow-xl text-[11px] font-mono pointer-events-none min-w-[140px]">
                        <span className="text-text-muted font-bold border-b border-border/50 pb-1 mb-1">
                          {bucket.label}
                        </span>
                        <span className="text-text font-bold">Total: {bucket.total} reqs</span>
                        <span className="text-[#3FB68B]">2xx: {bucket.count2xx}</span>
                        <span className="text-[#E0A93B]">4xx: {bucket.count4xx}</span>
                        <span className="text-[#E5534B]">5xx: {bucket.count5xx}</span>
                      </div>

                      {/* Stacked Bar Column */}
                      <div
                        className="w-full max-w-[32px] rounded-t overflow-hidden flex flex-col transition-all duration-300 hover:brightness-125"
                        style={{ height: `${heightPercent}%` }}
                      >
                        {bucket.count5xx > 0 && (
                          <div
                            className="bg-[#E5534B] w-full"
                            style={{ height: `${pct5xx}%` }}
                          />
                        )}
                        {bucket.count4xx > 0 && (
                          <div
                            className="bg-[#E0A93B] w-full"
                            style={{ height: `${pct4xx}%` }}
                          />
                        )}
                        {bucket.count2xx > 0 && (
                          <div
                            className="bg-[#3FB68B] w-full"
                            style={{ height: `${pct2xx}%` }}
                          />
                        )}
                        {bucket.total === 0 && (
                          <div className="bg-surface-2 w-full h-full opacity-40" />
                        )}
                      </div>

                      {/* X-Axis Label */}
                      <span className="text-[10px] font-mono text-text-muted mt-2 truncate max-w-full">
                        {i % Math.ceil(data.requestsOverTime.length / 8) === 0 ? bucket.label : ""}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-text-muted">
                  No telemetry recorded for this timeframe
                </div>
              )}
            </div>
          </div>

          {/* Dual Columns: Top Endpoints & Top Error Codes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Endpoints Table */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text flex items-center gap-2">
                  <Layers className="w-4 h-4 text-accent" />
                  Top API Endpoints
                </h3>
                <span className="text-[11px] font-mono text-text-muted">
                  Sorted by call volume
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border/60 text-text-muted text-[10px] uppercase">
                      <th className="py-2">Endpoint</th>
                      <th className="py-2 text-right">Volume</th>
                      <th className="py-2 text-right">Failures</th>
                      <th className="py-2 text-right">Avg Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {data?.topEndpoints && data.topEndpoints.length > 0 ? (
                      data.topEndpoints.map((ep, i) => (
                        <tr key={i} className="hover:bg-surface-2/40">
                          <td className="py-2 text-text font-medium truncate max-w-[200px]">
                            {ep.path}
                          </td>
                          <td className="py-2 text-right text-text">{ep.count}</td>
                          <td className="py-2 text-right">
                            <span
                              className={
                                ep.errors > 0 ? "text-[#E0A93B] font-semibold" : "text-[#3FB68B]"
                              }
                            >
                              {ep.errors} ({ep.errorRate})
                            </span>
                          </td>
                          <td className="py-2 text-right text-text-muted">{ep.avgDuration}ms</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-text-muted">
                          No requests recorded
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Error Codes with Direct Filtered Logs Link */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#E0A93B]" />
                  Top Error Codes
                </h3>
                <Link
                  href="/docs/errors"
                  className="text-[11px] text-accent hover:underline flex items-center gap-1 font-mono"
                >
                  Error Catalog <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {data?.topErrorCodes && data.topErrorCodes.length > 0 ? (
                  data.topErrorCodes.map((err, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border border-border/80 bg-surface-2/40 hover:bg-surface-2 transition-all flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#E5534B]">{err.code}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted font-mono">
                            {err.definition.status}
                          </span>
                        </div>
                        <p className="text-text-muted text-[11px] truncate">
                          {err.definition.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#E5534B]/10 text-[#E5534B] border border-[#E5534B]/20 text-xs">
                          {err.count} hit{err.count > 1 ? "s" : ""}
                        </span>
                        <Link
                          href={err.logsUrl}
                          className="p-1.5 rounded border border-border hover:bg-surface text-text-muted hover:text-text transition-all"
                          title="View filtered logs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-[#3FB68B]" />
                    <span>0 errors recorded in selected timeframe. System is 100% healthy!</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Per-Key Breakdown Table */}
          <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text">Traffic by API Key</h3>
                <p className="text-xs text-text-muted">
                  Audit which credentials are generating traffic and identify keys triggering error spikes.
                </p>
              </div>
              <Link
                href="/console/keys"
                className="text-xs text-accent hover:underline font-mono"
              >
                Manage API Keys →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/60 text-text-muted text-[10px] uppercase">
                    <th className="py-2">Key Name</th>
                    <th className="py-2">Masked Token</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Requests</th>
                    <th className="py-2 text-right">Errors</th>
                    <th className="py-2 text-right">Error %</th>
                    <th className="py-2 text-right">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data?.perKeyBreakdown && data.perKeyBreakdown.length > 0 ? (
                    data.perKeyBreakdown.map((key) => (
                      <tr key={key.id} className="hover:bg-surface-2/40">
                        <td className="py-2 text-text font-medium">{key.name}</td>
                        <td className="py-2 text-text-muted font-mono">{key.secretMasked}</td>
                        <td className="py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              key.status === "active"
                                ? "bg-[#3FB68B]/10 text-[#3FB68B] border border-[#3FB68B]/20"
                                : "bg-[#E0A93B]/10 text-[#E0A93B] border border-[#E0A93B]/20"
                            }`}
                          >
                            {key.status}
                          </span>
                        </td>
                        <td className="py-2 text-right text-text">{key.requestCount}</td>
                        <td className="py-2 text-right text-[#E0A93B]">{key.errorCount}</td>
                        <td className="py-2 text-right">{key.errorRate}</td>
                        <td className="py-2 text-right text-text-muted">
                          {key.lastUsedAt
                            ? new Date(key.lastUsedAt).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Never"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-text-muted">
                        No keys configured
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RATE LIMITS & QUOTAS */}
      {activeTab === "limits" && (
        <div className="space-y-6">
          {/* Live Sliding-Window Meter & Quota Forecast */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Live Meter Card */}
            <div className="p-6 rounded-xl border border-border bg-surface space-y-4 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-text-muted">
                  Live Sliding-Window Meter
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#3FB68B]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3FB68B] animate-ping" />
                  Live 3s
                </span>
              </div>

              {/* Big Gauge Display */}
              <div className="text-center py-4 space-y-2">
                <div className="inline-flex items-baseline gap-1 font-mono">
                  <span
                    className={`text-5xl font-black ${
                      rateLimitPercent > 85
                        ? "text-[#E5534B]"
                        : rateLimitPercent > 60
                        ? "text-[#E0A93B]"
                        : "text-[#3FB68B]"
                    }`}
                  >
                    {data?.rateLimitsAndQuotas.currentMinuteUsage || 0}
                  </span>
                  <span className="text-lg text-text-muted font-normal">
                    / {data?.rateLimitsAndQuotas.rateLimitPerMin || 60}
                  </span>
                </div>
                <p className="text-xs text-text-muted font-mono">
                  Requests consumed in the last 60 seconds
                </p>
                <div className="w-full bg-surface-2 h-2.5 rounded-full overflow-hidden mt-3">
                  <div
                    className={`h-full transition-all duration-500 ${
                      rateLimitPercent > 85
                        ? "bg-[#E5534B]"
                        : rateLimitPercent > 60
                        ? "bg-[#E0A93B]"
                        : "bg-[#3FB68B]"
                    }`}
                    style={{ width: `${rateLimitPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-text-muted pt-1">
                  <span>{data?.rateLimitsAndQuotas.currentMinuteRemaining} remaining</span>
                  <span>{rateLimitPercent}% capacity</span>
                </div>
              </div>

              {/* Reset Timing Note */}
              <div className="p-3 rounded-lg border border-border bg-surface-2 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-text">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  Sliding-Window Semantics
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Relay enforces a precision 60-second rolling window per API key. Each request drops off exactly 60 seconds after execution.
                </p>
              </div>
            </div>

            {/* Quota Exhaustion Forecast Card */}
            <div className="p-6 rounded-xl border border-border bg-surface space-y-4 lg:col-span-2 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#3FB68B]" />
                    Monthly Quota Trajectory & Exhaustion Forecast
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-accent/10 text-accent border border-accent/20">
                    Tier: {data?.rateLimitsAndQuotas.planTier.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  Projected runway calculated using your 24-hour ingestion pace and historical burst patterns.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface-2/60 space-y-1">
                  <span className="text-[10px] font-mono text-text-muted uppercase">Quota Used</span>
                  <div className="text-xl font-bold font-mono text-text">
                    {data?.rateLimitsAndQuotas.monthlyQuotaUsed.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-text-muted">
                    {quotaPercent}% of {data?.rateLimitsAndQuotas.monthlyQuota.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg border border-border/80 bg-surface-2/60 space-y-1">
                  <span className="text-[10px] font-mono text-text-muted uppercase">Remaining Allowance</span>
                  <div className="text-xl font-bold font-mono text-[#3FB68B]">
                    {data?.rateLimitsAndQuotas.monthlyQuotaRemaining.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-text-muted">Calls left this month</span>
                </div>

                <div className="p-3.5 rounded-lg border border-border/80 bg-surface-2/60 space-y-1">
                  <span className="text-[10px] font-mono text-text-muted uppercase">Exhaustion Projection</span>
                  <div className="text-sm font-bold font-mono text-accent truncate">
                    {data?.rateLimitsAndQuotas.projectedExhaustionDate || "Beyond cycle"}
                  </div>
                  <span className="text-[11px] text-text-muted">Based on trailing pace</span>
                </div>
              </div>

              {/* Tier Matrix Card */}
              <div className="p-4 rounded-lg border border-border bg-surface-2 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-text">Rate Limits by Tier (Test vs Live)</span>
                  <button
                    onClick={() => setIsLimitsModalOpen(true)}
                    className="text-accent hover:underline font-mono text-[11px]"
                  >
                    Need higher limits? Request upgrade →
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
                  <div className="p-2 rounded border border-border bg-surface">
                    <span className="text-text-muted block text-[10px]">STARTER</span>
                    <span className="font-bold text-text">60 req/min</span>
                    <span className="block text-[10px] text-text-muted">50 TPS Live</span>
                  </div>
                  <div className="p-2 rounded border border-accent/40 bg-accent/5">
                    <span className="text-accent font-bold block text-[10px]">GROWTH (CURRENT)</span>
                    <span className="font-bold text-text">120 req/min</span>
                    <span className="block text-[10px] text-text-muted">250 TPS Live</span>
                  </div>
                  <div className="p-2 rounded border border-border bg-surface">
                    <span className="text-text-muted block text-[10px]">ENTERPRISE</span>
                    <span className="font-bold text-text">600 req/min</span>
                    <span className="block text-[10px] text-text-muted">5,000+ TPS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rate-Limit Hit Event List (429s) & Code Guidance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 429 Hits Table */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-text flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#E5534B]" />
                    Rate-Limit Hits (HTTP 429 Rejections)
                  </h3>
                  <p className="text-xs text-text-muted">
                    Recent requests blocked by the sliding-window engine.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E5534B]/10 text-[#E5534B] border border-[#E5534B]/20">
                  {data?.rateLimitsAndQuotas.recent429Hits.length || 0} hits
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border/60 text-text-muted text-[10px] uppercase">
                      <th className="py-2">Time</th>
                      <th className="py-2">Method & Path</th>
                      <th className="py-2">IP</th>
                      <th className="py-2 text-right">Retry-After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-border/40">
                    {data?.rateLimitsAndQuotas.recent429Hits &&
                    data.rateLimitsAndQuotas.recent429Hits.length > 0 ? (
                      data.rateLimitsAndQuotas.recent429Hits.map((hit) => (
                        <tr key={hit.id} className="hover:bg-surface-2/40">
                          <td className="py-2 text-text-muted">
                            {new Date(hit.createdAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="py-2 text-[#E5534B] font-semibold">
                            {hit.method} {hit.path}
                          </td>
                          <td className="py-2 text-text-muted">{hit.ip}</td>
                          <td className="py-2 text-right text-accent font-bold">
                            {hit.retryAfter}s
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-text-muted">
                          <CheckCircle2 className="w-5 h-5 text-[#3FB68B] mx-auto mb-1" />
                          No 429 rate-limit rejections in current timeframe
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actionable Code Guidance: Exponential Backoff */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-text">Handling HTTP 429 with Exponential Backoff</h3>
                  <p className="text-xs text-text-muted">
                    Always respect the <code className="text-accent font-mono">Retry-After</code> header to guarantee delivery without packet loss.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-md text-[11px] font-mono">
                  {(["ts", "py", "curl"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setBackoffSnippetLang(lang)}
                      className={`px-2 py-0.5 rounded ${
                        backoffSnippetLang === lang
                          ? "bg-accent text-white font-bold"
                          : "text-text-muted hover:text-text"
                      }`}
                    >
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <pre className="p-3.5 rounded-lg bg-[#0F0F12] border border-border text-[11px] font-mono text-text/90 overflow-x-auto max-h-[220px]">
                  <code>
                    {backoffSnippetLang === "ts"
                      ? backoffCodeTs
                      : backoffSnippetLang === "py"
                      ? backoffCodePy
                      : backoffCodeCurl}
                  </code>
                </pre>
                <button
                  onClick={() =>
                    copySnippet(
                      backoffSnippetLang === "ts"
                        ? backoffCodeTs
                        : backoffSnippetLang === "py"
                        ? backoffCodePy
                        : backoffCodeCurl
                    )
                  }
                  className="absolute top-2.5 right-2.5 p-1.5 rounded bg-surface border border-border hover:bg-surface-2 text-text-muted hover:text-text text-xs flex items-center gap-1 font-mono transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedSnippet ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          {/* Quota & Limit Alerts Configuration Card */}
          <div className="p-6 rounded-xl border border-border bg-surface space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-accent" />
                  Quota & Threshold Alert Settings
                </h3>
                <p className="text-xs text-text-muted">
                  Configure automated in-console and email alerts when your traffic crosses capacity thresholds.
                </p>
              </div>
              {alertToast && (
                <div className="text-xs font-mono px-3 py-1 rounded bg-[#3FB68B]/10 border border-[#3FB68B]/30 text-[#3FB68B]">
                  {alertToast}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 80% Threshold */}
              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-surface-2 cursor-pointer hover:border-accent/40 transition-all">
                <input
                  type="checkbox"
                  checked={alertThreshold80}
                  onChange={(e) => setAlertThreshold80(e.target.checked)}
                  className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-text">80% Monthly Quota</span>
                  <p className="text-[11px] text-text-muted">
                    Proactive notice before running out of calls.
                  </p>
                </div>
              </label>

              {/* 95% Threshold */}
              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-surface-2 cursor-pointer hover:border-accent/40 transition-all">
                <input
                  type="checkbox"
                  checked={alertThreshold95}
                  onChange={(e) => setAlertThreshold95(e.target.checked)}
                  className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-text">95% Critical Alert</span>
                  <p className="text-[11px] text-text-muted">
                    Urgent notification to elevate tier or top up.
                  </p>
                </div>
              </label>

              {/* 429 Spike Detection */}
              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-surface-2 cursor-pointer hover:border-accent/40 transition-all">
                <input
                  type="checkbox"
                  checked={alertSpike429}
                  onChange={(e) => setAlertSpike429(e.target.checked)}
                  className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-text">429 Spike Detection</span>
                  <p className="text-[11px] text-text-muted">
                    Alert when client breaches limits repeatedly.
                  </p>
                </div>
              </label>

              {/* Low Balance Alert (Live) */}
              <div className="p-3.5 rounded-lg border border-border bg-surface-2 space-y-1">
                <span className="text-xs font-bold text-text">Low Balance Warning (₹)</span>
                <input
                  type="number"
                  value={lowBalanceThreshold}
                  onChange={(e) => setLowBalanceThreshold(Number(e.target.value))}
                  className="w-full px-2.5 py-1 rounded border border-border bg-surface text-xs font-mono text-text focus:outline-none focus:border-accent"
                />
                <span className="text-[10px] text-text-muted block">Warn when balance falls below</span>
              </div>
            </div>

            {/* Email Notification Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="checkbox"
                  id="emailNotify"
                  checked={alertEmailNotify}
                  onChange={(e) => setAlertEmailNotify(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                <label htmlFor="emailNotify" className="text-xs text-text font-medium">
                  Dispatch email notifications to:
                </label>
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="alerts@company.in"
                  className="px-3 py-1 rounded border border-border bg-surface text-xs font-mono text-text focus:outline-none focus:border-accent min-w-[220px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveAlerts(true)}
                  disabled={savingAlerts}
                  className="px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2 text-xs font-medium text-text-muted hover:text-text transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Test Alert
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAlerts(false)}
                  disabled={savingAlerts}
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-all shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COST VISIBILITY & TARIFFS */}
      {activeTab === "cost" && (
        <div className="space-y-6">
          {/* Informational Banner Split (Test is Free vs Live Charges) */}
          <div
            className={`p-5 rounded-xl border ${
              environment === "test"
                ? "border-[#7C7CFF]/40 bg-[#7C7CFF]/5"
                : "border-[#3FB68B]/40 bg-[#3FB68B]/5"
            } space-y-3`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      environment === "test"
                        ? "bg-[#7C7CFF]/20 text-[#7C7CFF]"
                        : "bg-[#3FB68B]/20 text-[#3FB68B]"
                    }`}
                  >
                    {environment === "test" ? "Sandbox Tariff Guarantee" : "Live Billed Wallet"}
                  </span>
                  <span className="text-xs text-text font-bold">
                    {environment === "test"
                      ? "Test usage is 100% free with zero charges."
                      : "Live messaging debits from your prepaid wallet balance."}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  {environment === "test"
                    ? "In test mode, we calculate exactly what your traffic would cost in production so you can budget accurately before going live."
                    : "Official Indian telecom DLT termination charges and Meta WhatsApp session tariffs applied."}
                </p>
              </div>

              {/* Cost Summary Badges */}
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-surface border border-border text-right min-w-[130px]">
                  <span className="text-[10px] font-mono text-text-muted uppercase block">
                    {environment === "test" ? "Would Have Cost" : "Actual Debited"}
                  </span>
                  <span className="text-xl font-bold font-mono text-text">
                    ₹
                    {environment === "test"
                      ? data?.costVisibility.testWouldHaveCost.toFixed(2)
                      : data?.costVisibility.liveCharged.toFixed(2)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-surface border border-border text-right min-w-[130px]">
                  <span className="text-[10px] font-mono text-text-muted uppercase block">
                    {environment === "test" ? "Actual Charged" : "Prepaid Wallet"}
                  </span>
                  <span
                    className={`text-xl font-bold font-mono ${
                      environment === "test" ? "text-[#3FB68B]" : "text-accent"
                    }`}
                  >
                    ₹
                    {environment === "test"
                      ? "0.00"
                      : data?.costVisibility.walletBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Channel Tariffs Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* SMS */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-text uppercase">
                  SMS (Transactional & OTP)
                </span>
                <span className="text-xs font-mono text-accent">₹0.12 / msg</span>
              </div>
              <div className="text-2xl font-bold font-mono text-text">
                {data?.costVisibility.channelBreakdown.sms.count || 0} msgs
              </div>
              <div className="flex justify-between text-xs text-text-muted pt-1 border-t border-border/50">
                <span>Total Channel Cost:</span>
                <span className="font-mono font-semibold text-text">
                  ₹{data?.costVisibility.channelBreakdown.sms.cost.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>

            {/* RCS */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-text uppercase">
                  RCS Business Messaging
                </span>
                <span className="text-xs font-mono text-[#3FB68B]">₹0.20 / msg</span>
              </div>
              <div className="text-2xl font-bold font-mono text-text">
                {data?.costVisibility.channelBreakdown.rcs.count || 0} msgs
              </div>
              <div className="flex justify-between text-xs text-text-muted pt-1 border-t border-border/50">
                <span>Total Channel Cost:</span>
                <span className="font-mono font-semibold text-text">
                  ₹{data?.costVisibility.channelBreakdown.rcs.cost.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-text uppercase">
                  WhatsApp Cloud Business
                </span>
                <span className="text-xs font-mono text-[#E0A93B]">₹0.35 / conv</span>
              </div>
              <div className="text-2xl font-bold font-mono text-text">
                {data?.costVisibility.channelBreakdown.whatsapp.count || 0} msgs
              </div>
              <div className="flex justify-between text-xs text-text-muted pt-1 border-t border-border/50">
                <span>Total Channel Cost:</span>
                <span className="font-mono font-semibold text-text">
                  ₹{data?.costVisibility.channelBreakdown.whatsapp.cost.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Cost Estimator Widget */}
          <div className="p-6 rounded-xl border border-border bg-surface space-y-5">
            <div className="border-b border-border/60 pb-3">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#3FB68B]" />
                Interactive Production Cost Estimator
              </h3>
              <p className="text-xs text-text-muted">
                Simulate monthly communication volume across channels to estimate anticipated billing including GST.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sliders Area */}
              <div className="lg:col-span-2 space-y-4">
                {/* SMS Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-text font-medium">SMS Messages (₹0.12/msg)</span>
                    <span className="text-accent font-bold">{calcSmsCount.toLocaleString()} / mo</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500000"
                    step="5000"
                    value={calcSmsCount}
                    onChange={(e) => setCalcSmsCount(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>

                {/* RCS Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-text font-medium">RCS Rich Cards (₹0.20/msg)</span>
                    <span className="text-[#3FB68B] font-bold">{calcRcsCount.toLocaleString()} / mo</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200000"
                    step="2000"
                    value={calcRcsCount}
                    onChange={(e) => setCalcRcsCount(Number(e.target.value))}
                    className="w-full accent-[#3FB68B] cursor-pointer"
                  />
                </div>

                {/* WhatsApp Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-text font-medium">WhatsApp Templates (₹0.35/conv)</span>
                    <span className="text-[#E0A93B] font-bold">{calcWaCount.toLocaleString()} / mo</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100000"
                    step="1000"
                    value={calcWaCount}
                    onChange={(e) => setCalcWaCount(Number(e.target.value))}
                    className="w-full accent-[#E0A93B] cursor-pointer"
                  />
                </div>
              </div>

              {/* Calculated Summary Box */}
              <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-text uppercase tracking-wider block">
                    Estimated Monthly Cost
                  </span>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-text-muted">
                      <span>SMS Subtotal:</span>
                      <span>₹{calcTotals.smsCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>RCS Subtotal:</span>
                      <span>₹{calcTotals.rcsCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>WhatsApp Subtotal:</span>
                      <span>₹{calcTotals.waCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-text-muted border-t border-border/40 pt-1">
                      <span>Subtotal:</span>
                      <span>₹{calcTotals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>GST (18%):</span>
                      <span>₹{calcTotals.gst.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-3">
                  <div className="flex justify-between items-baseline font-mono">
                    <span className="text-xs font-bold text-text">Total Invoiced:</span>
                    <span className="text-2xl font-black text-[#3FB68B]">
                      ₹{calcTotals.total.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted block mt-1">
                    Includes all carrier termination surcharges.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ERRORS & DIAGNOSTICS */}
      {activeTab === "errors" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E5534B]" />
                Grouped Failing Requests & Troubleshooting
              </h2>
              <p className="text-xs text-text-muted">
                All 4xx and 5xx API rejections clustered by error code and endpoint with root cause analysis.
              </p>
            </div>
            <Link
              href="/console/logs"
              className="text-xs text-accent hover:underline flex items-center gap-1 font-mono"
            >
              Search All Raw Logs →
            </Link>
          </div>

          {/* Grouped Errors List */}
          <div className="space-y-3">
            {data?.errorsView && data.errorsView.length > 0 ? (
              data.errorsView.map((err, i) => {
                const isExpanded = selectedError === `${err.errorCode}::${err.path}`;
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-surface overflow-hidden transition-all"
                  >
                    {/* Header Row */}
                    <div
                      onClick={() =>
                        setSelectedError(isExpanded ? null : `${err.errorCode}::${err.path}`)
                      }
                      className="p-4 cursor-pointer hover:bg-surface-2/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                            err.sampleStatus >= 500
                              ? "bg-[#E5534B]/10 text-[#E5534B] border border-[#E5534B]/20"
                              : "bg-[#E0A93B]/10 text-[#E0A93B] border border-[#E0A93B]/20"
                          }`}
                        >
                          HTTP {err.sampleStatus}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-text truncate">
                              {err.errorCode}
                            </span>
                            <span className="text-text-muted font-mono text-xs">on</span>
                            <span className="font-mono text-xs text-accent truncate">{err.path}</span>
                          </div>
                          <p className="text-xs text-text-muted truncate mt-0.5">
                            {err.errorDefinition.message}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-surface-2 border border-border text-text">
                          {err.count} failure{err.count > 1 ? "s" : ""}
                        </span>
                        <span className="text-[11px] font-mono text-text-muted">
                          Last seen:{" "}
                          {new Date(err.lastSeen).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-accent font-medium hover:underline"
                        >
                          {isExpanded ? "Collapse ▲" : "Diagnose ▼"}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Diagnostic Body */}
                    {isExpanded && (
                      <div className="border-t border-border/60 bg-[#0F0F12] p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Common Causes */}
                          <div className="space-y-2 p-3.5 rounded-lg border border-border bg-surface">
                            <span className="text-xs font-bold text-[#E0A93B] flex items-center gap-1.5 uppercase font-mono">
                              <AlertTriangle className="w-3.5 h-3.5" /> Common Causes
                            </span>
                            <ul className="text-xs text-text-muted space-y-1 list-disc pl-4">
                              {err.errorDefinition.commonCauses.map((cause, cIdx) => (
                                <li key={cIdx}>{cause}</li>
                              ))}
                            </ul>
                          </div>

                          {/* How to Fix */}
                          <div className="space-y-2 p-3.5 rounded-lg border border-border bg-surface">
                            <span className="text-xs font-bold text-[#3FB68B] flex items-center gap-1.5 uppercase font-mono">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Recommended Remediation
                            </span>
                            <ul className="text-xs text-text-muted space-y-1 list-decimal pl-4">
                              {err.errorDefinition.howToFix.map((fix, fIdx) => (
                                <li key={fIdx}>{fix}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Sample Request Payload & Response Body */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          <div className="space-y-1">
                            <span className="text-[11px] font-mono text-text-muted">
                              Sample Request Payload (ID: {err.sampleRequestId})
                            </span>
                            <pre className="p-3 rounded-lg bg-surface border border-border text-[11px] font-mono text-text-muted overflow-x-auto max-h-[160px]">
                              <code>{JSON.stringify(err.samplePayload || {}, null, 2)}</code>
                            </pre>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] font-mono text-text-muted">
                              Sample Error Response Body
                            </span>
                            <pre className="p-3 rounded-lg bg-surface border border-border text-[11px] font-mono text-[#E5534B] overflow-x-auto max-h-[160px]">
                              <code>{JSON.stringify(err.sampleResponse || {}, null, 2)}</code>
                            </pre>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/40">
                          <Link
                            href={err.errorDefinition.docUrl}
                            className="text-xs text-accent hover:underline flex items-center gap-1 font-mono"
                          >
                            Read Official Error Documentation →
                          </Link>
                          <Link
                            href={err.logsUrl}
                            className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 text-xs font-medium text-text flex items-center gap-1.5 transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Inspect in Filtered Logs
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center rounded-xl border border-border bg-surface space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#3FB68B] mx-auto" />
                <h3 className="text-sm font-bold text-text">Zero Grouped Failures</h3>
                <p className="text-xs text-text-muted">
                  There are no failing requests recorded for workspace in this timeframe.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MODAL: REQUEST HIGHER LIMITS */}
      {isLimitsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-[#16161A] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                <h3 className="text-base font-bold text-text">Request Rate Limit Elevation</h3>
              </div>
              <button
                onClick={() => setIsLimitsModalOpen(false)}
                className="text-text-muted hover:text-text p-1 rounded-lg hover:bg-surface-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {limitSuccessMsg ? (
              <div className="p-4 rounded-xl border border-[#3FB68B]/30 bg-[#3FB68B]/10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#3FB68B] mx-auto" />
                <h4 className="text-sm font-bold text-text">Elevation Request Submitted</h4>
                <p className="text-xs text-text-muted">{limitSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitLimitRequest} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text">Current Workspace & Plan</label>
                  <input
                    type="text"
                    disabled
                    value={`${data?.workspace.name || "AcmePay"} (${data?.workspace.planTier.toUpperCase()} - Current ${data?.rateLimitsAndQuotas.rateLimitPerMin} req/min)`}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs font-mono text-text-muted"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-text">
                    Requested Throughput (TPS / Transactions Per Second)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="10000"
                    step="50"
                    required
                    value={requestedTps}
                    onChange={(e) => setRequestedTps(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs font-mono text-text focus:outline-none focus:border-accent"
                  />
                  <span className="text-[10px] text-text-muted">
                    Growth tier supports up to 250 TPS; Enterprise supports up to 5,000 TPS.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-text">Target Communication Channels</label>
                  <div className="flex items-center gap-4 text-xs font-mono text-text pt-1">
                    {(["sms", "rcs", "whatsapp"] as const).map((ch) => (
                      <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={limitChannels.includes(ch)}
                          onChange={(e) => {
                            if (e.target.checked) setLimitChannels([...limitChannels, ch]);
                            else setLimitChannels(limitChannels.filter((c) => c !== ch));
                          }}
                          className="rounded border-border text-accent focus:ring-accent"
                        />
                        <span className="uppercase">{ch}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-text">
                    Use Case & Justification
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Launching nationwide Diwali campaign on Friday at 8:00 PM expecting 10,000 OTPs per minute..."
                    value={limitReason}
                    onChange={(e) => setLimitReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setIsLimitsModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2 text-xs text-text transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLimit || !limitReason}
                    className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingLimit ? "Submitting..." : "Submit Elevation Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
