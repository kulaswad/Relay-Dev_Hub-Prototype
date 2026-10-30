"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Play, Check, Copy, Terminal, ArrowRight, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { useDevHub, SupportedLanguage } from "@/components/providers/DevHubContext";

export function LandingHeroSnippet() {
  const { activeLanguage, setActiveLanguage } = useDevHub();
  const [isRunning, setIsRunning] = useState(false);
  const [runSuccess, setRunSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [responseOutput, setResponseOutput] = useState<any>({
    id: "msg_01jb9x7v2t4kzq8m",
    status: "queued",
    channel: "sms",
    to: "+919876543210",
    sender_id: "RELAYI",
    template_id: "dlt_tmpl_otp_login",
    cost: 0.12,
    currency: "INR",
    environment: "test",
    created_at: "2026-10-30T03:10:00.000Z",
  });
  const [responseHeaders, setResponseHeaders] = useState({
    status: 202,
    statusText: "Accepted",
    durationMs: 42,
    requestId: "req_01jb9x7v_hero",
    rateLimitRemaining: "59",
  });

  const languageTabs: { id: SupportedLanguage; label: string }[] = [
    { id: "curl", label: "cURL" },
    { id: "node", label: "Node.js" },
    { id: "python", label: "Python" },
    { id: "go", label: "Go" },
    { id: "php", label: "PHP" },
    { id: "java", label: "Java" },
  ];

  const codeSnippets: Record<SupportedLanguage, string> = {
    curl: `curl -X POST https://api.relay.internal/v1/messages \\
  -H "Authorization: Bearer rk_test_acmepay_9fa1b2e84c302948" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "sms",
    "to": "+919876543210",
    "sender_id": "RELAYI",
    "template_id": "dlt_tmpl_otp_login",
    "variables": { "1": "492019" }
  }'`,
    node: `import { RelayClient } from "@relay/sdk";

const relay = new RelayClient({
  apiKey: "rk_test_acmepay_9fa1b2e84c302948"
});

const message = await relay.messages.send({
  channel: "sms",
  to: "+919876543210",
  senderId: "RELAYI",
  templateId: "dlt_tmpl_otp_login",
  variables: { "1": "492019" }
});

console.log("Message queued:", message.id, message.status);`,
    python: `from relay import RelayClient

client = RelayClient(api_key="rk_test_acmepay_9fa1b2e84c302948")

message = client.messages.send(
    channel="sms",
    to="+919876543210",
    sender_id="RELAYI",
    template_id="dlt_tmpl_otp_login",
    variables={"1": "492019"}
)

print(f"Message ID: {message.id}, status: {message.status}")`,
    go: `package main

import (
  "context"
  "fmt"
  "github.com/relay/relay-go"
)

func main() {
  client := relay.NewClient("rk_test_acmepay_9fa1b2e84c302948")
  msg, _ := client.Messages.Send(context.Background(), &relay.SendMessageParams{
    Channel:    "sms",
    To:         "+919876543210",
    SenderID:   "RELAYI",
    TemplateID: "dlt_tmpl_otp_login",
    Variables:  map[string]string{"1": "492019"},
  })
  fmt.Printf("Queued: %s\\n", msg.ID)
}`,
    php: `<?php
require_once 'vendor/autoload.php';

$relay = new Relay\\Client('rk_test_acmepay_9fa1b2e84c302948');

$message = $relay->messages->send([
  'channel' => 'sms',
  'to' => '+919876543210',
  'sender_id' => 'RELAYI',
  'template_id' => 'dlt_tmpl_otp_login',
  'variables' => ['1' => '492019']
]);

echo "Queued: " . $message->id;`,
    java: `import com.relay.sdk.RelayClient;
import com.relay.sdk.model.Message;

public class App {
  public static void main(String[] args) {
    RelayClient relay = new RelayClient("rk_test_acmepay_9fa1b2e84c302948");
    Message msg = relay.messages().send()
      .channel("sms")
      .to("+919876543210")
      .senderId("RELAYI")
      .templateId("dlt_tmpl_otp_login")
      .variable("1", "492019")
      .execute();
    System.out.println("Queued: " + msg.getId());
  }
}`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippets[activeLanguage] || codeSnippets.curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    setIsRunning(true);
    setRunSuccess(false);

    try {
      const res = await fetch("/api/internal/landing-hero-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "sms",
          recipient: "+919876543210",
          sender_id: "RELAYI",
          template_id: "dlt_tmpl_otp_login",
          body: "Your Relay OTP is 492019. Valid for 10 minutes. Do not share.",
        }),
      });

      const result = await res.json();
      if (res.ok && result.data) {
        setResponseOutput(result.data);
        setResponseHeaders({
          status: result.statusCode || 202,
          statusText: "Accepted",
          durationMs: result.durationMs || 48,
          requestId: result.requestId || "req_01jb9x7v_hero",
          rateLimitRemaining: result.headers?.["relay-ratelimit-remaining"] || "59",
        });
        setRunSuccess(true);
      }
    } catch (err) {
      console.error("Hero sandbox run error:", err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-[#0C0C0F] overflow-hidden shadow-2xl">
      {/* Top Bar with Language Tabs and Actions */}
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-[#09090C] px-4 py-2 gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {languageTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveLanguage(tab.id)}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                activeLanguage === tab.id
                  ? "bg-surface-2 text-text font-semibold border border-border shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface-2/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-border text-xs text-text-muted hover:text-text transition-colors"
            title="Copy snippet"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#3FB68B]" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="font-mono text-[11px]">{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded font-mono text-xs font-semibold text-white transition-all shadow-sm ${
              runSuccess
                ? "bg-[#3FB68B] hover:bg-[#3FB68B]/90"
                : "bg-accent hover:bg-accent/90"
            }`}
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : runSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isRunning ? "Executing..." : runSuccess ? "Executed 202" : "Run in Sandbox"}</span>
          </button>
        </div>
      </div>

      {/* Code and Live Response Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* Left: Code Snippet */}
        <div className="p-4 font-mono text-xs leading-relaxed text-text overflow-x-auto bg-[#09090C]">
          <pre className="text-text-muted">
            <code>
              {codeSnippets[activeLanguage] || codeSnippets.curl}
            </code>
          </pre>
          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3FB68B] animate-pulse" />
              Connected to Real Sandbox
            </span>
            <span className="font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded border border-border">
              TRAI DLT Verified Header: RELAYI
            </span>
          </div>
        </div>

        {/* Right: Live Real JSON Response */}
        <div className="p-4 bg-[#0F0F12] flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between border-b border-border/80 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/30">
                  {responseHeaders.status} {responseHeaders.statusText}
                </span>
                <span className="text-xs font-mono text-text-muted">
                  {responseHeaders.durationMs}ms
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
                <span>rate-limit:</span>
                <span className="text-[#3FB68B] font-semibold">{responseHeaders.rateLimitRemaining}/60</span>
              </div>
            </div>

            <div className="space-y-1 font-mono text-xs">
              <div className="text-[10px] text-text-muted/60 uppercase tracking-wider mb-1">
                JSON Response Payload
              </div>
              <pre className="p-3 rounded-lg bg-[#09090C] border border-border text-[#ECECEF] overflow-x-auto text-xs leading-relaxed">
                {JSON.stringify(responseOutput, null, 2)}
              </pre>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-border/60 text-xs">
            <span className="font-mono text-[11px] text-text-muted truncate max-w-[200px]">
              {responseHeaders.requestId}
            </span>

            <Link
              href="/console/playground"
              className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-medium transition-colors"
            >
              <span>Explore full request in Playground</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
