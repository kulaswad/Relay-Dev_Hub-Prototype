"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Lock,
  Code2,
  Webhook,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Database,
  Cpu,
  RefreshCw,
  EyeOff,
  Flame,
} from "lucide-react";
import { CodeBlock, Callout, StatusPill } from "@/components/devhub";

export default function AIDocumentationPage() {
  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="space-y-2 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <StatusPill variant="live" label="Production AI System" size="sm" />
          <span className="text-[11px] font-mono text-text-muted">Gemini 2.5 Flash + Deterministic Guardrails</span>
        </div>
        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          AI Architecture, Privacy & Guardrails
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          How Relay Developer Hub integrates AI into developer workflows with zero hallucinations, deterministic pre-diagnostics, rigorous secret redaction, and graceful offline fallbacks.
        </p>
      </div>

      {/* Core Principles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Lock className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-text">Zero Secret Leakage</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            API keys (<code className="text-accent font-mono">rl_test_</code>, <code className="text-[#3FB68B] font-mono">rl_live_</code>), webhook secrets (<code className="text-[#E0A93B] font-mono">whsec_</code>), and bearer tokens are redacted prior to LLM evaluation.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
          <div className="w-8 h-8 rounded-lg bg-[#3FB68B]/10 border border-[#3FB68B]/20 flex items-center justify-center text-[#3FB68B]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-text">Strict Docs Grounding</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            "Ask the Docs" answers ONLY from indexed documentation chunks. If an answer cannot be grounded in our docs, the AI explicitly refuses and offers escalation.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
          <div className="w-8 h-8 rounded-lg bg-[#E0A93B]/10 border border-[#E0A93B]/20 flex items-center justify-center text-[#E0A93B]">
            <Cpu className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-text">Deterministic First</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            Diagnostics (like webhook HMAC verification or schema linting) run mathematically first. LLMs provide plain-English interpretation, not mathematical guesses.
          </p>
        </div>
      </div>

      {/* Feature A: Ask the Docs */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-xs">
            A
          </div>
          <h2 className="text-xl font-bold text-text">Ask the Docs (Grounded Q&A)</h2>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Located in the global Help Drawer and on our Support page, "Ask the Docs" allows developers to ask natural language questions about Relay APIs, DLT compliance, webhooks, and rate limits.
        </p>

        <div className="p-4 rounded-xl border border-border bg-surface-2/30 space-y-3">
          <h4 className="text-xs font-bold text-text uppercase tracking-wider text-text-muted">
            Grounding & Anti-Hallucination Pipeline
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-xs text-text-muted">
            <li>
              <span className="text-text font-semibold">Semantic Token Retrieval:</span> The user query is tokenized and matched against all pre-indexed <code className="font-mono text-text">doc_chunks</code> in the database using BM25-style term weighting.
            </li>
            <li>
              <span className="text-text font-semibold">Strict Context Prompting:</span> The top matching chunks are passed as numbered sources (<code className="font-mono text-accent">[1]</code>, <code className="font-mono text-accent">[2]</code>). The system prompt mandates answering ONLY using facts from these chunks and citing them inline.
            </li>
            <li>
              <span className="text-text font-semibold">Explicit Refusal Guardrail:</span> If the chunks do not contain sufficient evidence to answer the question, the response returns <code className="font-mono text-[#E5534B]">canAnswer: false</code> and suggests checking related sections or escalating to engineering.
            </li>
            <li>
              <span className="text-text font-semibold">Anti-Hallucination Post-Validation:</span> A post-check scans the LLM output against <code className="font-mono text-text">api-spec.ts</code> and <code className="font-mono text-text">ERROR_REGISTRY</code> to ensure no non-existent HTTP routes or made-up error codes were mentioned.
            </li>
          </ol>
        </div>
      </section>

      {/* Feature B: Integration Code Generator */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-xs">
            B
          </div>
          <h2 className="text-xl font-bold text-text">Integration Code Generator</h2>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Available in the Playground and API reference, developers can generate copy-pasteable integration code in <code className="text-accent font-mono">cURL</code>, <code className="text-accent font-mono">Node.js</code>, <code className="text-accent font-mono">Python</code>, <code className="text-accent font-mono">Go</code>, or <code className="text-accent font-mono">PHP</code> tailored to their exact use case.
        </p>

        <div className="p-4 rounded-xl border border-border bg-surface-2/30 space-y-3">
          <h4 className="text-xs font-bold text-text uppercase tracking-wider text-text-muted">
            Enforced Best Practices in Generated Code
          </h4>
          <ul className="space-y-2 text-xs text-text-muted list-disc list-inside">
            <li>
              <span className="text-text font-semibold">Idempotency Keys:</span> Every state-mutating request (<code className="font-mono text-text">POST /v1/messages</code>, <code className="font-mono text-text">POST /v1/events</code>) automatically generates a unique UUID v4 idempotency key.
            </li>
            <li>
              <span className="text-text font-semibold">Rate Limit Backoff:</span> Generated code includes an HTTP 429 handler that inspects the <code className="font-mono text-text">Retry-After</code> response header and pauses execution before retrying.
            </li>
            <li>
              <span className="text-text font-semibold">Environment Variables Only:</span> Live keys are never hardcoded; samples use <code className="font-mono text-accent">process.env.RELAY_API_KEY</code> or <code className="font-mono text-accent">os.environ.get(&quot;RELAY_API_KEY&quot;)</code>.
            </li>
            <li>
              <span className="text-text font-semibold">One-Click Sandbox Execution:</span> Generated payloads can be executed immediately against the live Sandbox API using an ephemeral test session.
            </li>
          </ul>
        </div>
      </section>

      {/* Feature C: Explain This Failed Webhook */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-xs">
            C
          </div>
          <h2 className="text-xl font-bold text-text">Explain This Failed Webhook (Diagnostics)</h2>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Integrated into the Webhook Deliveries and Event Logs consoles, this feature diagnoses failing webhook attempts using a two-phase diagnostic engine.
        </p>

        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Phase 1: Deterministic Static Diagnostics</span>
            <p className="text-xs text-text-muted leading-relaxed">
              Before calling any AI model, Relay executes deterministic mathematical validations:
            </p>
            <ul className="text-xs text-text-muted list-disc list-inside space-y-1">
              <li>
                <span className="text-text font-medium">Raw vs Re-serialized HMAC Recomputation:</span> We compute the HMAC-SHA256 signature over the raw payload buffer AND over re-serialized JSON (<code className="font-mono text-text">JSON.stringify(JSON.parse(raw))</code>). If the customer's server failed with 401 and the signature matches the re-serialized body, we detect the classic body-parser re-serialization bug with 100% certainty.
              </li>
              <li>
                <span className="text-text font-medium">Timestamp Drift Check:</span> Verifies whether the webhook timestamp header (<code className="font-mono text-text">t=...</code>) exceeds tolerance thresholds.
              </li>
              <li>
                <span className="text-text font-medium">Null Field & Stack Trace Pattern Matching:</span> Scans the response body for common uncaught exceptions (such as <code className="font-mono text-text">TypeError: Cannot read properties of null (reading &apos;toString&apos;)</code> when <code className="font-mono text-text">failure_reason</code> is null for delivered events).
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
            <span className="text-xs font-bold text-[#3FB68B] uppercase tracking-wider">Phase 2: Plain-English Synthesis & Fix Snippet</span>
            <p className="text-xs text-text-muted leading-relaxed">
              The AI receives the deterministic findings, endpoint URL, HTTP status, and response snippet, synthesizing:
            </p>
            <ul className="text-xs text-text-muted list-disc list-inside space-y-1">
              <li>What happened in plain English</li>
              <li>Most likely root cause with a confidence rating (<code className="font-mono text-[#3FB68B]">high</code> / <code className="font-mono text-[#E0A93B]">medium</code> / <code className="font-mono text-text-muted">low</code>)</li>
              <li>Specific evidence lines from the request/response payloads</li>
              <li>Copy-pasteable code fix in the customer's preferred server runtime (Express, Fastify, Django, etc.)</li>
              <li>A direct &quot;Replay Webhook&quot; action to verify the fix immediately</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Redaction & Privacy Table */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-text">Redaction & Privacy Policy</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          Relay strictly isolates customer secrets and end-user PII before sending any prompt to external foundation models.
        </p>

        <div className="border border-border rounded-xl bg-surface overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-text-muted text-[11px] font-semibold">
                <th className="p-3">Data Field</th>
                <th className="p-3">Redaction Rule</th>
                <th className="p-3">Example Redacted Form</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-text-muted">
              <tr>
                <td className="p-3 font-medium text-text">API Secret Keys</td>
                <td className="p-3">Hashed / Masked to prefix + last 4</td>
                <td className="p-3 font-mono text-accent">rl_test_ab12••••••••••••••••34ef</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-text">Webhook Secrets</td>
                <td className="p-3">Masked to prefix only</td>
                <td className="p-3 font-mono text-[#E0A93B]">whsec_••••••••••••••••••••••••••</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-text">Authorization Headers</td>
                <td className="p-3">Replaced with placeholder</td>
                <td className="p-3 font-mono text-text">[REDACTED_BEARER_TOKEN]</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-text">Phone Numbers (PII)</td>
                <td className="p-3">Preserved country code, masked digits</td>
                <td className="p-3 font-mono text-text">+91 99•••• ••001</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-text">Customer Email Addresses</td>
                <td className="p-3">Masked local part</td>
                <td className="p-3 font-mono text-text">u••••r@domain.com</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Fallback Architecture */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-text">Resilience & Fallback Architecture</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          The Developer Hub is completely functional even when the AI subsystem is unavailable, rate-limited, or when running in self-hosted offline deployments.
        </p>

        <div className="p-4 rounded-xl border border-border bg-surface-2/30 space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-text">Reliability Controls</span>
          </div>
          <ul className="text-xs text-text-muted space-y-2 list-disc list-inside">
            <li>
              <span className="text-text font-semibold">15-Second Abort Controller:</span> Any AI request that exceeds 15 seconds is automatically aborted to preserve UI responsiveness.
            </li>
            <li>
              <span className="text-text font-semibold">Single Automatic Retry:</span> Network hiccups are retried once before triggering the offline fallback.
            </li>
            <li>
              <span className="text-text font-semibold">Audited Telemetry:</span> Every AI interaction is recorded in the <code className="font-mono text-text">ai_runs</code> database table with latency, token usage, model version, and satisfaction feedback.
            </li>
            <li>
              <span className="text-text font-semibold">Graceful Rule-Based Degradation:</span> If <code className="font-mono text-text">GEMINI_API_KEY</code> is unset or model errors occur, the UI displays a clear <span className="font-mono text-[#E0A93B]">AI Unavailable</span> banner and falls back to deterministic keyword matching and human engineer escalation.
            </li>
          </ul>
        </div>
      </section>

      {/* Navigation Footer */}
      <div className="p-5 rounded-xl border border-border bg-surface flex items-center justify-between">
        <Link
          href="/docs/errors"
          className="text-xs font-medium text-text-muted hover:text-text flex items-center gap-1.5"
        >
          ← Error Codes Catalogue
        </Link>
        <Link
          href="/support"
          className="text-xs font-bold text-accent hover:underline flex items-center gap-1.5"
        >
          <span>Try AI in Support</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}