"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useDevHub, SupportedLanguage } from "@/components/providers/DevHubContext";
import {
  CheckCircle2,
  Clock,
  Key,
  Copy,
  Check,
  Play,
  Terminal,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Webhook,
  Activity,
  Sparkles,
  Loader2,
  Lock,
  ChevronRight,
  Zap,
} from "lucide-react";

export default function ConsoleOverviewPage() {
  const { activeLanguage, setActiveLanguage, workspace, setWorkspace } = useDevHub();

  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [runningFirstCall, setRunningFirstCall] = useState(false);
  const [sendingTestWebhook, setSendingTestWebhook] = useState(false);
  const [webhookSuccessNotice, setWebhookSuccessNotice] = useState<string | null>(null);
  const [simulatingKyc, setSimulatingKyc] = useState(false);

  // Live stopwatch for time to first call
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);

  const languages: { id: SupportedLanguage; label: string }[] = [
    { id: "node", label: "Node.js" },
    { id: "python", label: "Python" },
    { id: "curl", label: "cURL" },
    { id: "php", label: "PHP" },
    { id: "java", label: "Java" },
    { id: "go", label: "Go" },
  ];

  // 1. Fetch checklist state
  const fetchChecklist = async () => {
    try {
      const res = await fetch("/api/internal/onboarding-checklist");
      const data = await res.json();
      if (res.ok) {
        setChecklist(data);

        // Update context workspace if needed
        if (data.workspace) {
          setWorkspace((prev) => ({
            ...prev,
            id: data.workspace.id,
            name: data.workspace.name,
            kycStatus: data.workspace.kycStatus === "approved" ? "active" : "kyc_pending",
            isLiveApproved: data.workspace.kycStatus === "approved",
            walletBalance: data.workspace.walletBalance,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load onboarding checklist:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();

    // Poll every 1.8 seconds to detect external terminal requests immediately
    const interval = setInterval(fetchChecklist, 1800);
    return () => clearInterval(interval);
  }, []);

  // Live ticking timer if first call not completed
  useEffect(() => {
    if (!checklist?.workspace?.createdAt || checklist?.timeToFirstCall?.completed) {
      return;
    }

    const startMs = new Date(checklist.workspace.createdAt).getTime();

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));
      setLiveElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [checklist?.workspace?.createdAt, checklist?.timeToFirstCall?.completed]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const rawTestKey = checklist?.steps?.step2_getTestKey?.key?.fullKey || "rk_test_acmepay_9fa1b2e84c302948";
  const maskedKey = checklist?.steps?.step2_getTestKey?.key?.masked || `rk_test_••••••••${rawTestKey.slice(-4)}`;

  // Generate code snippet according to user's selected language
  const getLanguageSnippet = (lang: SupportedLanguage) => {
    if (lang === "curl") {
      return `curl -X POST https://api.relay.internal/v1/messages \\
  -H "Authorization: Bearer ${rawTestKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "sms",
    "to": "+919999900001",
    "sender_id": "RELAYI",
    "template_id": "dlt_tmpl_otp_login",
    "variables": { "1": "492019" }
  }'`;
    }

    if (lang === "node") {
      return `import { RelayClient } from "@relay/sdk";

const relay = new RelayClient({ apiKey: "${rawTestKey}" });

const message = await relay.messages.send({
  channel: "sms",
  to: "+919999900001",
  senderId: "RELAYI",
  templateId: "dlt_tmpl_otp_login",
  variables: { "1": "492019" }
});
console.log("Queued message:", message.id);`;
    }

    if (lang === "python") {
      return `from relay import RelayClient

client = RelayClient(api_key="${rawTestKey}")

message = client.messages.send(
    channel="sms",
    to="+919999900001",
    sender_id="RELAYI",
    template_id="dlt_tmpl_otp_login",
    variables={"1": "492019"}
)
print("Queued message:", message.id)`;
    }

    if (lang === "php") {
      return `<?php
$relay = new Relay\\Client('${rawTestKey}');
$msg = $relay->messages->send([
  'channel' => 'sms',
  'to' => '+919999900001',
  'sender_id' => 'RELAYI',
  'template_id' => 'dlt_tmpl_otp_login',
  'variables' => ['1' => '492019']
]);
echo "Queued: " . $msg->id;`;
    }

    if (lang === "java") {
      return `RelayClient relay = new RelayClient("${rawTestKey}");
Message msg = relay.messages().send()
  .channel("sms")
  .to("+919999900001")
  .senderId("RELAYI")
  .templateId("dlt_tmpl_otp_login")
  .variable("1", "492019")
  .execute();
System.out.println("Queued: " + msg.getId());`;
    }

    return `// Run POST https://api.relay.internal/v1/messages with Bearer ${rawTestKey}`;
  };

  // Run the first call directly from the button
  const handleRunFirstCall = async () => {
    setRunningFirstCall(true);
    try {
      await fetch("/api/internal/landing-hero-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "sms",
          recipient: "+919999900001",
          sender_id: "RELAYI",
          template_id: "dlt_tmpl_otp_login",
          body: "Your Relay OTP is 492019. Valid for 10 minutes. Do not share.",
        }),
      });
      await fetchChecklist();
    } catch (err) {
      console.error(err);
    } finally {
      setRunningFirstCall(false);
    }
  };

  // Send test webhook
  const handleSendTestWebhook = async () => {
    setSendingTestWebhook(true);
    setWebhookSuccessNotice(null);
    try {
      const res = await fetch("/api/internal/onboarding-send-test-webhook", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setWebhookSuccessNotice(data.message || "Test webhook delivered!");
        await fetchChecklist();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingTestWebhook(false);
    }
  };

  // Simulate KYC approved toggle
  const handleToggleSimulateKyc = async () => {
    setSimulatingKyc(true);
    try {
      const isApproved = checklist?.workspace?.kycStatus === "approved";
      await fetch("/api/internal/simulate-kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: !isApproved }),
      });
      await fetchChecklist();
    } catch (err) {
      console.error(err);
    } finally {
      setSimulatingKyc(false);
    }
  };

  const isKycApproved = checklist?.workspace?.kycStatus === "approved";
  const firstFourDone = Boolean(checklist?.allFirstFourCompleted);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Top Language Chooser & Mode Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-[#0C0C0F]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-muted">I'm integrating with:</span>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {languages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setActiveLanguage(lang.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  activeLanguage === lang.id
                    ? "bg-accent text-white font-semibold shadow-sm"
                    : "bg-surface-2 border border-border text-text-muted hover:text-text"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-text-muted">Active Environment:</span>
          <span className="px-2 py-0.5 rounded font-bold bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/30">
            TEST SANDBOX
          </span>
        </div>
      </div>

      {/* 2. Persistent KYC Non-Blocking Notice for KYC Pending */}
      {!isKycApproved && (
        <div className="p-4 rounded-xl border border-[#E0A93B]/30 bg-[#E0A93B]/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#E0A93B] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-text">
                Test Mode is Fully Unlocked • Live Keys Unlock After KYC
              </span>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Everything in Test works without restriction. You do not need MCA or TRAI approvals to integrate, test rate limits, and debug webhooks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleToggleSimulateKyc}
              disabled={simulatingKyc}
              className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-[#E0A93B] hover:text-text transition-colors font-mono"
            >
              {simulatingKyc ? "Updating..." : "Simulate KYC Approved"}
            </button>
          </div>
        </div>
      )}

      {/* 3. Header Progress Tracker with "Time to First Call" Timer */}
      <div className="p-6 rounded-2xl border border-border bg-[#0C0C0F] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent fill-current" />
              <h1 className="text-lg sm:text-xl font-bold text-text">
                Get Started Checklist
              </h1>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Your fastest path from zero to a live working integration. All steps auto-detect completion from real database events.
            </p>
          </div>

          {/* Time to First Call Metric */}
          <div className="flex items-center gap-3">
            {checklist?.timeToFirstCall?.completed ? (
              <div className="p-2.5 px-4 rounded-xl bg-[#3FB68B]/10 border border-[#3FB68B]/30 flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#3FB68B]" />
                <div>
                  <div className="text-[10px] font-mono text-text-muted uppercase">
                    Time to First Call
                  </div>
                  <div className="text-sm font-bold font-mono text-[#3FB68B]">
                    {checklist.timeToFirstCall.formatted || "Completed"} 🎉
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 px-4 rounded-xl bg-accent/10 border border-accent/30 flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-accent animate-spin" />
                <div>
                  <div className="text-[10px] font-mono text-text-muted uppercase">
                    Time to First Call
                  </div>
                  <div className="text-sm font-bold font-mono text-accent">
                    {formatTimer(liveElapsedSeconds)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. The 6 Auto-Detecting Steps */}
        <div className="space-y-4 pt-1">
          {/* Step 1: Account Created */}
          <div className="p-4 rounded-xl border border-border bg-surface flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#3FB68B]/15 border border-[#3FB68B]/40 text-[#3FB68B] flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text">Step 1: Account & Workspace Initialized</span>
                  <span className="font-mono text-[10px] text-[#3FB68B] bg-[#3FB68B]/10 px-1.5 py-0.2 rounded">
                    Completed
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Workspace <code className="text-accent">{checklist?.workspace?.name || "AcmePay Sandbox"}</code> ready for sandbox traffic.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-text-muted hidden sm:inline">
              Step 1 of 6
            </span>
          </div>

          {/* Step 2: Get a Test Key */}
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#3FB68B]/15 border border-[#3FB68B]/40 text-[#3FB68B] flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text">Step 2: Auto-Created Test Key</span>
                  <span className="font-mono text-[10px] text-[#3FB68B] bg-[#3FB68B]/10 px-1.5 py-0.2 rounded">
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text bg-[#09090C] px-2 py-0.5 rounded border border-border">
                    {maskedKey}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(rawTestKey);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-accent hover:underline"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-[#3FB68B]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>

            <Link
              href="/console/keys"
              className="text-xs font-mono text-text-muted hover:text-text transition-colors flex items-center gap-1"
            >
              <span>Manage API Keys</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Step 3: Make Your First API Call */}
          <div
            className={`p-5 rounded-xl border transition-all ${
              checklist?.steps?.step3_firstCall?.completed
                ? "border-border bg-surface"
                : "border-accent/40 bg-[#0F0F16] shadow-sm"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                    checklist?.steps?.step3_firstCall?.completed
                      ? "bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/40"
                      : "bg-accent text-white"
                  }`}
                >
                  {checklist?.steps?.step3_firstCall?.completed ? "✓" : "3"}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-text">
                    Step 3: Make your first API call
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    {checklist?.steps?.step3_firstCall?.completed
                      ? `Successfully completed! ${checklist.steps.step3_firstCall.totalCalls} total calls recorded.`
                      : "Run this snippet from your terminal or click 'Run it' right here:"}
                  </p>
                </div>
              </div>

              {!checklist?.steps?.step3_firstCall?.completed && (
                <button
                  onClick={handleRunFirstCall}
                  disabled={runningFirstCall}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50 transition-all shadow-accent-glow"
                >
                  {runningFirstCall ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{runningFirstCall ? "Executing..." : "Run it"}</span>
                </button>
              )}
            </div>

            {/* Code Snippet Box */}
            <div className="rounded-lg bg-[#09090C] border border-border p-3.5 font-mono text-xs overflow-x-auto text-[#ECECEF]">
              <pre>
                <code>{getLanguageSnippet(activeLanguage)}</code>
              </pre>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3FB68B] animate-pulse" />
                Listening for incoming requests...
              </span>
              <Link
                href="/console/playground"
                className="text-accent hover:underline flex items-center gap-1 font-medium"
              >
                <span>Or open in Playground</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Step 4: See it in Your Logs */}
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                  checklist?.steps?.step4_seeInLogs?.completed
                    ? "bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/40"
                    : "bg-surface-2 border border-border text-text-muted"
                }`}
              >
                {checklist?.steps?.step4_seeInLogs?.completed ? "✓" : "4"}
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-text">Step 4: See it in your logs</span>
                <p className="text-[11px] text-text-muted">
                  Inspect the request headers, latency, status 202, and carrier simulator trace.
                </p>
              </div>
            </div>

            {checklist?.steps?.step4_seeInLogs?.requestId ? (
              <Link
                href={`/console/logs?requestId=${checklist.steps.step4_seeInLogs.requestId}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-border hover:border-accent text-xs font-mono text-accent hover:text-white transition-colors"
              >
                <span>Open Request in Log Drawer</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <span className="text-[11px] font-mono text-text-muted">
                Unlocks after Step 3 call
              </span>
            )}
          </div>

          {/* Step 5: Receive a Webhook */}
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                  checklist?.steps?.step5_receiveWebhook?.completed
                    ? "bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/40"
                    : "bg-surface-2 border border-border text-text-muted"
                }`}
              >
                {checklist?.steps?.step5_receiveWebhook?.completed ? "✓" : "5"}
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-text">Step 5: Receive a webhook</span>
                <p className="text-[11px] text-text-muted">
                  Verify how your backend captures `message.delivered` receipts with HMAC signatures.
                </p>
                {webhookSuccessNotice && (
                  <div className="text-[11px] text-[#3FB68B] font-mono">{webhookSuccessNotice}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSendTestWebhook}
                disabled={sendingTestWebhook}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/40 text-accent text-xs font-semibold hover:bg-accent hover:text-white transition-colors"
              >
                {sendingTestWebhook ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Webhook className="w-3.5 h-3.5" />
                )}
                <span>One-Click Test Webhook</span>
              </button>

              <Link
                href="/console/webhooks"
                className="p-1.5 text-text-muted hover:text-text transition-colors"
                title="Webhooks Console"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Step 6: Go Live (KYC Checklist) */}
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                  isKycApproved
                    ? "bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/40"
                    : "bg-surface-2 border border-border text-text-muted"
                }`}
              >
                {isKycApproved ? "✓" : "6"}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text">Step 6: Go Live (KYC Checklist)</span>
                  <span className="font-mono text-[10px] text-[#E0A93B] bg-[#E0A93B]/10 px-1.5 py-0.2 rounded">
                    {checklist?.steps?.step6_goLive?.optionalNotice || "Optional for now"}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Requires Certificate of Incorporation, GSTIN, and DLT Header validation.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/console/settings"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text hover:border-text-muted transition-colors font-mono"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#3FB68B]" />
                <span>KYC Settings</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 5. Celebration & Next Recommended Actions on Steps 1-4 Done */}
        {firstFourDone && (
          <div className="p-5 rounded-xl border border-[#3FB68B]/30 bg-gradient-to-r from-[#0F1E16] via-[#0E1712] to-[#0A0D0B] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-text">
                <Sparkles className="w-4 h-4 text-[#3FB68B]" />
                <span>
                  First API Call Completed in {checklist?.timeToFirstCall?.formatted || "under 15 minutes"}!
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#3FB68B] bg-[#3FB68B]/15 px-2 py-0.5 rounded border border-[#3FB68B]/30">
                Integration Milestone Unlocked
              </span>
            </div>

            <div className="text-xs text-text-muted leading-relaxed">
              Congratulations! Your backend has authenticated with Relay and processed its first transactional dispatch. Here are your recommended next steps:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <Link
                href="/console/keys"
                className="p-3 rounded-lg bg-surface border border-border hover:border-accent transition-colors space-y-1 group"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-text">
                  <span>1. Restrict Key Scopes</span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent" />
                </div>
                <p className="text-[11px] text-text-muted">
                  Limit your production credentials to only necessary scopes (e.g. messages:send).
                </p>
              </Link>

              <Link
                href="/console/webhooks"
                className="p-3 rounded-lg bg-surface border border-border hover:border-accent transition-colors space-y-1 group"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-text">
                  <span>2. Add Production Webhook</span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent" />
                </div>
                <p className="text-[11px] text-text-muted">
                  Register your staging or production webhook receiver to capture delivery receipts.
                </p>
              </Link>

              <Link
                href="/docs/compliance-guide"
                className="p-3 rounded-lg bg-surface border border-border hover:border-accent transition-colors space-y-1 group"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-text">
                  <span>3. Review Going-Live Guide</span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent" />
                </div>
                <p className="text-[11px] text-text-muted">
                  Prepare your MCA Certificate and DLT Entity ID for zero-downtime cutover.
                </p>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
