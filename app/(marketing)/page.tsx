"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  Layers,
  Terminal,
  Activity,
  Webhook,
  Code2,
  CheckCircle2,
  Key,
  Lock,
  MessageSquare,
  Server,
  Zap,
} from "lucide-react";
import { LandingHeroSnippet } from "@/components/devhub/LandingHeroSnippet";
import { SolutionsInquiryDialog } from "@/components/devhub/SolutionsInquiryDialog";

export default function HomePage() {
  const [inquiryOpen, setInquiryOpen] = useState(false);

  return (
    <div className="space-y-20 py-12 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* 1. Confident Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-[#0C0C0F] text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span className="text-text-muted">Target Time to First API Call:</span>
          <span className="text-accent font-semibold">&lt; 15 Minutes</span>
          <span className="text-border">|</span>
          <span className="text-[#3FB68B] font-semibold">Zero KYC Required in Sandbox</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-text leading-[1.12]">
          Ship your Relay integration{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C7CFF] via-[#9F9FFF] to-[#3FB68B]">
            in minutes.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
          Send SMS, RCS, and WhatsApp messages with pre-approved TRAI DLT headers. Ingest web and CRM events into real-time customer profiles (CDP). Test everything in a real sandbox before KYC.
        </p>
      </section>

      {/* 2. Live-Feeling Hero Code Snippet with Real Sandbox Execution */}
      <section className="space-y-2 max-w-5xl mx-auto">
        <div className="flex items-center justify-between text-xs text-text-muted px-1">
          <span className="font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3FB68B] animate-pulse" />
            Live Sandbox Endpoint: <code className="text-text">POST /api/v1/messages</code>
          </span>
          <span className="font-mono text-[11px] text-accent">
            Try clicking "Run in Sandbox" below
          </span>
        </div>

        <LandingHeroSnippet />
      </section>

      {/* 3. Two Clear Entry Cards (Evaluating vs Customer) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Card 1: Evaluating Relay */}
        <div className="p-7 rounded-2xl border border-accent/40 bg-gradient-to-b from-[#12121A] to-[#0A0A0E] space-y-5 hover:border-accent transition-all shadow-accent-glow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent font-mono text-[11px]">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Evaluating Relay</span>
            </div>
            <h2 className="text-2xl font-bold text-text">
              Try the API in 60 seconds, no signup
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              Launch our interactive Playground in eval mode with an instant temporary key. Follow a guided 3-step tour (send an SMS, ingest an event, read the profile), inspect test numbers, and review Indian data residency & DPDP Act compliance notes.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Link
              href="/playground"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all shadow-md group-hover:scale-[1.01]"
            >
              <span>Launch 60-Second Eval Playground</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              onClick={() => setInquiryOpen(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-surface-2 border border-border hover:border-text-muted text-xs font-medium text-text-muted hover:text-text transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Talk to a Solutions Engineer</span>
            </button>
          </div>

          <div className="flex items-center gap-3 pt-1 text-[11px] text-text-muted">
            <span className="flex items-center gap-1">✓ Instant 24h key</span>
            <span className="flex items-center gap-1">✓ No credit card</span>
            <span className="flex items-center gap-1">✓ Guided 3-step tour</span>
          </div>
        </div>

        {/* Card 2: I'm a Relay Customer */}
        <div className="p-7 rounded-2xl border border-border bg-[#0C0C0F] space-y-5 hover:border-border/90 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-2 border border-border text-text-muted font-mono text-[11px]">
              <Key className="w-3.5 h-3.5 text-[#3FB68B]" />
              <span>I'm a Relay Customer</span>
            </div>
            <h2 className="text-2xl font-bold text-text">
              Sign in & access your keys
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              Log into your developer workspace. Generate scoped API credentials, monitor sliding window rate limits, debug failed webhooks with replay, or track your MCA/TRAI KYC progress.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Link
              href="/sign-in"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-surface-2 border border-border hover:border-accent text-text text-xs font-semibold transition-all hover:bg-surface-2/80"
            >
              <span>Sign In to Developer Console</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/sign-up"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-transparent border border-border/80 hover:border-text-muted text-xs font-medium text-text-muted hover:text-text transition-colors"
            >
              <span>Create a New Customer Account</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 pt-1 text-[11px] text-text-muted">
            <span className="flex items-center gap-1">✓ Test vs Live environments</span>
            <span className="flex items-center gap-1">✓ Real webhook debugger</span>
          </div>
        </div>
      </section>

      {/* 4. Feature Grid (4 Core Pillars) */}
      <section className="space-y-6 max-w-5xl mx-auto pt-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-xl font-bold text-text tracking-tight">
            Designed for Developer Velocity
          </h2>
          <p className="text-xs text-text-muted">
            Everything in Relay Developer Hub is built for engineering teams who demand high-fidelity testing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Feature 1 */}
          <div className="p-5 rounded-xl border border-border bg-surface space-y-2.5 hover:border-border/80 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-[#3FB68B]/15 border border-[#3FB68B]/30 flex items-center justify-center text-[#3FB68B]">
              <Server className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-text">
              Sandbox Behaves Like Prod
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Deterministic test mobile numbers simulate carrier DND scrubbing, unreachable timeouts, and DLR receipts without sending live SMS.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-5 rounded-xl border border-border bg-surface space-y-2.5 hover:border-border/80 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-[#E0A93B]/15 border border-[#E0A93B]/30 flex items-center justify-center text-[#E0A93B]">
              <Webhook className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-text">
              Webhook Debugger & Replay
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Inspect exact request headers, raw body, HMAC-SHA256 signatures, and response status for every attempt with 1-click manual replay.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-5 rounded-xl border border-border bg-surface space-y-2.5 hover:border-border/80 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-[#7C7CFF]/15 border border-[#7C7CFF]/30 flex items-center justify-center text-[#7C7CFF]">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-text">
              Dated Versioning & Notices
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Every request pins a strict version header (e.g. <code className="text-accent">2025-10-01</code>) with automated migration notices and sunset countdowns.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-5 rounded-xl border border-border bg-surface space-y-2.5 hover:border-border/80 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-[#5B9DFF]/15 border border-[#5B9DFF]/30 flex items-center justify-center text-[#5B9DFF]">
              <Code2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-text">
              Official SDKs & Samples
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Install typed Node.js and Python packages, or run ready-to-deploy sample apps for OTP login, event tracking, and webhook receivers.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Live Gateway Status Indicator */}
      <section className="max-w-5xl mx-auto">
        <div className="p-4 rounded-xl border border-border bg-[#0C0C0F] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#3FB68B] animate-ping" />
            <div>
              <span className="font-semibold text-text">Relay Gateway Status:</span>{" "}
              <span className="text-[#3FB68B] font-bold">All Systems Operational</span>
              <div className="text-[11px] text-text-muted">
                Indian carrier links (Airtel, Jio, Vi SMPP): 99.98% uptime • P99 latency: 54ms
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <Link
              href="/status"
              className="text-accent hover:underline flex items-center gap-1 font-medium"
            >
              <span>View System Status & DLT Operator Health</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Solutions Inquiry Dialog */}
      <SolutionsInquiryDialog
        isOpen={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
      />
    </div>
  );
}
