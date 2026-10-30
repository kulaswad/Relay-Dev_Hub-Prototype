"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useDevHub } from "@/components/providers/DevHubContext";
import {
  HelpCircle,
  Search,
  Bot,
  Terminal,
  Activity,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Send,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  Clock,
  Layers,
  Zap,
} from "lucide-react";

export default function SupportPage() {
  const { toggleHelpDrawer, environment, apiVersion, activeLanguage } = useDevHub();

  // Tier 1: Instant search & suggestions
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [supportData, setSupportData] = useState<any>(null);
  const [loadingProactive, setLoadingProactive] = useState(true);

  // Tier 2: Ask AI state
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<any>(null);
  const [aiFeedbackSent, setAiFeedbackSent] = useState<"up" | "down" | null>(null);

  // Tier 3: Ping
  const [pingRunning, setPingRunning] = useState(false);
  const [pingResult, setPingResult] = useState<{ status: number; latencyMs: number } | null>(null);

  // Tier 4: Talk to an Engineer
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [submittingThread, setSubmittingThread] = useState(false);
  const [threadCreated, setThreadCreated] = useState<any | null>(null);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [shareWorkspace, setShareWorkspace] = useState(true);
  const [shareEnv, setShareEnv] = useState(true);
  const [shareRequestIds, setShareRequestIds] = useState(true);
  const [shareWebhook, setShareWebhook] = useState(true);
  const [shareApiVersion, setShareApiVersion] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/internal/support?environment=${environment}`);
        if (res.ok) {
          const json = await res.json();
          setSupportData(json);
        }
      } catch (err) {
        console.error("Failed to load proactive support data:", err);
      } finally {
        setLoadingProactive(false);
      }
    }
    loadData();
  }, [environment]);

  // Instant Search
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
          const json = await res.json();
          setSearchResults(json.searchResults || []);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAskAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim() || aiLoading) return;
    setAiLoading(true);
    setAiAnswer(null);
    setAiFeedbackSent(null);

    try {
      const res = await fetch("/api/internal/ai/ask-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: aiQuestion }),
      });
      const data = await res.json();
      setAiAnswer(data);
    } catch (err: any) {
      setAiAnswer({
        answer: "Failed to connect to AI assistant. Please review the documentation directly.",
        canAnswer: false,
        sources: [],
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleFeedback = async (score: 1 | -1) => {
    if (!aiAnswer) return;
    try {
      await fetch("/api/internal/ai/ask-docs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackId: aiAnswer.feedbackId,
          score,
          comment: score === 1 ? "Helpful answer" : "Not helpful / Needs escalation",
        }),
      });
      setAiFeedbackSent(score === 1 ? "up" : "down");
    } catch (err) {
      console.error("Failed to submit feedback", err);
    }
  };

  const handleManualPing = async () => {
    setPingRunning(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/v1/health", { cache: "no-store" });
      const duration = Math.round(performance.now() - start);
      setPingResult({ status: res.status, latencyMs: duration });
    } catch {
      setPingResult({ status: 503, latencyMs: 0 });
    } finally {
      setPingRunning(false);
    }
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactSubject.trim() || !contactMessage.trim() || submittingThread) return;
    setSubmittingThread(true);

    const contextPayload = {
      workspace: shareWorkspace ? supportData?.context?.workspace?.id : null,
      environment: shareEnv ? environment : null,
      apiVersion: shareApiVersion ? apiVersion : null,
      sdkLanguage: activeLanguage,
      requestIds: shareRequestIds ? supportData?.context?.recentRequestIds : [],
      failingWebhooks: shareWebhook ? supportData?.context?.failingWebhooks : [],
    };

    try {
      const res = await fetch("/api/internal/support/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: contactSubject,
          message: contactMessage,
          category: "technical_integration",
          context: contextPayload,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setThreadCreated(json);
        setContactSubject("");
        setContactMessage("");
      }
    } catch (err) {
      console.error("Failed to submit support thread", err);
    } finally {
      setSubmittingThread(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-12">
      {/* Header */}
      <div className="space-y-4 border-b border-border pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20 mb-2">
            <span>Escalate without repeating yourself</span>
          </div>
          <h1 className="text-3xl font-extrabold text-text tracking-tight">
            Developer Support & Diagnostics
          </h1>
          <p className="text-sm text-text-muted leading-relaxed">
            Resolve issues instantly through automated diagnostics, grounded AI docs queries, or direct engineer escalation.
          </p>
        </div>

        <button
          onClick={toggleHelpDrawer}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-accent bg-accent/10 border border-accent/30 hover:bg-accent/20 rounded-lg transition-colors self-start md:self-end"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Open Side Drawer</span>
        </button>
      </div>

      {/* Tier 1: Self-Serve Instant Search & Failure Suggestions */}
      <div className="p-6 rounded-2xl border border-border bg-surface space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-accent font-bold text-xs">
              1
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Self-Serve: Search Docs & Failure Fixes</h2>
              <p className="text-xs text-text-muted">Type to search documentation chunks or view auto-detected fixes for your workspace.</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
            Instant (0s)
          </span>
        </div>

        {/* Proactive Failures Detected */}
        {supportData?.failureSuggestions && supportData.failureSuggestions.length > 0 && (
          <div className="p-4 rounded-xl border border-[#E0A93B]/30 bg-[#E0A93B]/5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#E0A93B]">
              <AlertTriangle className="w-4 h-4" />
              <span>Auto-Detected Failure in your recent API calls:</span>
            </div>
            {supportData.failureSuggestions.map((sug: any, idx: number) => (
              <div key={idx} className="text-xs space-y-1">
                <p className="text-text font-medium">{sug.message}</p>
                <div className="p-2.5 rounded bg-surface border border-border font-mono text-[11px] text-text-muted">
                  <span className="text-accent font-semibold">Suggested Fix: </span>
                  {sug.suggestedFix}
                  {sug.docLink && (
                    <Link href={sug.docLink} className="text-accent underline block mt-1 hover:text-accent/80">
                      Read guide →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search API reference, DLT setup, webhooks, error codes (e.g. 422 template mismatch)..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-2 border border-border text-xs text-text placeholder-text-muted/60 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Live Search Results */}
        {searchResults.length > 0 && (
          <div className="divide-y divide-border border border-border rounded-xl bg-surface-2/40 overflow-hidden">
            {searchResults.map((res: any, idx: number) => (
              <Link
                key={idx}
                href={res.slug.startsWith("/") ? res.slug : `/docs/${res.slug}`}
                className="p-3 block hover:bg-surface-2 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-text">{res.title}</span>
                  <span className="text-[10px] font-mono text-accent">/{res.slug}</span>
                </div>
                <p className="text-[11px] text-text-muted line-clamp-1">{res.snippet}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Tier 2: Grounded AI Assistant */}
      <div className="p-6 rounded-2xl border border-border bg-surface space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-accent font-bold text-xs">
              2
            </div>
            <div>
              <h2 className="text-sm font-bold text-text flex items-center gap-2">
                Ask Relay AI
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-accent/10 text-accent border border-accent/20">
                  Strictly Grounded
                </span>
              </h2>
              <p className="text-xs text-text-muted">Ask technical questions answered strictly from verified docs with citations.</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
            ~2s latency
          </span>
        </div>

        <form onSubmit={handleAskAi} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="e.g. How do I verify Relay-Signature in Node.js? Or what are the test phone numbers?"
              className="flex-1 px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-xs text-text placeholder-text-muted/60 focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={aiLoading || !aiQuestion.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent text-background text-xs font-bold hover:bg-accent/90 disabled:opacity-50 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiLoading ? "Consulting Docs..." : "Ask Docs"}</span>
            </button>
          </div>
        </form>

        {aiAnswer && (
          <div className="p-4 rounded-xl border border-border bg-surface-2/30 space-y-3">
            <div className="text-xs text-text leading-relaxed whitespace-pre-line">
              {aiAnswer.answer}
            </div>

            {aiAnswer.sources && aiAnswer.sources.length > 0 && (
              <div className="pt-2 border-t border-border/60">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                  Sources & Citations:
                </span>
                <div className="flex flex-wrap gap-2">
                  {aiAnswer.sources.map((s: any, idx: number) => (
                    <Link
                      key={idx}
                      href={s.slug.startsWith("/") ? s.slug : `/docs/${s.slug}`}
                      className="px-2 py-1 rounded bg-surface border border-border text-[11px] text-accent hover:border-accent flex items-center gap-1"
                    >
                      <span>[{idx + 1}] {s.title}</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
              <span className="text-[11px] text-text-muted">Was this answer helpful?</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFeedback(1)}
                  disabled={aiFeedbackSent !== null}
                  className={`p-1.5 rounded hover:bg-surface-2 text-text-muted transition-colors ${
                    aiFeedbackSent === "up" ? "text-[#3FB68B]" : ""
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleFeedback(-1)}
                  disabled={aiFeedbackSent !== null}
                  className={`p-1.5 rounded hover:bg-surface-2 text-text-muted transition-colors ${
                    aiFeedbackSent === "down" ? "text-[#E5534B]" : ""
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tier 3: Community & System Status */}
      <div className="p-6 rounded-2xl border border-border bg-surface space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-accent font-bold text-xs">
              3
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Platform Status & Community</h2>
              <p className="text-xs text-text-muted">Check live gateway uptime, verify sandbox connectivity, or chat in Slack.</p>
            </div>
          </div>
          <Link
            href="/status"
            className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
          >
            <span>Full Status Page</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Health Ping Card */}
          <div className="p-4 rounded-xl border border-border bg-surface-2/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-accent" />
                API Sandbox Connectivity
              </span>
              <button
                onClick={handleManualPing}
                disabled={pingRunning}
                className="px-2.5 py-1 rounded bg-surface border border-border text-[11px] font-bold text-text hover:border-text-muted transition-colors"
              >
                {pingRunning ? "Pinging..." : "Ping Now"}
              </button>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Verify that the REST API Sandbox gateway is accepting inbound HTTP traffic.
            </p>
            {pingResult && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  pingResult.status === 200 ? "bg-[#3FB68B]/15 text-[#3FB68B]" : "bg-[#E5534B]/15 text-[#E5534B]"
                }`}>
                  HTTP {pingResult.status}
                </span>
                <span className="text-text-muted text-[11px]">{pingResult.latencyMs}ms roundtrip</span>
              </div>
            )}
          </div>

          {/* Slack Community Card */}
          <div className="p-4 rounded-xl border border-border bg-surface-2/40 space-y-3">
            <span className="text-xs font-bold text-text flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[#3FB68B]" />
              Relay Developer Community
            </span>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Ask fellow builders and Relay staff engineers in real-time in our integration channels.
            </p>
            <div className="text-xs font-mono text-accent">
              relay-developers.slack.com #integrations
            </div>
          </div>
        </div>
      </div>

      {/* Tier 4: Talk to an Engineer */}
      <div className="p-6 rounded-2xl border border-border bg-surface space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-accent font-bold text-xs">
              4
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Talk to an Engineer</h2>
              <p className="text-xs text-text-muted">
                Escalate directly to our engineering team. System context is auto-attached to avoid back-and-forth.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-[#3FB68B] bg-[#3FB68B]/10 px-2.5 py-0.5 rounded border border-[#3FB68B]/30 font-semibold">
            SLA: &lt; 15 mins (Growth/Ent)
          </span>
        </div>

        {threadCreated ? (
          <div className="p-5 rounded-xl border border-[#3FB68B]/30 bg-[#3FB68B]/5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#3FB68B]">
              <CheckCircle2 className="w-5 h-5" />
              <span>Ticket #{threadCreated.thread?.id} Created Successfully</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Our engineer has received your pre-attached telemetry. Here is the initial response:
            </p>
            <div className="p-4 rounded-xl bg-surface border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between text-text-muted font-mono text-[11px]">
                <span className="font-bold text-text">Priya Sharma (Staff Solutions Engineer)</span>
                <span>Just now</span>
              </div>
              <p className="text-text leading-relaxed">
                {threadCreated.engineerReply?.message || "Thanks for attaching your request trace. Reviewing now..."}
              </p>
            </div>
            <button
              onClick={() => setThreadCreated(null)}
              className="px-3.5 py-1.5 rounded-lg bg-surface-2 border border-border text-xs font-bold text-text hover:border-text-muted"
            >
              Submit Another Inquiry
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateThread} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text mb-1">Subject</label>
              <input
                type="text"
                value={contactSubject}
                onChange={(e) => setContactSubject(e.target.value)}
                placeholder="e.g. DLT Template rejection or 429 backoff question"
                required
                className="w-full px-3.5 py-2 rounded-lg bg-surface-2 border border-border text-xs text-text placeholder-text-muted/60 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text mb-1">What are you seeing?</label>
              <textarea
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Describe your expected vs actual outcome..."
                rows={3}
                required
                className="w-full px-3.5 py-2 rounded-lg bg-surface-2 border border-border text-xs text-text placeholder-text-muted/60 focus:outline-none focus:border-accent resize-none"
              />
            </div>

            {/* Collapsible "What we'll share" section */}
            <div className="border border-border/80 rounded-xl overflow-hidden bg-surface-2/20">
              <button
                type="button"
                onClick={() => setIsContextExpanded(!isContextExpanded)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-text-muted hover:text-text hover:bg-surface-2/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-accent" />
                  <span className="font-semibold text-text">What we'll share (Auto-collected context)</span>
                </div>
                {isContextExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {isContextExpanded && (
                <div className="px-4 py-3 border-t border-border/60 bg-surface text-xs space-y-2.5">
                  <p className="text-[11px] text-text-muted">
                    We redact all secrets, auth tokens, passwords, and user message bodies automatically. Uncheck any telemetry you prefer to keep private:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareWorkspace}
                        onChange={(e) => setShareWorkspace(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-text">Workspace ID ({supportData?.context?.workspace?.id || "ws_active"})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareEnv}
                        onChange={(e) => setShareEnv(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-text">Environment ({environment})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareRequestIds}
                        onChange={(e) => setShareRequestIds(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-text">Last 10 Request IDs ({supportData?.context?.recentRequestIds?.length || 0} trace IDs)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareWebhook}
                        onChange={(e) => setShareWebhook(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-text">Failing Webhooks ({supportData?.context?.failingWebhooks?.length || 0} endpoints)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submittingThread}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-background text-xs font-bold hover:bg-accent/90 disabled:opacity-50 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submittingThread ? "Submitting Context..." : "Open Engineer Thread"}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}