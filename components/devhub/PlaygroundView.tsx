"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Play,
  RotateCcw,
  Copy,
  Check,
  Clock,
  Sparkles,
  Lock,
  ChevronDown,
  Terminal,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  History,
  Send,
  Code2,
  Share2,
} from "lucide-react";
import { useDevHub, SupportedLanguage } from "@/components/providers/DevHubContext";
import { API_SPEC } from "@/lib/docs/api-spec";

interface PlaygroundViewProps {
  initialRecipe?: string;
  isEvalMode?: boolean;
  onTourStepComplete?: (step: number) => void;
}

interface RequestHistoryItem {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  body: any;
  requestId: string | null;
}

export function PlaygroundView({
  initialRecipe = "send_otp",
  isEvalMode = false,
  onTourStepComplete,
}: PlaygroundViewProps) {
  const { environment, activeLanguage, setActiveLanguage } = useDevHub();

  // Selected recipe & endpoint
  const [selectedRecipe, setSelectedRecipe] = useState(initialRecipe);
  const [selectedEndpointKey, setSelectedEndpointKey] = useState("messages-send");

  // Form states
  const [method, setMethod] = useState("POST");
  const [path, setPath] = useState("/api/v1/messages");
  const [pathParamId, setPathParamId] = useState("");
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Headers
  const [apiKey, setApiKey] = useState("rk_test_acmepay_9fa1b2e84c302948");
  const [availableKeys, setAvailableKeys] = useState<{ id: string; masked: string; fullKey: string }[]>([]);
  const [relayVersion, setRelayVersion] = useState("2025-10-01");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  // Execution states
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [errorExplanation, setErrorExplanation] = useState<any>(null);

  // Chaining state
  const [chainedMessageId, setChainedMessageId] = useState<string | null>(null);
  const [chainedCustomerId, setChainedCustomerId] = useState<string | null>(null);

  // History & Code Generator
  const [history, setHistory] = useState<RequestHistoryItem[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<"response" | "headers" | "code" | "history">("response");

  // AI Code Generator States
  const [isAiGenerateModalOpen, setIsAiGenerateModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLang, setAiLang] = useState<"curl" | "node" | "python" | "php" | "go">("node");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<any>(null);
  const [aiRunningSandbox, setAiRunningSandbox] = useState(false);
  const [aiRunResult, setAiRunResult] = useState<any>(null);
  const [aiCopied, setAiCopied] = useState(false);

  const handleGenerateCode = async (promptToUse?: string, langToUse?: "curl" | "node" | "python" | "php" | "go") => {
    const promptText = promptToUse || aiPrompt;
    const lang = langToUse || aiLang;
    if (!promptText.trim() || aiGenerating) return;
    setAiGenerating(true);
    setAiRunResult(null);
    try {
      const res = await fetch("/api/internal/ai/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, language: lang }),
      });
      const data = await res.json();
      setAiGeneratedResult(data);
    } catch (err) {
      console.error("AI code generation failed", err);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleExecuteGeneratedCode = async () => {
    if (!aiGeneratedResult || aiRunningSandbox) return;
    setAiRunningSandbox(true);
    try {
      const res = await fetch("/api/internal/ai/generate-code/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: aiGeneratedResult.method,
          path: aiGeneratedResult.path,
          payload: aiGeneratedResult.extractedPayload,
        }),
      });
      const data = await res.json();
      setAiRunResult(data);
    } catch (err: any) {
      setAiRunResult({ status: 500, data: { error: err.message }, latencyMs: 0 });
    } finally {
      setAiRunningSandbox(false);
    }
  };

  const handleLoadGeneratedIntoPlayground = () => {
    if (!aiGeneratedResult) return;
    setMethod(aiGeneratedResult.method || "POST");
    setPath(aiGeneratedResult.path || "/api/v1/messages");
    if (aiGeneratedResult.extractedPayload) {
      setBodyText(JSON.stringify(aiGeneratedResult.extractedPayload, null, 2));
    }
    setIsAiGenerateModalOpen(false);
  };

  // 1. Recipes Catalog
  const recipes: Record<
    string,
    {
      name: string;
      description: string;
      endpointKey: string;
      method: string;
      path: string;
      body: any;
      pathParam?: string;
    }
  > = {
    send_otp: {
      name: "Send OTP (Transactional SMS)",
      description: "Send standard 6-digit OTP verification message with approved DLT template.",
      endpointKey: "messages-send",
      method: "POST",
      path: "/api/v1/messages",
      body: {
        channel: "sms",
        to: "+919999900001",
        sender_id: "RELAYI",
        template_id: "dlt_tmpl_otp_login",
        variables: { "1": "492019" },
        metadata: { flow: "playground_login_demo" },
      },
    },
    send_whatsapp: {
      name: "Send WhatsApp Template",
      description: "Rich interactive WhatsApp message with carrier delivery receipt.",
      endpointKey: "messages-send",
      method: "POST",
      path: "/api/v1/messages",
      body: {
        channel: "whatsapp",
        to: "+919999900001",
        sender_id: "RELAYI",
        template_id: "dlt_tmpl_order_update",
        variables: { "1": "ORD-98214", "2": "Out for Delivery" },
        metadata: { customer_tier: "vip" },
      },
    },
    track_purchase: {
      name: "Track Purchase Event (CDP)",
      description: "Ingest checkout event into real-time Customer Data Platform profile.",
      endpointKey: "events-ingest",
      method: "POST",
      path: "/api/v1/events",
      body: {
        event: "order_completed",
        external_id: "cust_acme_9912",
        properties: {
          order_id: "ord_9182",
          amount: 2499,
          currency: "INR",
          category: "electronics",
        },
      },
    },
    fetch_profile: {
      name: "Fetch Unified Profile (CDP)",
      description: "Read enriched customer identity profile and computed traits via API.",
      endpointKey: "customers-get",
      method: "GET",
      path: "/api/v1/customers/cust_acme_9912",
      pathParam: "cust_acme_9912",
      body: null,
    },
    simulate_fail: {
      name: "Simulate a Failed Delivery",
      description: "Dispatch to test number +919999900002 to test error handling & carrier timeout.",
      endpointKey: "messages-send",
      method: "POST",
      path: "/api/v1/messages",
      body: {
        channel: "sms",
        to: "+919999900002",
        sender_id: "RELAYI",
        template_id: "dlt_tmpl_otp_login",
        variables: { "1": "123456" },
      },
    },
  };

  // Load available keys from session
  useEffect(() => {
    async function loadKeys() {
      try {
        const res = await fetch("/api/internal/api-keys");
        const data = await res.json();
        if (data.keys && Array.isArray(data.keys)) {
          const testKeys = data.keys.filter((k: any) => k.environment === "test" && k.status === "active");
          if (testKeys.length > 0) {
            setAvailableKeys(
              testKeys.map((k: any) => ({
                id: k.id,
                masked: k.secretMasked || `rk_test_••••••••${k.prefix || "9fa1"}`,
                fullKey: k.fullKeyForDev || k.secretMasked,
              }))
            );
            setApiKey(testKeys[0].fullKeyForDev || testKeys[0].secretMasked);
          }
        }
      } catch {}
    }
    loadKeys();

    // Load request history from localStorage
    try {
      const stored = localStorage.getItem("relay_playground_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // When recipe changes, apply defaults
  useEffect(() => {
    if (recipes[selectedRecipe]) {
      const r = recipes[selectedRecipe];
      setSelectedEndpointKey(r.endpointKey);
      setMethod(r.method);
      setPath(r.path);
      if (r.pathParam) setPathParamId(r.pathParam);
      if (r.body) {
        setBodyText(JSON.stringify(r.body, null, 2));
      } else {
        setBodyText("");
      }
      setJsonError(null);
    }
  }, [selectedRecipe]);

  // Handle Endpoint Selection
  const handleEndpointSelect = (key: string) => {
    setSelectedEndpointKey(key);
    const spec = API_SPEC.endpoints.find((e: any) => e.id === key);
    if (!spec) return;

    setMethod(spec.method);
    setPath(spec.path);

    // If path has param like :id
    if (spec.path.includes(":id")) {
      setPathParamId(chainedMessageId || "msg_01jb9x7v2t4kzq8m");
    }

    if (spec.requestBodyExample) {
      setBodyText(JSON.stringify(spec.requestBodyExample, null, 2));
    } else {
      setBodyText("");
    }
    setJsonError(null);
  };

  // Body text change with JSON validator
  const handleBodyChange = (text: string) => {
    setBodyText(text);
    if (!text.trim() || ["GET", "HEAD"].includes(method.toUpperCase())) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(text);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  const handleGenerateIdempotency = () => {
    const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    setIdempotencyKey(uuid);
  };

  // Execute Real Request
  const handleSend = async () => {
    if (jsonError) return;

    setLoading(true);
    setResponse(null);
    setErrorExplanation(null);

    // Compute actual path with path param replacement
    let finalPath = path;
    if (finalPath.includes(":id") && pathParamId) {
      finalPath = finalPath.replace(":id", pathParamId);
    }

    // Build headers
    const headers: Record<string, string> = {
      "Relay-Version": relayVersion,
    };
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    try {
      let parsedBody = null;
      if (bodyText && !["GET", "HEAD"].includes(method.toUpperCase())) {
        parsedBody = JSON.parse(bodyText);
      }

      const res = await fetch("/api/internal/playground/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          path: finalPath,
          headers,
          body: parsedBody,
          apiKey,
        }),
      });

      const result = await res.json();
      setResponseStatus(result.status || res.status);
      setDurationMs(result.durationMs || 45);
      setResponseHeaders(result.headers || {});
      setResponse(result.body || result);
      setRequestId(result.requestId || null);
      setErrorExplanation(result.errorExplanation || null);

      // Check for chaining chips
      if (result.body?.id && result.body.id.startsWith("msg_")) {
        setChainedMessageId(result.body.id);
      }
      if (result.body?.customer?.external_id || result.body?.external_id) {
        setChainedCustomerId(result.body?.customer?.external_id || result.body?.external_id);
      }

      // Record to history
      const historyItem: RequestHistoryItem = {
        id: `hist_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        method,
        path: finalPath,
        status: result.status || res.status,
        durationMs: result.durationMs || 45,
        body: result.body,
        requestId: result.requestId || null,
      };

      const updatedHistory = [historyItem, ...history.slice(0, 19)];
      setHistory(updatedHistory);
      try {
        localStorage.setItem("relay_playground_history", JSON.stringify(updatedHistory));
      } catch {}

      // Notify tour if eval mode
      if (onTourStepComplete) {
        if (selectedRecipe === "send_otp") onTourStepComplete(0);
        else if (selectedRecipe === "track_purchase") onTourStepComplete(1);
        else if (selectedRecipe === "fetch_profile") onTourStepComplete(2);
      }
    } catch (err: any) {
      setResponseStatus(500);
      setResponse({ error: { message: err.message || "Failed to execute request" } });
    } finally {
      setLoading(false);
    }
  };

  // Generate dynamic code snippet from current request state
  const getGeneratedCode = (lang: SupportedLanguage) => {
    let finalPath = path;
    if (finalPath.includes(":id") && pathParamId) {
      finalPath = finalPath.replace(":id", pathParamId);
    }
    const fullUrl = `https://api.relay.internal${finalPath}`;

    if (lang === "curl") {
      let cmd = `curl -X ${method} "${fullUrl}" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Relay-Version: ${relayVersion}"`;
      if (idempotencyKey) {
        cmd += ` \\\n  -H "Idempotency-Key: ${idempotencyKey}"`;
      }
      if (bodyText && !["GET", "HEAD"].includes(method)) {
        cmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${bodyText.replace(/\n/g, "")}'`;
      }
      return cmd;
    }

    if (lang === "node") {
      return `import { RelayClient } from "@relay/sdk";\n\nconst relay = new RelayClient({ apiKey: "${apiKey}" });\n\n// Executing ${method} ${finalPath}\nconst response = await fetch("${fullUrl}", {\n  method: "${method}",\n  headers: {\n    "Authorization": "Bearer ${apiKey}",\n    "Content-Type": "application/json",\n    "Relay-Version": "${relayVersion}"\n  },\n  ${bodyText ? `body: JSON.stringify(${bodyText})` : ""}\n});\nconst data = await response.json();\nconsole.log(data);`;
    }

    if (lang === "python") {
      return `import requests\n\nurl = "${fullUrl}"\nheaders = {\n    "Authorization": "Bearer ${apiKey}",\n    "Content-Type": "application/json",\n    "Relay-Version": "${relayVersion}"\n}\n\nresponse = requests.${method.toLowerCase()}(\n    url,\n    headers=headers,\n    ${bodyText ? `json=${bodyText}` : ""}\n)\n\nprint(response.json())`;
    }

    return `// ${lang.toUpperCase()} request snippet\n// ${method} ${fullUrl}`;
  };

  return (
    <div className="space-y-4">
      {/* Sandbox Locked Mode Banner */}
      <div className="p-3 rounded-lg border border-[#3FB68B]/30 bg-[#3FB68B]/5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3FB68B] animate-pulse" />
          <span className="font-semibold text-text">Environment: Test Sandbox</span>
          <span className="text-text-muted">•</span>
          <span className="text-text-muted">
            Safe execution environment. Live telecom dispatch is locked to prevent charges.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 font-mono text-[11px] text-text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
            <Lock className="w-3 h-3 text-[#E0A93B]" /> Live Locked (Test Only)
          </div>
        </div>
      </div>

      {/* Recipes Bar & Chaining Notice */}
      <div className="p-4 rounded-xl border border-border bg-[#0C0C0F] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-text uppercase tracking-wider">
              Scenarios & Recipes:
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsAiGenerateModalOpen(true)}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate with AI</span>
            </button>

            {Object.entries(recipes).map(([key, r]) => (
              <button
                key={key}
                onClick={() => setSelectedRecipe(key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedRecipe === key
                    ? "bg-accent text-white shadow-sm"
                    : "bg-surface-2 border border-border text-text-muted hover:text-text hover:border-text-muted"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chaining Chips if IDs were returned */}
        {(chainedMessageId || chainedCustomerId) && (
          <div className="pt-2 border-t border-border/60 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-text-muted font-mono text-[11px]">Returned References:</span>
            {chainedMessageId && (
              <button
                onClick={() => {
                  setSelectedEndpointKey("delivery-status-get");
                  setMethod("GET");
                  setPath("/api/v1/delivery-status/:id");
                  setPathParamId(chainedMessageId);
                  setBodyText("");
                }}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent font-mono text-[11px] hover:bg-accent/25 transition-colors"
              >
                <span>Use Message ID: <code className="font-bold">{chainedMessageId}</code></span>
                <span className="text-[10px] text-text-muted">(Fetch Delivery Status)</span>
              </button>
            )}
            {chainedCustomerId && (
              <button
                onClick={() => {
                  setSelectedEndpointKey("customers-get");
                  setMethod("GET");
                  setPath("/api/v1/customers/:id");
                  setPathParamId(chainedCustomerId);
                  setBodyText("");
                }}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#3FB68B]/15 border border-[#3FB68B]/30 text-[#3FB68B] font-mono text-[11px] hover:bg-[#3FB68B]/25 transition-colors"
              >
                <span>Use Customer: <code className="font-bold">{chainedCustomerId}</code></span>
                <span className="text-[10px] text-text-muted">(Read Profile)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main 2-Column Playground Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Endpoint Config & Request Builder */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
            {/* 1. Endpoint Selector & Method */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono text-text-muted uppercase">
                Target Endpoint
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedEndpointKey}
                  onChange={(e) => handleEndpointSelect(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text focus:outline-none focus:border-accent font-mono"
                >
                  <optgroup label="Messages (SMS / WhatsApp / RCS)">
                    <option value="messages-send">POST /api/v1/messages (Dispatch)</option>
                    <option value="messages-get">GET /api/v1/messages/:id (Lookup)</option>
                    <option value="messages-list">GET /api/v1/messages (List)</option>
                    <option value="delivery-status-get">GET /api/v1/delivery-status/:id (Carrier DLR)</option>
                  </optgroup>
                  <optgroup label="Customer Data Platform (CDP)">
                    <option value="events-ingest">POST /api/v1/events (Track Event)</option>
                    <option value="customers-get">GET /api/v1/customers/:id (Read Profile)</option>
                    <option value="customers-update">PUT /api/v1/customers/:id (Upsert Profile)</option>
                  </optgroup>
                  <optgroup label="System & Quotas">
                    <option value="usage-get">GET /api/v1/usage (Rate Limits & Wallet)</option>
                    <option value="health-get">GET /api/v1/health (Carrier Heartbeat)</option>
                    <option value="webhook-endpoints-list">GET /api/v1/webhook_endpoints</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Path Param Form if applicable */}
            {path.includes(":id") && (
              <div className="space-y-1">
                <label className="block text-[11px] font-mono text-text-muted">
                  Path Parameter (:id) *
                </label>
                <input
                  type="text"
                  value={pathParamId}
                  onChange={(e) => setPathParamId(e.target.value)}
                  placeholder="e.g. msg_01jb9x7v2t4kzq8m or cust_acme_9912"
                  className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs font-mono text-text focus:outline-none focus:border-accent"
                />
              </div>
            )}

            {/* Header Configuration */}
            <div className="space-y-3 pt-2 border-t border-border/70">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-text-muted">Request Headers</span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-text-muted mb-1">
                    Authorization (API Key)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-2.5 py-1 rounded bg-surface-2 border border-border font-mono text-[11px] text-text focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-text-muted mb-1">
                      Relay-Version
                    </label>
                    <select
                      value={relayVersion}
                      onChange={(e) => setRelayVersion(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-surface-2 border border-border font-mono text-[11px] text-text focus:outline-none"
                    >
                      <option value="2025-10-01">2025-10-01 (Current)</option>
                      <option value="2025-01-15">2025-01-15 (Supported)</option>
                      <option value="2024-06-01">2024-06-01 (Deprecated)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-text-muted mb-1 flex items-center justify-between">
                      <span>Idempotency-Key</span>
                      <button
                        type="button"
                        onClick={handleGenerateIdempotency}
                        className="text-[10px] text-accent hover:underline font-mono"
                      >
                        Generate
                      </button>
                    </label>
                    <input
                      type="text"
                      value={idempotencyKey}
                      onChange={(e) => setIdempotencyKey(e.target.value)}
                      placeholder="Optional UUID v4"
                      className="w-full px-2 py-1 rounded bg-surface-2 border border-border font-mono text-[11px] text-text focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Request Body Editor */}
            {!["GET", "HEAD"].includes(method.toUpperCase()) && (
              <div className="space-y-1.5 pt-2 border-t border-border/70">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-text-muted uppercase">
                    JSON Request Body
                  </label>
                  {jsonError ? (
                    <span className="text-[10px] font-mono text-[#E5534B]">Invalid JSON</span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#3FB68B]">Valid JSON</span>
                  )}
                </div>

                <textarea
                  rows={8}
                  value={bodyText}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  className={`w-full p-3 rounded-lg bg-[#09090C] border font-mono text-xs text-[#ECECEF] focus:outline-none resize-y leading-relaxed ${
                    jsonError ? "border-[#E5534B]" : "border-border focus:border-accent"
                  }`}
                />

                {/* Helper test number injector */}
                <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
                  <span className="text-text-muted">Test numbers:</span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(bodyText);
                        parsed.to = "+919999900001";
                        setBodyText(JSON.stringify(parsed, null, 2));
                      } catch {}
                    }}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[#3FB68B] hover:border-[#3FB68B]"
                  >
                    +919999900001 (Success)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(bodyText);
                        parsed.to = "+919999900002";
                        setBodyText(JSON.stringify(parsed, null, 2));
                      } catch {}
                    }}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[#E0A93B] hover:border-[#E0A93B]"
                  >
                    +919999900002 (Fail Timeout)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(bodyText);
                        parsed.to = "+919999900003";
                        setBodyText(JSON.stringify(parsed, null, 2));
                      } catch {}
                    }}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[#5B9DFF] hover:border-[#5B9DFF]"
                  >
                    +919999900003 (DND)
                  </button>
                </div>
              </div>
            )}

            {/* Send Request Button */}
            <div className="pt-2">
              <button
                onClick={handleSend}
                disabled={loading || Boolean(jsonError)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50 transition-all shadow-accent-glow"
              >
                {loading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Executing Real Request...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 fill-current" />
                    <span>Send {method} Request to Sandbox</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (6 Cols): Response Panel, Code Generator, History */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-xl border border-border bg-[#0C0C0F] overflow-hidden flex flex-col min-h-[460px]">
            {/* Top Response Header Tabs */}
            <div className="flex items-center justify-between border-b border-border bg-[#09090C] px-4 py-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab("response")}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    activeTab === "response"
                      ? "bg-surface-2 text-text font-semibold border border-border"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  Response Body
                </button>
                <button
                  onClick={() => setActiveTab("headers")}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    activeTab === "headers"
                      ? "bg-surface-2 text-text font-semibold border border-border"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  Headers ({Object.keys(responseHeaders).length})
                </button>
                <button
                  onClick={() => setActiveTab("code")}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    activeTab === "code"
                      ? "bg-surface-2 text-text font-semibold border border-border"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  Copy as Code
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    activeTab === "history"
                      ? "bg-surface-2 text-text font-semibold border border-border"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  History ({history.length})
                </button>
              </div>

              {responseStatus !== null && (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                      responseStatus >= 200 && responseStatus < 300
                        ? "bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/30"
                        : "bg-[#E5534B]/15 text-[#E5534B] border border-[#E5534B]/30"
                    }`}
                  >
                    {responseStatus}
                  </span>
                  {durationMs !== null && (
                    <span className="text-[11px] font-mono text-text-muted">
                      {durationMs}ms
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Tab 1: Response Body & Error Remediation */}
            {activeTab === "response" && (
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                {response ? (
                  <div className="space-y-3">
                    {/* Error catalogue explanation callout if error */}
                    {errorExplanation && (
                      <div className="p-3.5 rounded-lg border border-[#E5534B]/30 bg-[#E5534B]/5 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#E5534B] flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Error Code: {errorExplanation.code}</span>
                          </span>
                          <Link
                            href={errorExplanation.docUrl}
                            target="_blank"
                            className="text-[11px] text-accent underline flex items-center gap-1"
                          >
                            <span>Read Error Docs</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">
                          {errorExplanation.description}
                        </p>
                        {errorExplanation.howToFix?.length > 0 && (
                          <div className="pt-1 text-[11px]">
                            <span className="text-text font-semibold">How to resolve:</span>
                            <ul className="list-disc list-inside text-text-muted mt-0.5 space-y-0.5">
                              {errorExplanation.howToFix.map((fix: string, idx: number) => (
                                <li key={idx}>{fix}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pretty JSON Viewer */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-text-muted uppercase">
                          JSON Response
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(response, null, 2));
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          className="text-[11px] font-mono text-accent hover:underline flex items-center gap-1"
                        >
                          {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCode ? "Copied" : "Copy JSON"}</span>
                        </button>
                      </div>

                      <pre className="p-3.5 rounded-lg bg-[#09090C] border border-border text-[#ECECEF] font-mono text-xs overflow-x-auto leading-relaxed max-h-[380px]">
                        {JSON.stringify(response, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-text-muted space-y-2">
                    <Terminal className="w-8 h-8 opacity-40 text-accent" />
                    <p className="text-xs">No request sent yet.</p>
                    <p className="text-[11px] text-text-muted/70 max-w-xs">
                      Choose an endpoint or scenario and click "Send Request to Sandbox" to execute live.
                    </p>
                  </div>
                )}

                {/* Footer with Request ID and Log Link */}
                {requestId && (
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-text-muted">
                      Request ID: <code className="text-accent">{requestId}</code>
                    </span>
                    <Link
                      href={`/console/logs?requestId=${requestId}`}
                      className="text-accent hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>View in Event Logs</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Response Headers with Rate Limit Highlight */}
            {activeTab === "headers" && (
              <div className="p-4 space-y-3 flex-1 text-xs">
                <span className="text-[11px] font-mono text-text-muted uppercase">
                  Returned Response Headers
                </span>

                <div className="divide-y divide-border/60 border border-border rounded-lg overflow-hidden bg-surface">
                  {Object.entries(responseHeaders).map(([key, value]) => {
                    const isRateLimit = key.startsWith("relay-ratelimit") || key === "relay-request-id";
                    return (
                      <div
                        key={key}
                        className={`p-2.5 flex items-baseline justify-between font-mono text-[11px] ${
                          isRateLimit ? "bg-[#3FB68B]/10" : ""
                        }`}
                      >
                        <span className={isRateLimit ? "text-[#3FB68B] font-bold" : "text-text-muted"}>
                          {key}
                        </span>
                        <span className="text-text font-semibold truncate max-w-[280px]">
                          {value}
                        </span>
                      </div>
                    );
                  })}
                  {Object.keys(responseHeaders).length === 0 && (
                    <div className="p-4 text-center text-text-muted text-xs">
                      Send a request to inspect response headers.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Copy as Code in all languages */}
            {activeTab === "code" && (
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {(["curl", "node", "python", "go"] as SupportedLanguage[]).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setActiveLanguage(lang)}
                          className={`px-2.5 py-1 rounded text-xs font-mono uppercase ${
                            activeLanguage === lang
                              ? "bg-accent text-white font-semibold"
                              : "bg-surface-2 border border-border text-text-muted"
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(getGeneratedCode(activeLanguage));
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="text-xs font-mono text-accent hover:underline flex items-center gap-1"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? "Copied" : "Copy Code"}</span>
                    </button>
                  </div>

                  <pre className="p-3.5 rounded-lg bg-[#09090C] border border-border text-[#ECECEF] font-mono text-xs overflow-x-auto leading-relaxed max-h-[360px]">
                    {getGeneratedCode(activeLanguage)}
                  </pre>
                </div>
              </div>
            )}

            {/* Tab 4: Request History */}
            {activeTab === "history" && (
              <div className="p-4 space-y-2 flex-1 overflow-y-auto max-h-[460px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-text-muted uppercase">
                    Recent Requests
                  </span>
                  <button
                    onClick={() => {
                      setHistory([]);
                      localStorage.removeItem("relay_playground_history");
                    }}
                    className="text-[11px] font-mono text-[#E5534B] hover:underline"
                  >
                    Clear History
                  </button>
                </div>

                {history.length > 0 ? (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setResponseStatus(item.status);
                          setResponse(item.body);
                          setRequestId(item.requestId);
                          setActiveTab("response");
                        }}
                        className="p-2.5 rounded-lg border border-border bg-surface hover:border-accent/60 transition-colors cursor-pointer flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.status >= 200 && item.status < 300
                                ? "bg-[#3FB68B]/15 text-[#3FB68B]"
                                : "bg-[#E5534B]/15 text-[#E5534B]"
                            }`}
                          >
                            {item.status}
                          </span>
                          <span className="text-text font-semibold">{item.method}</span>
                          <span className="text-text-muted truncate max-w-[180px]">{item.path}</span>
                        </div>

                        <div className="flex items-center gap-2 text-text-muted text-[10px]">
                          <span>{item.durationMs}ms</span>
                          <span>{item.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-text-muted text-xs">
                    No requests recorded yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Generate Code with AI Modal */}
      {isAiGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-[#0C0C0F] p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text flex items-center gap-2">
                    Generate Integration Code with AI
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#3FB68B]/10 text-[#3FB68B] border border-[#3FB68B]/30">
                      Grounded in api-spec.ts
                    </span>
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Generate production-ready code with automatic idempotency keys and 429 retry-backoff.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiGenerateModalOpen(false)}
                className="text-text-muted hover:text-text text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Quick suggestion chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-text-muted">Suggested Use Cases:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Send OTP via SMS with WhatsApp fallback",
                    "Ingest purchase event and update customer profile",
                    "Send WhatsApp order confirmation template",
                    "Handle 429 rate limit backoff in Node.js",
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setAiPrompt(sug);
                        handleGenerateCode(sug, aiLang);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface-2 border border-border hover:border-accent text-[11px] text-text-muted hover:text-text transition-colors text-left"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  Integration Requirement
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Send an OTP message to an Indian mobile number or ingest an order_completed event"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs text-text outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleGenerateCode();
                    }}
                  />
                  <button
                    onClick={() => handleGenerateCode()}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="px-4 py-2 rounded-lg bg-accent text-background text-xs font-bold hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{aiGenerating ? "Generating..." : "Generate"}</span>
                  </button>
                </div>
              </div>

              {/* Language Selector */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted font-mono text-[11px]">Target Language / Runtime:</span>
                <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-lg border border-border">
                  {(["curl", "node", "python", "go", "php"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setAiLang(lang);
                        if (aiPrompt.trim()) handleGenerateCode(aiPrompt, lang);
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase transition-colors ${
                        aiLang === lang
                          ? "bg-surface text-accent font-bold shadow-sm"
                          : "text-text-muted hover:text-text"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generated Result */}
              {aiGeneratedResult && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-accent/15 text-accent border border-accent/30">
                        {aiGeneratedResult.method} {aiGeneratedResult.path}
                      </span>
                      <span className="text-[11px] font-semibold text-[#3FB68B] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Schema Validated
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(aiGeneratedResult.code);
                          setAiCopied(true);
                          setTimeout(() => setAiCopied(false), 2000);
                        }}
                        className="px-2.5 py-1 rounded bg-surface border border-border hover:border-text-muted text-text text-[11px] font-mono flex items-center gap-1 transition-colors"
                      >
                        {aiCopied ? <Check className="w-3 h-3 text-[#3FB68B]" /> : <Copy className="w-3 h-3" />}
                        <span>{aiCopied ? "Copied" : "Copy Code"}</span>
                      </button>
                    </div>
                  </div>

                  <pre className="p-3.5 rounded-xl bg-[#09090B] border border-border font-mono text-xs text-text overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap">
                    {aiGeneratedResult.code}
                  </pre>

                  {/* Explanation of best practices */}
                  <div className="p-3 rounded-lg bg-surface-2/40 border border-border/60 text-[11px] text-text-muted space-y-1">
                    <span className="font-semibold text-text block">Built-in Production Guardrails:</span>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Includes unique <code className="text-accent font-mono">Idempotency-Key</code> header to prevent double-sends.</li>
                      <li>Includes HTTP 429 handler with <code className="text-accent font-mono">Retry-After</code> exponential backoff loop.</li>
                      <li>Uses environment variable references for API keys rather than hardcoding.</li>
                    </ul>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <button
                      onClick={handleLoadGeneratedIntoPlayground}
                      className="px-3.5 py-2 rounded-lg bg-surface-2 border border-border hover:border-text-muted text-xs font-bold text-text transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Terminal className="w-3.5 h-3.5 text-accent" />
                      <span>Load into Playground Editor</span>
                    </button>

                    <button
                      onClick={handleExecuteGeneratedCode}
                      disabled={aiRunningSandbox}
                      className="px-4 py-2 rounded-lg bg-[#3FB68B] text-black text-xs font-bold hover:bg-[#3FB68B]/90 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Play className={`w-3.5 h-3.5 ${aiRunningSandbox ? "animate-pulse" : ""}`} />
                      <span>{aiRunningSandbox ? "Executing in Sandbox..." : "Run in Sandbox Now"}</span>
                    </button>
                  </div>

                  {/* Sandbox Execution Result */}
                  {aiRunResult && (
                    <div className="p-3.5 rounded-xl bg-[#09090B] border border-border space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              aiRunResult.status >= 200 && aiRunResult.status < 300
                                ? "bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/30"
                                : "bg-[#E5534B]/15 text-[#E5534B] border border-[#E5534B]/30"
                            }`}
                          >
                            HTTP {aiRunResult.status}
                          </span>
                          <span className="text-text-muted text-[11px]">
                            {aiRunResult.latencyMs}ms latency
                          </span>
                        </div>
                        {aiRunResult.data?.id && (
                          <span className="text-[10px] text-accent">
                            ID: {aiRunResult.data.id}
                          </span>
                        )}
                      </div>

                      <pre className="p-2.5 rounded bg-surface border border-border text-[11px] text-text max-h-36 overflow-y-auto whitespace-pre-wrap">
                        {JSON.stringify(aiRunResult.data, null, 2)}
                      </pre>
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
