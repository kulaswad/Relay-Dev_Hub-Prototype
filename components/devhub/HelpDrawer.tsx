"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useDevHub } from "@/components/providers/DevHubContext";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  HelpCircle,
  Layers,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Terminal,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from "lucide-react";

export function HelpDrawer() {
  const {
    isHelpDrawerOpen,
    setHelpDrawerOpen,
    helpTab,
    setHelpTab,
    environment,
    apiVersion,
    activeLanguage,
  } = useDevHub();

  const [loadingContext, setLoadingContext] = useState(false);
  const [supportData, setSupportData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Ask AI State
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<any>(null);
  const [aiFeedbackSent, setAiFeedbackSent] = useState<"up" | "down" | null>(null);
  const [aiTranscript, setAiTranscript] = useState<Array<{ q: string; a: string; sources: any[] }>>([]);

  // Sandbox Ping State
  const [pingStatus, setPingStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  // Contact Form State
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [submittingThread, setSubmittingThread] = useState(false);
  const [threadSuccessMsg, setThreadSuccessMsg] = useState<string | null>(null);

  // Collapsible Context Selection
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [shareWorkspace, setShareWorkspace] = useState(true);
  const [shareEnv, setShareEnv] = useState(true);
  const [shareRequestIds, setShareRequestIds] = useState(true);
  const [shareWebhook, setShareWebhook] = useState(true);
  const [shareApiVersion, setShareApiVersion] = useState(true);
  const [shareAiTranscript, setShareAiTranscript] = useState(true);

  // Threads list
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Fetch support proactive data & auto-collected context
  useEffect(() => {
    if (!isHelpDrawerOpen) return;

    async function loadSupportData() {
      setLoadingContext(true);
      try {
        const res = await fetch(`/api/internal/support?environment=${environment}`);
        if (res.ok) {
          const data = await res.json();
          setSupportData(data);
        }
      } catch (err) {
        console.error("Failed to load support context", err);
      } finally {
        setLoadingContext(false);
      }
    }

    loadSupportData();
    fetchThreads();
  }, [isHelpDrawerOpen, environment]);

  // Live Docs Search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/internal/support?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.searchResults || []);
        }
      } catch (err) {
        console.error("Instant search failed", err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Existing Threads
  const fetchThreads = async () => {
    setLoadingThreads(true);
    try {
      const res = await fetch("/api/internal/support/threads");
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
        if (data.threads?.length > 0 && !selectedThread) {
          setSelectedThread(data.threads[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load support threads", err);
    } finally {
      setLoadingThreads(false);
    }
  };

  // Run Sandbox Ping
  const handleSandboxPing = async () => {
    setPingStatus("running");
    const startTime = Date.now();
    try {
      const res = await fetch("/api/v1/health", { cache: "no-store" });
      const latency = Date.now() - startTime;
      setPingLatency(latency);
      if (res.ok) {
        setPingStatus("success");
      } else {
        setPingStatus("error");
      }
    } catch {
      setPingStatus("error");
      setPingLatency(Date.now() - startTime);
    }
  };

  // Submit Question to AI
  const handleAskAi = async (customQuestion?: string) => {
    const q = customQuestion || aiQuestion;
    if (!q.trim()) return;

    setAiLoading(true);
    setAiFeedbackSent(null);
    try {
      const res = await fetch("/api/internal/ai/ask-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          version: apiVersion,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnswer(data);
        setAiTranscript((prev) => [...prev, { q, a: data.answer, sources: data.sources || [] }]);
      } else {
        setAiAnswer({
          answer: "I couldn't retrieve an answer right now. Would you like to escalate this question to our engineering team?",
          canAnswer: false,
          sources: [],
          suggestEscalation: true,
        });
      }
    } catch (err: any) {
      setAiAnswer({
        answer: "Failed to connect to the knowledge engine. Please check your network or escalate to our engineers.",
        canAnswer: false,
        sources: [],
        suggestEscalation: true,
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Submit Feedback on AI Answer
  const handleFeedback = async (type: "up" | "down") => {
    setAiFeedbackSent(type);
    try {
      await fetch("/api/internal/docs/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePath: `/docs/ai/ask?q=${encodeURIComponent(aiQuestion)}`,
          helpful: type === "up",
          comment: type === "up" ? "Helpful AI answer" : "Unhelpful AI answer",
          version: apiVersion,
        }),
      });
    } catch {}
  };

  // Escalate from AI to Engineer Form
  const handleEscalateFromAi = () => {
    setContactSubject(`Question regarding: ${aiQuestion.slice(0, 60)}...`);
    setContactMessage(
      `I asked the AI Docs Assistant: "${aiQuestion}"\n\nThe response did not fully answer my requirement:\n"${aiAnswer?.answer?.slice(0, 200)}..."\n\nPlease assist with the correct integration steps.`
    );
    setHelpTab("contact");
  };

  // Submit Support Ticket to Engineer
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactSubject.trim() || !contactMessage.trim()) return;

    setSubmittingThread(true);
    setThreadSuccessMsg(null);

    // Build context payload based on user checkboxes
    const context: Record<string, any> = {};
    const auto = supportData?.autoCollectedContext;
    if (shareWorkspace && auto?.workspaceId) context.workspaceId = auto.workspaceId;
    if (shareEnv) context.environment = environment;
    if (shareRequestIds && auto?.last10RequestIds) context.last10RequestIds = auto.last10RequestIds;
    if (shareWebhook && auto?.failingWebhookEndpoint) context.failingWebhook = auto.failingWebhookEndpoint;
    if (shareApiVersion) context.apiVersion = apiVersion;
    if (shareAiTranscript && aiTranscript.length > 0) context.aiTranscript = aiTranscript;
    context.sdkLanguage = activeLanguage;

    try {
      const res = await fetch("/api/internal/support/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: contactSubject,
          message: contactMessage,
          context,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setThreadSuccessMsg(data.message);
        setContactSubject("");
        setContactMessage("");
        await fetchThreads();
        setTimeout(() => {
          setHelpTab("threads");
          setThreadSuccessMsg(null);
        }, 1500);
      } else {
        alert("Failed to submit support request.");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setSubmittingThread(false);
    }
  };

  if (!isHelpDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-xl border-l border-border bg-[#0E0E11] text-text flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
          {/* 1. Header Bar */}
          <div className="p-4 border-b border-border bg-surface flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-text">Relay Developer Help</h2>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-[#3FB68B]/10 text-[#3FB68B] border border-[#3FB68B]/30 flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3FB68B] animate-pulse" />
                    Tiered Escalation
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Get unblocked fast with self-serve diagnostics, AI docs, and engineer escalation.
                </p>
              </div>
            </div>

            <button
              onClick={() => setHelpDrawerOpen(false)}
              className="p-1.5 rounded-lg border border-border hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Tier Escalator Tabs */}
          <div className="grid grid-cols-5 border-b border-border text-[11px] font-mono bg-[#16161A]">
            {[
              { id: "self_serve", label: "1. Search", icon: Search },
              { id: "ask_docs", label: "2. Ask AI", icon: Sparkles },
              { id: "status", label: "3. Status", icon: ShieldAlert },
              { id: "contact", label: "4. Engineer", icon: MessageSquare },
              {
                id: "threads",
                label: "Requests",
                icon: Clock,
                badge: threads.length > 0 ? `${threads.length}` : undefined,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = helpTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setHelpTab(tab.id as any)}
                  className={`py-2.5 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 transition-all border-b-2 ${
                    isActive
                      ? "border-accent text-white font-bold bg-surface"
                      : "border-transparent text-text-muted hover:text-text hover:bg-surface-2/40"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-accent" : "text-text-muted"}`} />
                  <span className="truncate">{tab.label}</span>
                  {tab.badge && (
                    <span className="hidden sm:inline px-1 rounded-full text-[9px] bg-accent/20 text-accent font-bold">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 3. Main Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* TIER 1: SELF-SERVE & COMMON FIXES */}
            {helpTab === "self_serve" && (
              <div className="space-y-4">
                {/* Proactive Recent Failure Suggestions */}
                {supportData?.failureSuggestions && supportData.failureSuggestions.length > 0 && (
                  <div className="p-4 rounded-xl border border-[#E0A93B]/40 bg-[#E0A93B]/5 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#E0A93B]" />
                      <span className="text-xs font-bold text-text">
                        Detected Recent Integration Failures
                      </span>
                    </div>
                    {supportData.failureSuggestions.slice(0, 2).map((sug: any, i: number) => (
                      <div key={i} className="text-xs space-y-1 border-t border-border/40 pt-2">
                        <span className="font-mono font-bold text-[#E0A93B] block">
                          {sug.message}
                        </span>
                        <p className="text-text-muted leading-relaxed">{sug.fix}</p>
                        <Link
                          href={sug.docUrl}
                          className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline font-mono"
                        >
                          View Official Error Reference →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                {/* Instant Search Box */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text flex items-center justify-between">
                    <span>Instant Documentation Search</span>
                    <span className="text-[10px] font-mono text-text-muted">Type to search</span>
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search DLT, webhooks, idempotency, rate limits..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-surface text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                    {searching && (
                      <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-3 text-accent animate-spin" />
                    )}
                  </div>
                </div>

                {/* Instant Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase text-text-muted">
                      Matching Doc Chunks
                    </span>
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                      {searchResults.map((item) => (
                        <Link
                          key={item.id}
                          href={item.url}
                          className="p-3 rounded-lg border border-border bg-surface hover:bg-surface-2 block space-y-1 transition-all"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-text truncate">{item.title}</span>
                            <span className="font-mono text-[10px] text-text-muted">
                              {item.section}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                            {item.snippet}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Reference Guide Shortcuts */}
                <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                  <span className="text-xs font-bold text-text block">Popular Developer Guides</span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <Link
                      href="/docs/guides/templates-dlt"
                      className="p-2.5 rounded-lg border border-border bg-surface-2/60 hover:bg-surface-2 transition-all flex items-center justify-between text-text hover:text-accent"
                    >
                      <span>DLT Explained</span>
                      <ArrowRight className="w-3 h-3 text-text-muted" />
                    </Link>
                    <Link
                      href="/docs/guides/sandbox-testing"
                      className="p-2.5 rounded-lg border border-border bg-surface-2/60 hover:bg-surface-2 transition-all flex items-center justify-between text-text hover:text-accent"
                    >
                      <span>Test Numbers</span>
                      <ArrowRight className="w-3 h-3 text-text-muted" />
                    </Link>
                    <Link
                      href="/docs/guides/idempotency"
                      className="p-2.5 rounded-lg border border-border bg-surface-2/60 hover:bg-surface-2 transition-all flex items-center justify-between text-text hover:text-accent"
                    >
                      <span>Idempotency</span>
                      <ArrowRight className="w-3 h-3 text-text-muted" />
                    </Link>
                    <Link
                      href="/docs/webhooks"
                      className="p-2.5 rounded-lg border border-border bg-surface-2/60 hover:bg-surface-2 transition-all flex items-center justify-between text-text hover:text-accent"
                    >
                      <span>HMAC Signatures</span>
                      <ArrowRight className="w-3 h-3 text-text-muted" />
                    </Link>
                  </div>
                </div>

                {/* Escalation Button to Step 2 */}
                <div className="pt-2">
                  <button
                    onClick={() => setHelpTab("ask_docs")}
                    className="w-full py-2.5 rounded-lg border border-accent/40 bg-accent/10 hover:bg-accent/20 text-accent font-medium text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Need a custom answer? Ask AI Assistant →
                  </button>
                </div>
              </div>
            )}

            {/* TIER 2: ASK AI ("ASK THE DOCS") */}
            {helpTab === "ask_docs" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      Ask the Relay Documentation
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">
                      v2025-10-01 Grounded
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Strictly grounded in Relay API guides with verifiable source citations.
                  </p>
                </div>

                {/* Question Input */}
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      rows={3}
                      placeholder="e.g. Do I need an MCA DLT Principal Entity ID in test sandbox mode?"
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      className="w-full p-3 rounded-lg border border-border bg-surface text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                    />
                    <button
                      onClick={() => handleAskAi()}
                      disabled={aiLoading || !aiQuestion.trim()}
                      className="absolute right-2.5 bottom-3 px-3 py-1.5 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      {aiLoading ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>{aiLoading ? "Searching..." : "Ask"}</span>
                    </button>
                  </div>

                  {/* Preset prompt pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "How do I handle 429 rate limits?",
                      "Do I need an MCA DLT ID in sandbox?",
                      "How does webhook HMAC verification work?",
                      "Can I ingest events without a customer profile?",
                    ].map((pill, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setAiQuestion(pill);
                          handleAskAi(pill);
                        }}
                        className="px-2.5 py-1 rounded-full text-[10px] font-mono border border-border bg-surface-2/60 hover:bg-surface-2 text-text-muted hover:text-text transition-all"
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Answer Display */}
                {aiAnswer && (
                  <div className="p-4 rounded-xl border border-border bg-surface space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-accent" />
                        <span className="text-xs font-bold text-text">Relay AI Response</span>
                        {aiAnswer.isFallback && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-muted font-mono">
                            Rule-based Fallback
                          </span>
                        )}
                      </div>
                      {/* Thumbs Feedback */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleFeedback("up")}
                          className={`p-1 rounded hover:bg-surface-2 transition-colors ${
                            aiFeedbackSent === "up" ? "text-[#3FB68B]" : "text-text-muted"
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleFeedback("down")}
                          className={`p-1 rounded hover:bg-surface-2 transition-colors ${
                            aiFeedbackSent === "down" ? "text-[#E5534B]" : "text-text-muted"
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Answer text */}
                    <div className="text-xs text-text leading-relaxed whitespace-pre-line space-y-2">
                      {aiAnswer.answer}
                    </div>

                    {/* Sources Citations */}
                    {aiAnswer.sources && aiAnswer.sources.length > 0 && (
                      <div className="border-t border-border/50 pt-2 space-y-1">
                        <span className="text-[10px] font-mono uppercase text-text-muted block">
                          Grounded Sources:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {aiAnswer.sources.map((s: any) => (
                            <Link
                              key={s.id}
                              href={s.url}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-surface-2 hover:border-accent/40 text-text transition-all"
                            >
                              <span>[{s.index}]</span>
                              <span className="truncate max-w-[120px]">{s.title}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-text-muted" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unhelpful / Refusal Escalation Prompt */}
                    {(!aiAnswer.canAnswer || aiAnswer.suggestEscalation) && (
                      <div className="p-3 rounded-lg border border-[#E0A93B]/40 bg-[#E0A93B]/5 space-y-2 mt-3">
                        <span className="text-xs font-bold text-text block">
                          Didn't find what you need?
                        </span>
                        <p className="text-[11px] text-text-muted leading-relaxed">
                          Our solutions engineering team can review your specific payload or query directly.
                        </p>
                        <button
                          onClick={handleEscalateFromAi}
                          className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Escalate Question to an Engineer →</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TIER 3: SYSTEM STATUS & KNOWN ISSUES */}
            {helpTab === "status" && (
              <div className="space-y-4">
                {/* Live Sandbox Ping Tester */}
                <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-text flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-accent" />
                        Live API Sandbox Health Ping
                      </h3>
                      <p className="text-[11px] text-text-muted">
                        Pings real <code className="font-mono text-accent">/api/v1/health</code> route from your browser.
                      </p>
                    </div>
                    <button
                      onClick={handleSandboxPing}
                      disabled={pingStatus === "running"}
                      className="px-3 py-1 rounded-lg border border-border hover:bg-surface-2 text-xs font-medium text-text flex items-center gap-1.5 transition-all"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${pingStatus === "running" ? "animate-spin text-accent" : ""}`}
                      />
                      <span>Ping Sandbox</span>
                    </button>
                  </div>

                  {pingStatus !== "idle" && (
                    <div
                      className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                        pingStatus === "success"
                          ? "border-[#3FB68B]/30 bg-[#3FB68B]/10 text-[#3FB68B]"
                          : pingStatus === "running"
                          ? "border-border bg-surface-2 text-text-muted"
                          : "border-[#E5534B]/30 bg-[#E5534B]/10 text-[#E5534B]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        {pingStatus === "success"
                          ? "HTTP 200 OK — Sandbox Operational"
                          : pingStatus === "running"
                          ? "Connecting to gateway..."
                          : "Health check error"}
                      </span>
                      <span>Latency: {pingLatency !== null ? `${pingLatency}ms` : "..."}</span>
                    </div>
                  )}
                </div>

                {/* Overall System Health Card */}
                <div className="p-4 rounded-xl border border-[#3FB68B]/30 bg-[#3FB68B]/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-[#3FB68B]" />
                    <div>
                      <h4 className="text-xs font-bold text-text">All Carriers & Gateways Operational</h4>
                      <p className="text-[11px] text-text-muted">Mumbai region 99.99% 90-day uptime.</p>
                    </div>
                  </div>
                  <Link
                    href="/status"
                    className="text-xs text-accent hover:underline font-mono flex items-center gap-1"
                  >
                    Full Status <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {/* Known Issues List */}
                <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text">Known Issues & Workarounds</span>
                    <span className="text-[10px] font-mono text-text-muted">Updated daily</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-lg border border-border bg-surface-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text">Meta WhatsApp Weekend Review Lag</span>
                        <span className="text-[10px] font-mono px-1.5 rounded bg-accent/15 text-accent">
                          Workaround
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        Submit WhatsApp OTP templates on weekdays between 9 AM and 6 PM IST for approval in under 15 minutes.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-surface-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text">Node 18+ Webhook Listener Keep-Alive</span>
                        <span className="text-[10px] font-mono px-1.5 rounded bg-accent/15 text-accent">
                          Workaround
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        Configure custom http.Agent with <code className="font-mono text-text">keepAlive: true</code> and maxSockets: 50.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Community Slack */}
                <div className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-text">Relay Developer Community</h4>
                    <p className="text-[11px] text-text-muted">
                      Join 2,400+ Indian engineers on our official Slack.
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-accent font-semibold">
                    relay-developers.slack.com
                  </span>
                </div>
              </div>
            )}

            {/* TIER 4: TALK TO AN ENGINEER (ESCALATION FORM) */}
            {helpTab === "contact" && (
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-text">Escalate Directly to an Engineer</h3>
                  <p className="text-[11px] text-text-muted">
                    We automatically attach relevant telemetry so you never have to repeat yourself.
                  </p>
                </div>

                {/* SLA Expectation Banner */}
                <div className="p-3 rounded-lg border border-accent/30 bg-accent/5 flex items-center justify-between text-xs">
                  <span className="text-text font-medium">Expected Response Window:</span>
                  <span className="font-mono font-bold text-accent">
                    {supportData?.autoCollectedContext?.slaExpectation || "Within 4 hours (Growth Plan)"}
                  </span>
                </div>

                {threadSuccessMsg && (
                  <div className="p-3.5 rounded-lg border border-[#3FB68B]/30 bg-[#3FB68B]/10 text-xs text-[#3FB68B] font-mono">
                    {threadSuccessMsg}
                  </div>
                )}

                {/* Subject */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text">Subject / Brief Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 422 Template mismatch error on POST /v1/messages"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Message */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text">Details & Context</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Explain what behavior you expected vs what occurred..."
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    className="w-full p-3 rounded-lg border border-border bg-surface text-xs text-text focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                {/* Collapsible Auto-Collected Context ("What we'll share") */}
                <div className="rounded-xl border border-border bg-surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsContextExpanded(!isContextExpanded)}
                    className="w-full p-3 flex items-center justify-between text-xs hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-accent" />
                      <span className="font-bold text-text">
                        What we'll share with the engineering team
                      </span>
                    </div>
                    {isContextExpanded ? (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    )}
                  </button>

                  {isContextExpanded && (
                    <div className="p-3.5 border-t border-border/60 bg-surface-2 space-y-2.5 text-xs font-mono">
                      <p className="text-[10px] text-text-muted font-sans pb-1">
                        Uncheck any items you do not wish to include in your ticket:
                      </p>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shareWorkspace}
                          onChange={(e) => setShareWorkspace(e.target.checked)}
                          className="rounded border-border text-accent"
                        />
                        <span>Workspace: {supportData?.autoCollectedContext?.workspaceName} ({supportData?.autoCollectedContext?.workspaceId})</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shareEnv}
                          onChange={(e) => setShareEnv(e.target.checked)}
                          className="rounded border-border text-accent"
                        />
                        <span>Environment: {environment.toUpperCase()}</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shareRequestIds}
                          onChange={(e) => setShareRequestIds(e.target.checked)}
                          className="rounded border-border text-accent"
                        />
                        <span>
                          Last 10 Request IDs ({supportData?.autoCollectedContext?.last10RequestIds?.length || 0} attached)
                        </span>
                      </label>

                      {supportData?.autoCollectedContext?.failingWebhookEndpoint && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={shareWebhook}
                            onChange={(e) => setShareWebhook(e.target.checked)}
                            className="rounded border-border text-accent"
                          />
                          <span className="text-[#E0A93B]">
                            Failing Webhook: {supportData.autoCollectedContext.failingWebhookEndpoint}
                          </span>
                        </label>
                      )}

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shareApiVersion}
                          onChange={(e) => setShareApiVersion(e.target.checked)}
                          className="rounded border-border text-accent"
                        />
                        <span>API Version: {apiVersion} (SDK: {activeLanguage})</span>
                      </label>

                      {aiTranscript.length > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={shareAiTranscript}
                            onChange={(e) => setShareAiTranscript(e.target.checked)}
                            className="rounded border-border text-accent"
                          />
                          <span>AI Chat History ({aiTranscript.length} interaction)</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={submittingThread || !contactSubject.trim() || !contactMessage.trim()}
                  className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingThread ? "Submitting..." : "Submit to Engineering"}</span>
                </button>
              </form>
            )}

            {/* MY REQUESTS / THREADS TAB */}
            {helpTab === "threads" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-xs font-bold text-text">Support Threads & Inquiries</span>
                  <button
                    onClick={fetchThreads}
                    className="text-[11px] text-accent hover:underline flex items-center gap-1 font-mono"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {threads.length > 0 ? (
                  <div className="space-y-3">
                    {threads.map((thread) => (
                      <div
                        key={thread.id}
                        onClick={() => setSelectedThread(thread)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          selectedThread?.id === thread.id
                            ? "border-accent bg-surface"
                            : "border-border bg-surface/50 hover:bg-surface"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-text truncate max-w-[240px]">
                            {thread.subject}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                              thread.status === "resolved"
                                ? "bg-[#3FB68B]/10 text-[#3FB68B] border border-[#3FB68B]/20"
                                : "bg-accent/10 text-accent border border-accent/20"
                            }`}
                          >
                            {thread.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted font-mono truncate">
                          ID: {thread.id} • {thread.messages?.length || 0} messages
                        </p>
                      </div>
                    ))}

                    {/* Selected Thread Conversation View */}
                    {selectedThread && (
                      <div className="border border-border rounded-xl bg-surface p-4 space-y-3">
                        <div className="border-b border-border/60 pb-2 flex justify-between items-center text-xs">
                          <span className="font-bold text-text">{selectedThread.subject}</span>
                          <span className="text-[10px] font-mono text-text-muted">
                            {new Date(selectedThread.createdAt).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>

                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {selectedThread.messages?.map((msg: any, mIdx: number) => (
                            <div
                              key={mIdx}
                              className={`p-3 rounded-lg text-xs space-y-1 ${
                                msg.sender === "engineer"
                                  ? "bg-accent/10 border border-accent/30 text-text ml-4"
                                  : "bg-surface-2 border border-border text-text mr-4"
                              }`}
                            >
                              <div className="flex justify-between items-center text-[10px] font-mono text-text-muted">
                                <span className="font-bold text-text">{msg.authorName}</span>
                                <span>
                                  {new Date(msg.timestamp).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="text-xs leading-relaxed whitespace-pre-line">{msg.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-text-muted space-y-2">
                    <MessageSquare className="w-6 h-6 text-text-muted mx-auto" />
                    <p>No support requests created yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
