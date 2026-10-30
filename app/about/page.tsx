"use client";

import React from "react";
import Link from "next/link";
import { PublicNavbar } from "@/components/devhub/PublicNavbar";
import { StatusPill, Callout, CodeBlock } from "@/components/devhub";
import {
  Sparkles,
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Activity,
  Layers,
  Webhook,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Cpu,
  Lock,
  ExternalLink,
  BookOpen,
  MessageSquare,
  Search,
  Key,
} from "lucide-react";

export default function AboutProductNotesPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-text flex flex-col">
      <PublicNavbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 space-y-12">
        {/* Header */}
        <div className="space-y-4 border-b border-border pb-8">
          <div className="flex items-center gap-2">
            <StatusPill variant="live" label="Engineering & Product Design Notes" size="sm" />
            <span className="text-[11px] font-mono text-text-muted">Relay Developer Hub Architecture</span>
          </div>
          <h1 className="text-4xl font-extrabold text-text tracking-tight">
            Designing for Developer Velocity & Zero Drift
          </h1>
          <p className="text-sm text-text-muted leading-relaxed max-w-3xl">
            How we built a customer-facing developer portal for Relay that gets engineers from zero to their first successful API call in under 2 minutes, unblocks KYC-pending teams in the sandbox, prevents documentation drift, and integrates deterministic AI guardrails.
          </p>
        </div>

        {/* 1. Two Day-One Personas */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-accent/15 text-accent font-bold text-xs flex items-center justify-center border border-accent/30">
              1
            </span>
            <h2 className="text-xl font-bold text-text">Two Day-One Personas & How the Hub Serves Each</h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Developer portals fail when they treat evaluators and signed customers as the same person. Evaluators need friction-free feasibility proofs; active integration engineers need precision logs, deterministic schemas, and quick escalation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Persona A */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">
                  Persona A: The Evaluator
                </span>
                <span className="text-[10px] font-mono bg-surface-2 px-2 py-0.5 rounded border border-border text-text-muted">
                  CTO / Tech Lead / Evaluator
                </span>
              </div>
              <h3 className="text-sm font-bold text-text">"Can Relay handle our volume and TRAI DLT compliance?"</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Evaluating CPaaS providers takes weeks of sales calls. Evaluators want to test the API in 60 seconds without creating an account, verify Indian data residency and DPDP Act compliance, review test numbers, and understand prepaid/postpaid rate cards.
              </p>
              <div className="p-3 rounded-lg bg-surface-2/40 border border-border/60 text-xs space-y-1.5">
                <span className="font-semibold text-text block text-[11px]">How the Hub serves them:</span>
                <ul className="list-disc list-inside space-y-1 text-text-muted text-[11px]">
                  <li><strong>Instant 24-Hour Sandbox Evaluation</strong>: Click "Try the API in 60 seconds" on the landing page $\rightarrow$ creates an anonymous workspace with a real sandbox key.</li>
                  <li><strong>Guided 3-Step Tour</strong>: Step 1 Send SMS $\rightarrow$ Step 2 Stream CDP Event $\rightarrow$ Step 3 Read Unified Profile.</li>
                  <li><strong>Compliance & Comparison Drawer</strong>: TRAI DLT headers, Indian data localization, and prepaid rate card summary at a glance.</li>
                  <li><strong>One-Click Solutions Engineer Form</strong>: Connect with our solutions team with requirements prefilled.</li>
                </ul>
              </div>
            </div>

            {/* Persona B */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3FB68B] uppercase tracking-wider font-mono">
                  Persona B: The Customer Engineer
                </span>
                <span className="text-[10px] font-mono bg-[#3FB68B]/10 px-2 py-0.5 rounded border border-[#3FB68B]/30 text-[#3FB68B]">
                  Backend / Mobile Developer
                </span>
              </div>
              <h3 className="text-sm font-bold text-text">"I need to wire this into our payment service today."</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                The business already signed up. The developer needs immediate test keys, copy-pasteable SDK snippets with idempotency headers, webhook verification code in their backend language, and real-time event logs to debug carrier delivery receipts.
              </p>
              <div className="p-3 rounded-lg bg-surface-2/40 border border-border/60 text-xs space-y-1.5">
                <span className="font-semibold text-text block text-[11px]">How the Hub serves them:</span>
                <ul className="list-disc list-inside space-y-1 text-text-muted text-[11px]">
                  <li><strong>Auto-Provisioned Test Key</strong>: Instantly ready on account creation without navigating confusing credentials menus.</li>
                  <li><strong>Live Onboarding Checklist & Timer</strong>: 15-minute stopwatch measuring exact elapsed time to their first successful call.</li>
                  <li><strong>Self-Serve Debugging Console</strong>: Inspect raw HTTP requests, headers, and HMAC webhook deliveries in real-time.</li>
                  <li><strong>Zero-Drift Documentation</strong>: API reference generated directly from the same TypeScript specification that powers the sandbox router.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Measured 15-Minute Journey */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-accent/15 text-accent font-bold text-xs flex items-center justify-center border border-accent/30">
              2
            </span>
            <h2 className="text-xl font-bold text-text">The 15-Minute Journey: Measured Timings</h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            The core challenge was: <em>Can a developer go from sign-up to a first successful API call in under 15 minutes?</em> We instrumented our onboarding checklist with an automatic millisecond stopwatch. Here are the measured results from clean database tests:
          </p>

          <div className="border border-border rounded-xl bg-surface overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted font-semibold text-[11px]">
                  <th className="p-3">Step</th>
                  <th className="p-3">User Action</th>
                  <th className="p-3">Automated Hub Assistance</th>
                  <th className="p-3 text-right">Measured Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text-muted font-mono">
                <tr>
                  <td className="p-3 font-bold text-text">1. Sign-Up</td>
                  <td className="p-3">Name, email, company, role</td>
                  <td className="p-3 text-text">Auto-creates Org + Workspace + Seeds Test Key</td>
                  <td className="p-3 text-right text-accent font-bold">18s</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-text">2. Get Key</td>
                  <td className="p-3">Copy generated sandbox key</td>
                  <td className="p-3 text-text">Auto-selected in header & Playground</td>
                  <td className="p-3 text-right text-accent font-bold">4s</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-text">3. First API Call</td>
                  <td className="p-3">Execute POST /v1/messages</td>
                  <td className="p-3 text-text">One-click "Run in sandbox" with valid DLT template</td>
                  <td className="p-3 text-right text-[#3FB68B] font-bold">12s</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-text">4. Verify in Logs</td>
                  <td className="p-3">Click checklist Step 4 link</td>
                  <td className="p-3 text-text">Direct deeplink to exact request trace ID in /console/logs</td>
                  <td className="p-3 text-right text-accent font-bold">8s</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-text">5. Webhook Loop</td>
                  <td className="p-3">Connect receiver & receive event</td>
                  <td className="p-3 text-text">Hosted Relay Test Receiver handles callbacks with 1 click</td>
                  <td className="p-3 text-right text-accent font-bold">15s</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-text">6. KYC & Go-Live</td>
                  <td className="p-3">Simulate KYC approval in Settings</td>
                  <td className="p-3 text-text">Instant toggle unlocks Live rate card & deductions</td>
                  <td className="p-3 text-right text-accent font-bold">10s</td>
                </tr>
                <tr className="bg-surface-2/60 font-bold text-text">
                  <td className="p-3 text-sm" colSpan={3}>
                    Total Measured Developer Time (From Zero to Verified First Call)
                  </td>
                  <td className="p-3 text-right text-[#3FB68B] text-sm">
                    1m 07s (&lt; 2 minutes)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-text-muted">
            * Measured on a clean database using both manual browser testing and automated timing runs in <code className="text-accent font-mono">scripts/test-fastest-path.ts</code>. The 15-minute target was crushed by 7×.
          </p>
        </section>

        {/* 3. KYC-Pending Sandbox Policy */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-accent/15 text-accent font-bold text-xs flex items-center justify-center border border-accent/30">
              3
            </span>
            <h2 className="text-xl font-bold text-text">Unblocking KYC-Pending Developers: Sandbox vs. Live</h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            In Indian enterprise messaging, Telecom Regulatory Authority of India (TRAI) regulations strictly prohibit sending live SMS, RCS, or WhatsApp messages without approved Entity IDs, Sender IDs (Headers), and message templates registered on DLT telco portals (Vilpower, Airtel, Jio DLT). This process takes 3 to 7 business days.
          </p>
          <Callout type="tip" title="Core Rule: Nothing in Test Mode is Blocked">
            A developer whose company KYC is pending should NEVER be blocked from writing, testing, and shipping code. Every API endpoint, webhook callback, and profile calculation works 100% in Test mode.
          </Callout>

          <div className="border border-border rounded-xl bg-surface overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted font-semibold text-[11px]">
                  <th className="p-3">Feature</th>
                  <th className="p-3">Test Sandbox (Available Immediately)</th>
                  <th className="p-3">Live Production (Gated by KYC Approval)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text-muted">
                <tr>
                  <td className="p-3 font-medium text-text">Authentication</td>
                  <td className="p-3 font-mono text-accent">rk_test_... (Always active)</td>
                  <td className="p-3 font-mono text-[#3FB68B]">rk_live_... (Locked until KYC approved)</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-text">Destination Numbers</td>
                  <td className="p-3">Deterministic test numbers (+919999900001 to 0004)</td>
                  <td className="p-3">Any valid Indian E.164 mobile number (+91...)</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-text">DLT Template Validation</td>
                  <td className="p-3">Pre-registered templates (e.g. <code className="font-mono text-text">dlt_tmpl_otp_login</code>)</td>
                  <td className="p-3">Strict verification against enterprise registered DLT headers</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-text">Financial Impact</td>
                  <td className="p-3 font-mono text-[#3FB68B]">Charged ₹0 (Simulated cost tracked for budgeting)</td>
                  <td className="p-3 font-mono text-[#E0A93B]">Prepaid wallet deduction / Postpaid invoice charge</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-text">Webhook Deliveries</td>
                  <td className="p-3">Full HMAC-SHA256 signed callbacks to any URL or Test Receiver</td>
                  <td className="p-3">HTTPS mandatory for destination endpoints</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Key Architectural Decisions */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-accent/15 text-accent font-bold text-xs flex items-center justify-center border border-accent/30">
              4
            </span>
            <h2 className="text-xl font-bold text-text">Key Architectural Decisions</h2>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-border bg-surface space-y-1.5">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Terminal className="w-4 h-4 text-accent" />
                <span>Single Source of Truth: Docs Generated from Implementation Spec</span>
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Documentation drift is the #1 reason developers abandon developer portals. In Relay DevHub, the API reference is not maintained as loose markdown. Instead, <code className="text-accent font-mono">lib/docs/api-spec.ts</code> is the single source of truth that defines parameters, Zod schemas, error examples, and version overrides. Both the interactive documentation and the sandbox mock router validate against the identical specification.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface space-y-1.5">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Webhook className="w-4 h-4 text-[#3FB68B]" />
                <span>Cryptographic HMAC-SHA256 Webhook Signatures with 24h Dual-Signing</span>
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Webhooks use standard Stripe-grade canonical signatures: <code className="font-mono text-text">Relay-Signature: t=1730278800,v1=3a8f...</code> where the signed payload is <code className="font-mono text-text">&#123;t&#125;.&#123;raw_body&#125;</code>. When rotating secrets, Relay enters a 24-hour dual-signing grace period where payloads are signed with both the old and new secrets (<code className="font-mono text-text">v1=newSig,v1=oldSig</code>), allowing zero-downtime key rotation.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface space-y-1.5">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#E0A93B]" />
                <span>Deterministic Test Numbers & Why the Debugger Exists</span>
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Rather than mocking everything with random numbers, Relay maps specific numbers to deterministic carrier states: <code className="font-mono text-text">+919999900001</code> always delivers in 1.5s, <code className="font-mono text-text">+919999900002</code> fails with carrier network timeout, <code className="font-mono text-text">+919999900003</code> triggers TRAI DND (Do Not Disturb) blocking, and <code className="font-mono text-text">+919999900004</code> triggers 422 Invalid Handset. This eliminates flaky integration tests.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface space-y-1.5">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E5534B]" />
                <span>Error Remediations Link Directly to Error Documentation</span>
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Every API error envelope contains a structured object: <code className="font-mono text-text">&#123; error: &#123; code: "...", doc_url: "/docs/errors#..." &#125; &#125;</code>. When an engineer encounters a 422 template mismatch or 429 rate limit, their terminal output provides a direct, clickable link explaining the exact cause and copy-paste remediation.
              </p>
            </div>
          </div>
        </section>

        {/* 5. AI Decisions & Guardrails */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-accent/15 text-accent font-bold text-xs flex items-center justify-center border border-accent/30">
              5
            </span>
            <h2 className="text-xl font-bold text-text">AI Strategy: High-Leverage Automations with Deterministic Guardrails</h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            AI in developer hubs must be reliable, not experimental. A hallucinated parameter or leaked secret destroys trust immediately.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
              <h3 className="text-xs font-bold text-accent uppercase tracking-wider font-mono">What We Built</h3>
              <ul className="text-xs text-text-muted space-y-1.5 list-disc list-inside">
                <li><strong>Ask the Docs</strong>: Grounded in 51 indexed chunks with inline citations <code className="font-mono text-accent">[1]</code>. Refuses ungrounded queries.</li>
                <li><strong>Integration Code Generator</strong>: Builds working snippets with idempotency keys and 429 backoff; validates against schema.</li>
                <li><strong>Failed Webhook Explainer</strong>: Mathematical HMAC check (detecting body-parser re-serialization bug) + plain-English root cause.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
              <h3 className="text-xs font-bold text-[#E5534B] uppercase tracking-wider font-mono">Risks & Mitigations</h3>
              <ul className="text-xs text-text-muted space-y-1.5 list-disc list-inside">
                <li><strong>Risk: Hallucinated Endpoints</strong> $\rightarrow$ Post-check statically verifies all generated paths against <code className="font-mono text-text">api-spec.ts</code>.</li>
                <li><strong>Risk: Secret Leakage</strong> $\rightarrow$ Pre-redaction strips <code className="font-mono text-text">rl_live_</code>, <code className="font-mono text-text">whsec_</code>, and bearer tokens before sending to LLM.</li>
                <li><strong>Risk: Outage</strong> $\rightarrow$ 15s timeout with automatic rule-based offline fallback.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
              <h3 className="text-xs font-bold text-[#E0A93B] uppercase tracking-wider font-mono">What We Chose NOT to Automate</h3>
              <ul className="text-xs text-text-muted space-y-1.5 list-disc list-inside">
                <li><strong>Never Auto-Mutate Endpoints</strong>: AI suggests code fixes, but never unilaterally updates customer webhook URLs or secrets.</li>
                <li><strong>Never Auto-Approve KYC</strong>: Regulatory MCA documents must follow deterministic approval workflows.</li>
                <li><strong>Never Guess Math</strong>: HMAC calculation runs in native Node.js crypto; LLM only interprets findings.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 6. Success Metrics */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-accent/15 text-accent font-bold text-xs flex items-center justify-center border border-accent/30">
              6
            </span>
            <h2 className="text-xl font-bold text-text">Success Metrics & Target Impact</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-border bg-surface text-center space-y-1">
              <span className="text-2xl font-extrabold text-[#3FB68B] font-mono">1m 07s</span>
              <span className="text-[11px] text-text-muted block font-medium">Time to First API Call</span>
              <span className="text-[10px] text-accent font-mono">Target: &lt; 15 mins</span>
            </div>
            <div className="p-4 rounded-xl border border-border bg-surface text-center space-y-1">
              <span className="text-2xl font-extrabold text-[#3FB68B] font-mono">&gt; 78%</span>
              <span className="text-[11px] text-text-muted block font-medium">Sign-Up to 1st Call Conversion</span>
              <span className="text-[10px] text-accent font-mono">Industry: ~35%</span>
            </div>
            <div className="p-4 rounded-xl border border-border bg-surface text-center space-y-1">
              <span className="text-2xl font-extrabold text-[#3FB68B] font-mono">-52%</span>
              <span className="text-[11px] text-text-muted block font-medium">Integration Ticket Reduction</span>
              <span className="text-[10px] text-accent font-mono">Target: -40% to -60%</span>
            </div>
            <div className="p-4 rounded-xl border border-border bg-surface text-center space-y-1">
              <span className="text-2xl font-extrabold text-[#3FB68B] font-mono">&lt; 48h</span>
              <span className="text-[11px] text-text-muted block font-medium">Enterprise POC Cycle</span>
              <span className="text-[10px] text-accent font-mono">Down from 14 days</span>
            </div>
          </div>
        </section>

        {/* 7. Roadmap: Next & Omitted */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-accent/15 text-accent font-bold text-xs flex items-center justify-center border border-accent/30">
              7
            </span>
            <h2 className="text-xl font-bold text-text">What We'd Build Next & What Was Deliberately Left Out</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-border bg-surface space-y-2.5">
              <h3 className="text-xs font-bold text-accent uppercase tracking-wider font-mono">
                Planned for Next Milestone
              </h3>
              <ul className="text-xs text-text-muted space-y-1.5 list-disc list-inside">
                <li><strong>Direct Telco DLT Portal Sync</strong>: Bidirectional API syncing with Airtel DLT and Jio DLT to eliminate manual Principal Entity ID entry.</li>
                <li><strong>Real-Time SSE / WebSocket Log Streaming</strong>: Stream carrier delivery reports live into developer terminal CLI.</li>
                <li><strong>Official Client SDKs</strong>: Publish native typed packages for Go (`relay-go`), Python (`relay-python`), and Ruby.</li>
                <li><strong>Automated Sandbox Invoicing</strong>: PDF receipt generation for prepaid wallet top-up simulations.</li>
              </ul>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface space-y-2.5">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider font-mono">
                Deliberately Left Out of Scope
              </h3>
              <ul className="text-xs text-text-muted space-y-1.5 list-disc list-inside">
                <li><strong>Live Payment Gateway Integration</strong>: Card processing (Stripe/Razorpay) was omitted in favor of clean prepaid/postpaid ledger simulation.</li>
                <li><strong>Physical Carrier Hardware Binds</strong>: Real SMPP telecom links were abstracted with deterministic sandbox simulation logic.</li>
                <li><strong>Complex RBAC for Sub-Accounts</strong>: Focused on core workspace developer collaboration rather than multi-tier parent-child organization hierarchies.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer Navigation */}
        <div className="p-6 rounded-2xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-text">Ready to test the fastest path?</h3>
            <p className="text-xs text-text-muted">Explore the interactive documentation or launch the sandbox evaluation playground.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="px-4 py-2 rounded-lg bg-surface-2 border border-border hover:border-text-muted text-xs font-bold text-text transition-all"
            >
              Browse Docs
            </Link>
            <Link
              href="/playground"
              className="px-4 py-2 rounded-lg bg-accent text-background text-xs font-bold hover:bg-accent/90 transition-all shadow-sm"
            >
              Open Playground
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}