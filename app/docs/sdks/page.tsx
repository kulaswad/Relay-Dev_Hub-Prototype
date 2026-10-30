"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CodeBlock,
  Callout,
  DocVersionBanner,
  DocFeedback,
  DocMeta,
  DocPaginationNav,
} from "@/components/devhub";
import {
  Code2,
  Terminal,
  Download,
  FolderGit2,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Zap,
  Play,
  FileCode,
} from "lucide-react";

export default function SdksDocPage() {
  const [activeLang, setActiveLang] = useState<"node" | "python" | "go" | "php" | "java">("node");

  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            Libraries & Tools
          </span>
          <span className="text-xs font-mono text-text-muted">Multi-Language Ecosystem</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Client SDKs & Sample Applications
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Relay provides official typed client libraries for Node.js (TypeScript) and Python, raw HTTP snippets for PHP, Java, and Go, plus complete runnable sample apps located directly in this repository.
        </p>

        <div className="flex items-center gap-2 pt-2">
          <a
            href="/api/openapi.json"
            target="_blank"
            download="relay-openapi.json"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-text-muted text-xs font-mono text-text transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span>OpenAPI 3.0 JSON</span>
          </a>
          <a
            href="/api/postman.json"
            target="_blank"
            download="relay-postman.json"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-text-muted text-xs font-mono text-text transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#3FB68B]" />
            <span>Postman Collection</span>
          </a>
        </div>
      </div>

      {/* Official Typed Clients in repo */}
      <div className="space-y-4">
        <h2 id="official-sdks" className="text-lg font-bold text-text">
          Official Typed Client Libraries
        </h2>

        {/* Node.js */}
        <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-text">Node.js & TypeScript</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-accent/15 text-accent border border-accent/30 font-bold">
                @relay/node v1.0.0
              </span>
            </div>
            <span className="text-[11px] font-mono text-text-muted">In Repo: /sdks/node</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Full TypeScript definitions, native fetch implementation, automated exponential backoff, and timing-safe webhook verification.
          </p>
          <CodeBlock
            code={`import { RelayClient } from "@relay/node";

const relay = new RelayClient({ apiKey: "rl_test_demo_acmepay_key_01" });

// Send message
const msg = await relay.messages.send({
  to: "+919999900001",
  channel: "sms",
  templateId: "dlt_tmpl_otp_login",
  variables: { "1": "481029" },
  senderId: "RELAYI",
});
console.log("Message Queued ID:", msg.id);`}
            language="ts"
          />
        </div>

        {/* Python */}
        <div className="p-5 rounded-xl border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-text">Python (3.8+)</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/30 font-bold">
                relay-python v1.0.0
              </span>
            </div>
            <span className="text-[11px] font-mono text-text-muted">In Repo: /sdks/python</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Requests-based client with type hints, automated E.164 sanitization, and cryptographic replay tolerance verification.
          </p>
          <CodeBlock
            code={`from relay import RelayClient

relay = RelayClient(api_key="rl_test_demo_acmepay_key_01")

msg = relay.send_message(
    to="+919999900001",
    channel="sms",
    template_id="dlt_tmpl_otp_login",
    variables={"1": "481029"},
    sender_id="RELAYI"
)
print("Message ID:", msg["id"])`}
            language="python"
          />
        </div>
      </div>

      {/* Language Snippet Switcher for PHP, Java, Go */}
      <div className="space-y-4">
        <h2 id="copy-paste-snippets" className="text-lg font-bold text-text">
          Copy-Paste Snippets (Go, PHP, Java)
        </h2>

        <div className="flex items-center gap-2 border-b border-border pb-2">
          {(["go", "php", "java"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors uppercase ${
                activeLang === lang
                  ? "bg-surface-2 text-text border border-border font-bold shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        {activeLang === "go" && (
          <CodeBlock
            code={`package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

func main() {
	payload := []byte(\`{
		"to": "+919999900001",
		"channel": "sms",
		"template_id": "dlt_tmpl_otp_login",
		"variables": {"1": "481029"},
		"sender_id": "RELAYI"
	}\`)

	req, _ := http.NewRequest("POST", "https://api.relay.in/v1/messages", bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil { panic(err) }
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`}
            language="go"
          />
        )}

        {activeLang === "php" && (
          <CodeBlock
            code={`<?php
// PHP cURL
$ch = curl_init("https://api.relay.in/v1/messages");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer rl_test_demo_acmepay_key_01",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "to" => "+919999900001",
    "channel" => "sms",
    "template_id" => "dlt_tmpl_otp_login",
    "variables" => ["1" => "481029"],
    "sender_id" => "RELAYI"
]));
$response = curl_exec($ch);
curl_close($ch);
echo $response;`}
            language="php"
          />
        )}

        {activeLang === "java" && (
          <CodeBlock
            code={`// Java 11+ HttpClient
import java.net.URI;
import java.net.http.*;

public class RelaySender {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.relay.in/v1/messages"))
            .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("""
                {
                  "to": "+919999900001",
                  "channel": "sms",
                  "template_id": "dlt_tmpl_otp_login",
                  "variables": {"1": "481029"},
                  "sender_id": "RELAYI"
                }
                """))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}`}
            language="java"
          />
        )}
      </div>

      {/* Runnable Sample Apps */}
      <div className="space-y-4">
        <h2 id="sample-apps" className="text-lg font-bold text-text">
          Runnable Sample Applications (/samples)
        </h2>
        <p className="text-xs text-text-muted">
          Clone the repository and run these end-to-end sample programs immediately against the local sandbox:
        </p>

        <div className="grid grid-cols-1 gap-3">
          {/* Sample 1 */}
          <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-accent">1. OTP Sender in Node</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-text-muted border border-border">
                  Node / TS
                </span>
              </div>
              <code className="text-[11px] font-mono text-text-muted">/samples/otp-sender-node</code>
            </div>
            <p className="text-xs text-text-muted">
              Generates a random 6-digit OTP, dispatches to the sandbox, and polls delivery status receipts.
            </p>
            <div className="bg-[#09090B] p-2.5 rounded-lg border border-border font-mono text-xs text-text flex items-center justify-between">
              <span>npx tsx samples/otp-sender-node/index.ts</span>
              <span className="text-[10px] text-[#3FB68B]">Verified ✓</span>
            </div>
          </div>

          {/* Sample 2 */}
          <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#3FB68B]">2. Event Tracker in Python</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-text-muted border border-border">
                  Python 3
                </span>
              </div>
              <code className="text-[11px] font-mono text-text-muted">/samples/event-tracker-python</code>
            </div>
            <p className="text-xs text-text-muted">
              Streams checkout events into Relay CDP and queries the unified profile's calculated traits.
            </p>
            <div className="bg-[#09090B] p-2.5 rounded-lg border border-border font-mono text-xs text-text flex items-center justify-between">
              <span>python samples/event-tracker-python/tracker.py</span>
              <span className="text-[10px] text-[#3FB68B]">Verified ✓</span>
            </div>
          </div>

          {/* Sample 3 */}
          <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#5B9DFF]">3. Webhook Receiver in Express</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-2 text-text-muted border border-border">
                  Express / TS
                </span>
              </div>
              <code className="text-[11px] font-mono text-text-muted">/samples/webhook-receiver-express</code>
            </div>
            <p className="text-xs text-text-muted">
              Captures untouched raw body bytes, verifies HMAC-SHA256 signatures, and blocks 5-minute replay drift.
            </p>
            <div className="bg-[#09090B] p-2.5 rounded-lg border border-border font-mono text-xs text-text flex items-center justify-between">
              <span>npx tsx samples/webhook-receiver-express/server.ts</span>
              <span className="text-[10px] text-[#3FB68B]">Verified ✓</span>
            </div>
          </div>
        </div>
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Error Codes Catalogue", href: "/docs/errors" }}
        next={{ title: "Changelog & Sunsets", href: "/changelog" }}
      />
    </div>
  );
}
