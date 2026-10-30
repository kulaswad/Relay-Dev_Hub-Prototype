"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useDevHub } from "@/components/providers/DevHubContext";
import {
  StatusPill,
  CopyField,
  Callout,
  JsonViewer,
  WebhookAiExplanation,
} from "@/components/devhub";
import {
  Webhook,
  Plus,
  RotateCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Bug,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Send,
  Zap,
  Clock,
  Key,
  Trash2,
  Power,
  RefreshCw,
  HelpCircle,
  Copy,
  Check,
  Code2,
  FileCode,
  Terminal,
} from "lucide-react";

interface WebhookEndpoint {
  id: string;
  workspaceId: string;
  url: string;
  environment: "test" | "live";
  events: string[];
  signingSecret: string;
  previousSigningSecret?: string | null;
  secretRotationEndsAt?: string | null;
  status: "active" | "failing" | "disabled";
  apiVersion: string;
  createdAt: string;
  consecutiveFailures: number;
  successRate24h: number;
  totalDeliveries24h: number;
  lastDeliveryAt: string | null;
}

interface ReceiverConfig {
  url: string;
  behavior: "200" | "500" | "401" | "timeout" | "verify_signature";
  accelerationFactor: number;
}

const AVAILABLE_EVENTS = [
  {
    category: "Messages & Carrier",
    events: [
      { id: "message.queued", name: "message.queued", desc: "Outbound message placed in carrier dispatch queue" },
      { id: "message.sent", name: "message.sent", desc: "Carrier telecom network accepted the message" },
      { id: "message.delivered", name: "message.delivered", desc: "Handset DLR receipt confirmed" },
      { id: "message.failed", name: "message.failed", desc: "Delivery failed, DND active, or carrier rejection" },
      { id: "message.read", name: "message.read", desc: "WhatsApp / RCS message read receipt" },
    ],
  },
  {
    category: "Customer Profile (CDP)",
    events: [
      { id: "customer.profile.updated", name: "customer.profile.updated", desc: "Traits, identifiers, or segments updated" },
      { id: "customer.consent.changed", name: "customer.consent.changed", desc: "Channel opt-in / opt-out preferences modified" },
    ],
  },
  {
    category: "Compliance & Workspace",
    events: [
      { id: "workspace.kyc.updated", name: "workspace.kyc.updated", desc: "KYC verification or sender ID approval state changed" },
    ],
  },
];

const CODE_SNIPPETS = {
  nodejs: `// Node.js (Express) - Verifying Relay-Signature
import crypto from "crypto";

// IMPORTANT: Express must preserve the untouched raw request body!
// app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

export function verifyRelayWebhook(rawBody, signatureHeader, secret) {
  // 1. Extract timestamp and signature hashes
  const tMatch = signatureHeader.match(/t=(\\d+)/);
  if (!tMatch) throw new Error("Missing timestamp in header");
  const timestamp = tMatch[1];

  // 2. Prevent replay attacks (allow 5-minute clock drift)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    throw new Error("Webhook timestamp drift exceeds 300 seconds");
  }

  // 3. Compute canonical HMAC-SHA256: "{timestamp}.{raw_body}"
  const signedPayload = \`\${timestamp}.\${rawBody.toString("utf8")}\`;
  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // 4. Extract all v1 signatures (supports dual-signing rotation)
  const receivedSignatures = Array.from(signatureHeader.matchAll(/v1=([a-f0-9]{64})/g)).map(m => m[1]);

  const isValid = receivedSignatures.some(sig =>
    crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(computedHash, "hex"))
  );

  if (!isValid) throw new Error("Invalid Relay webhook signature");
  return true;
}`,
  python: `# Python (FastAPI / Flask) - Verifying Relay-Signature
import hmac
import hashlib
import time
import re

def verify_relay_webhook(raw_body_bytes: bytes, signature_header: str, secret: str) -> bool:
    # 1. Extract timestamp
    t_match = re.search(r't=(\\d+)', signature_header)
    if not t_match:
        raise ValueError("Missing timestamp in header")
    timestamp = t_match.group(1)

    # 2. Check 5-minute replay tolerance
    if abs(time.time() - int(timestamp)) > 300:
        raise ValueError("Timestamp drift exceeds 300 seconds")

    # 3. Calculate HMAC over "{timestamp}.{raw_body}"
    signed_payload = f"{timestamp}.".encode("utf-8") + raw_body_bytes
    computed_sig = hmac.new(
        secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256
    ).hexdigest()

    # 4. Compare against received v1 signatures (supports rotation)
    received_signatures = re.findall(r'v1=([a-f0-9]{64})', signature_header)
    
    for sig in received_signatures:
        if hmac.compare_digest(sig, computed_sig):
            return True
            
    raise ValueError("Invalid Relay webhook signature")`,
  go: `// Go (net/http) - Verifying Relay-Signature
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"time"
)

func VerifyRelayWebhook(rawBody []byte, signatureHeader string, secret string) error {
	reT := regexp.MustCompile(\`t=(\\d+)\`)
	tMatch := reT.FindStringSubmatch(signatureHeader)
	if len(tMatch) < 2 {
		return errors.New("missing timestamp in header")
	}
	ts, _ := strconv.ParseInt(tMatch[1], 10, 64)

	if math.Abs(float64(time.Now().Unix()-ts)) > 300 {
		return errors.New("timestamp drift exceeds 300s")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.", ts)))
	mac.Write(rawBody)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	reV1 := regexp.MustCompile(\`v1=([a-f0-9]{64})\`)
	v1Matches := reV1.FindAllStringSubmatch(signatureHeader, -1)
	for _, m := range v1Matches {
		if hmac.Equal([]byte(m[1]), []byte(expectedSig)) {
			return nil
		}
	}
	return errors.New("invalid signature")
}`,
  php: `<?php
// PHP - Verifying Relay-Signature
function verifyRelayWebhook($rawBody, $signatureHeader, $secret) {
    if (!preg_match('/t=(\\d+)/', $signatureHeader, $tMatches)) {
        throw new Exception("Missing timestamp");
    }
    $timestamp = $tMatches[1];

    if (abs(time() - (int)$timestamp) > 300) {
        throw new Exception("Timestamp drift exceeds 300s");
    }

    $signedPayload = $timestamp . '.' . $rawBody;
    $computedSig = hash_hmac('sha256', $signedPayload, $secret);

    preg_match_all('/v1=([a-f0-9]{64})/', $signatureHeader, $v1Matches);
    foreach ($v1Matches[1] as $sig) {
        if (hash_equals($sig, $computedSig)) {
            return true;
        }
    }
    throw new Exception("Invalid signature");
}`,
  java: `// Java (Spring Boot) - Verifying Relay-Signature
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.*;

public class RelayWebhookVerifier {
    public static boolean verify(byte[] rawBody, String signatureHeader, String secret) throws Exception {
        Matcher tMatcher = Pattern.compile("t=(\\\\d+)").matcher(signatureHeader);
        if (!tMatcher.find()) throw new IllegalArgumentException("Missing timestamp");
        long timestamp = Long.parseLong(tMatcher.group(1));

        long now = System.currentTimeMillis() / 1000L;
        if (Math.abs(now - timestamp) > 300) throw new SecurityException("Timestamp drift > 300s");

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
        byte[] computed = mac.doFinal(rawBody);

        StringBuilder hexString = new StringBuilder();
        for (byte b : computed) hexString.append(String.format("%02x", b));
        String expectedHash = hexString.toString();

        Matcher v1Matcher = Pattern.compile("v1=([a-f0-9]{64})").matcher(signatureHeader);
        while (v1Matcher.find()) {
            if (MessageDigest.isEqual(v1Matcher.group(1).getBytes(), expectedHash.getBytes())) {
                return true;
            }
        }
        throw new SecurityException("Invalid signature");
    }
}`,
};

export default function WebhooksConsolePage() {
  const { environment, workspace } = useDevHub();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [receiverConfig, setReceiverConfig] = useState<ReceiverConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isRotateModalOpen, setIsRotateModalOpen] = useState(false);
  const [isSecretRevealOpen, setIsSecretRevealOpen] = useState(false);
  const [isSignatureCheckerOpen, setIsSignatureCheckerOpen] = useState(false);
  const [activeEndpointForAction, setActiveEndpointForAction] = useState<WebhookEndpoint | null>(null);

  // Newly created endpoint secret
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string; url: string } | null>(null);

  // Form states
  const [newUrl, setNewUrl] = useState("");
  const [newEnvironment, setNewEnvironment] = useState<"test" | "live">(environment || "test");
  const [newApiVersion, setNewApiVersion] = useState("v2025-10-01");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "message.delivered",
    "message.failed",
    "customer.profile.updated",
  ]);

  // Test Event state
  const [testEventType, setTestEventType] = useState("message.delivered");
  const [testResult, setTestResult] = useState<any>(null);
  const [testSending, setTestSending] = useState(false);

  // Signature Checker state
  const [checkerPayload, setCheckerPayload] = useState("");
  const [checkerHeader, setCheckerHeader] = useState("");
  const [checkerSecret, setCheckerSecret] = useState("");
  const [checkerResult, setCheckerResult] = useState<any>(null);
  const [checkerLoading, setCheckerLoading] = useState(false);
  const [selectedSnippetLang, setSelectedSnippetLang] = useState<keyof typeof CODE_SNIPPETS>("nodejs");

  const loadData = async () => {
    try {
      const res = await fetch(`/api/internal/webhooks?environment=${environment}`);
      const data = await res.json();
      if (data.endpoints) setEndpoints(data.endpoints);
      if (data.receiverConfig) setReceiverConfig(data.receiverConfig);
    } catch (err) {
      console.error("Failed to load webhooks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [environment]);

  // Handle Receiver Config updates
  const updateReceiverBehavior = async (behavior: ReceiverConfig["behavior"]) => {
    if (!receiverConfig) return;
    try {
      const res = await fetch("/api/internal/webhooks/receiver-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ behavior }),
      });
      const data = await res.json();
      if (data.success) {
        setReceiverConfig((prev) => (prev ? { ...prev, behavior } : null));
      }
    } catch (err) {
      console.error("Failed to update receiver behavior:", err);
    }
  };

  const toggleTimeAcceleration = async () => {
    if (!receiverConfig) return;
    const newFactor = receiverConfig.accelerationFactor > 1 ? 1 : 12;
    try {
      const res = await fetch("/api/internal/webhooks/receiver-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accelerationFactor: newFactor }),
      });
      const data = await res.json();
      if (data.success) {
        setReceiverConfig((prev) => (prev ? { ...prev, accelerationFactor: newFactor } : null));
      }
    } catch (err) {
      console.error("Failed to toggle time acceleration:", err);
    }
  };

  // Add Endpoint
  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/internal/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl,
          environment: newEnvironment,
          events: selectedEvents,
          apiVersion: newApiVersion,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create endpoint");
      } else {
        setIsAddModalOpen(false);
        setRevealedSecret({
          id: data.endpoint.id,
          secret: data.signingSecret,
          url: data.endpoint.url,
        });
        setIsSecretRevealOpen(true);
        setNewUrl("");
        await loadData();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Endpoint Active/Disabled
  const handleToggleEndpoint = async (endpoint: WebhookEndpoint) => {
    const newStatus = endpoint.status === "disabled" ? "active" : "disabled";
    try {
      const res = await fetch(`/api/internal/webhooks/${endpoint.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          consecutiveFailures: 0,
        }),
      });
      if (res.ok) await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Re-enable Failing Endpoint
  const handleReenableEndpoint = async (id: string) => {
    try {
      const res = await fetch(`/api/internal/webhooks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "active",
          consecutiveFailures: 0,
        }),
      });
      if (res.ok) await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Endpoint
  const handleDeleteEndpoint = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook endpoint? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/internal/webhooks/${id}`, {
        method: "DELETE",
      });
      if (res.ok) await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Rotate Secret
  const handleRotateSecret = async () => {
    if (!activeEndpointForAction) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/internal/webhooks/${activeEndpointForAction.id}/rotate-secret`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to rotate secret");
      } else {
        setIsRotateModalOpen(false);
        setRevealedSecret({
          id: activeEndpointForAction.id,
          secret: data.newSigningSecret,
          url: activeEndpointForAction.url,
        });
        setIsSecretRevealOpen(true);
        await loadData();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Send Test Event
  const handleSendTestEvent = async () => {
    if (!activeEndpointForAction) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/internal/webhooks/test-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId: activeEndpointForAction.id,
          eventType: testEventType,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      await loadData();
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestSending(false);
    }
  };

  // Check Signature
  const handleCheckSignature = async () => {
    setCheckerLoading(true);
    try {
      const res = await fetch("/api/internal/logs/verify-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: checkerPayload,
          signatureHeader: checkerHeader,
          secret: checkerSecret,
        }),
      });
      const data = await res.json();
      setCheckerResult(data);
    } catch (err: any) {
      setCheckerResult({ isValid: false, message: err.message });
    } finally {
      setCheckerLoading(false);
    }
  };

  // Pre-load Scenario #2 into Signature Checker
  const loadScenario2SignatureMismatch = () => {
    const rawPayload = JSON.stringify({
      id: "evt_samp_401_mismatch",
      type: "message.delivered",
      api_version: "2025-10-01",
      created_at: Math.floor(Date.now() / 1000) - 15,
      data: {
        object: {
          id: "msg_9921_sms_del",
          status: "delivered",
          recipient: "+919999900001",
          carrier: "Bharti Airtel",
        },
      },
    });

    // Valid header for raw bytes
    const ts = Math.floor(Date.now() / 1000) - 15;
    const testSecret = "whsec_test_demo_signature_key_99";
    // We compute what the raw payload signature is:
    // We'll let the user test it with indented JSON
    const indentedJson = JSON.stringify(JSON.parse(rawPayload), null, 2);

    // Let's call the API to generate or set pre-filled values
    setCheckerPayload(indentedJson); // Customer verified against indented JSON!
    setCheckerSecret(testSecret);
    setCheckerHeader(`t=${ts},v1=41496b8c8d8b1e42718c3d9a11ef932847c1f88049ad833075216e4db5499231`);
    setCheckerResult(null);
  };

  // Identify any failing endpoint
  const failingEndpoint = endpoints.find((ep) => ep.status === "failing");

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-text">Webhook Endpoints</h1>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                environment === "test"
                  ? "bg-[#E0A93B]/10 border-[#E0A93B]/30 text-[#E0A93B]"
                  : "bg-[#3FB68B]/10 border-[#3FB68B]/30 text-[#3FB68B]"
              }`}
            >
              {environment === "test" ? "Sandbox Mode" : "Live Carrier Mode"}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1 max-w-2xl">
            Real-time event streams with guaranteed delivery, cryptographic HMAC verification, exponential backoff, and full payload inspection.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsSignatureCheckerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-text-muted text-xs font-semibold text-text transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>Verify Signatures</span>
          </button>

          <button
            onClick={() => {
              setNewEnvironment(environment || "test");
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Endpoint</span>
          </button>
        </div>
      </div>

      {/* Failing Endpoint Circuit Breaker Alert Banner */}
      {failingEndpoint && (
        <div className="p-4 rounded-xl border border-[#E5534B]/40 bg-[#E5534B]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E5534B]/20 border border-[#E5534B]/40 flex items-center justify-center text-[#E5534B] shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-text">Circuit Breaker Tripped: Endpoint Failing</span>
              <p className="text-text-muted text-[11px] mt-0.5">
                Endpoint <code className="font-mono text-[#E5534B]">{failingEndpoint.url}</code> has failed 5 consecutive events. Automatic delivery retries are paused to protect your server.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleReenableEndpoint(failingEndpoint.id)}
            className="px-3 py-1.5 rounded bg-[#E5534B] hover:bg-[#E5534B]/90 text-white font-medium text-xs transition-colors shrink-0 flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Re-enable Endpoint</span>
          </button>
        </div>
      )}

      {/* Hosted Test Receiver & Speed Accelerator Card */}
      {receiverConfig && (
        <div className="p-5 rounded-xl border border-accent/20 bg-surface/80 space-y-4 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3FB68B] animate-pulse" />
                <h3 className="text-sm font-semibold text-text">Hosted Relay Test Receiver</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent/15 text-accent border border-accent/30">
                  Ready to test
                </span>
              </div>
              <p className="text-xs text-text-muted">
                Each workspace includes a built-in sandbox endpoint so you can verify webhooks without configuring external tunnels like ngrok.
              </p>
            </div>

            {/* Time acceleration toggle */}
            <div className="flex items-center gap-2 bg-surface-2 p-1.5 rounded-lg border border-border">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs text-text-muted font-mono">Time Acceleration:</span>
              <button
                onClick={toggleTimeAcceleration}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  receiverConfig.accelerationFactor > 1
                    ? "bg-[#E0A93B] text-black font-bold"
                    : "bg-surface hover:bg-surface-2 text-text-muted"
                }`}
              >
                {receiverConfig.accelerationFactor > 1 ? "⚡ 1 min = 5 sec (12x)" : "Normal (1x)"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Hosted URL display */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                Your Workspace Receiver URL
              </label>
              <div className="flex items-center gap-2 bg-[#09090B] p-2 rounded-lg border border-border">
                <code className="text-xs font-mono text-accent truncate flex-1 select-all">
                  {receiverConfig.url}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(receiverConfig.url);
                  }}
                  className="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
                  title="Copy URL"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Configurable Behavior Switcher */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                Receiver Simulation Response Behavior
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {[
                  { id: "200", label: "200 OK", desc: "Success" },
                  { id: "500", label: "500 Crash", desc: "Express stack trace" },
                  { id: "401", label: "401 Bad Sig", desc: "Signature rejected" },
                  { id: "timeout", label: "Timeout (15s)", desc: "Exceeds 10s" },
                  { id: "verify_signature", label: "Verify Sig", desc: "Timing-safe HMAC" },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => updateReceiverBehavior(b.id as any)}
                    className={`px-2 py-1.5 rounded text-[11px] font-mono text-center border transition-all ${
                      receiverConfig.behavior === b.id
                        ? "bg-accent/20 border-accent text-accent font-bold shadow-sm"
                        : "bg-surface-2 hover:bg-surface border-border text-text-muted"
                    }`}
                    title={b.desc}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Endpoints List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-text-muted">
            Configured Endpoints ({endpoints.length})
          </h2>
          <button
            onClick={loadData}
            className="text-xs font-mono text-text-muted hover:text-text flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted font-mono bg-surface rounded-xl border border-border">
            Loading webhook endpoints...
          </div>
        ) : endpoints.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-border bg-surface space-y-3">
            <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center mx-auto text-text-muted">
              <Webhook className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-text">No webhook endpoints configured</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Register an HTTP POST URL or connect the hosted Relay Test Receiver to start receiving real-time event deliveries.
            </p>
            <button
              onClick={() => {
                setNewUrl(receiverConfig?.url || "");
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Test Receiver</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {endpoints.map((ep) => {
              const isRotating = ep.secretRotationEndsAt && new Date(ep.secretRotationEndsAt) > new Date();
              return (
                <div
                  key={ep.id}
                  className="p-5 rounded-xl border border-border bg-surface hover:border-border/80 transition-all space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 ${
                          ep.status === "failing"
                            ? "bg-[#E5534B]/10 border-[#E5534B]/30 text-[#E5534B]"
                            : ep.status === "disabled"
                            ? "bg-surface-2 border-border text-text-muted"
                            : "bg-[#3FB68B]/10 border-[#3FB68B]/30 text-[#3FB68B]"
                        }`}
                      >
                        <Webhook className="w-4 h-4" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-text">
                            {ep.url}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                              ep.environment === "test"
                                ? "bg-[#E0A93B]/10 border-[#E0A93B]/30 text-[#E0A93B]"
                                : "bg-[#3FB68B]/10 border-[#3FB68B]/30 text-[#3FB68B]"
                            }`}
                          >
                            {ep.environment.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-mono text-text-muted">
                            {ep.apiVersion}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {ep.events.map((evt) => (
                            <span
                              key={evt}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-2 text-text-muted border border-border"
                            >
                              {evt}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Stats & Status */}
                    <div className="flex flex-wrap items-center gap-4 lg:self-center">
                      <div className="text-right">
                        <div className="text-[11px] font-mono text-text-muted">24h Success Rate</div>
                        <div className="text-xs font-mono font-bold text-text flex items-center gap-1 justify-end">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              ep.successRate24h >= 90
                                ? "bg-[#3FB68B]"
                                : ep.successRate24h >= 50
                                ? "bg-[#E0A93B]"
                                : "bg-[#E5534B]"
                            }`}
                          />
                          <span>{ep.successRate24h}%</span>
                          <span className="text-[10px] font-normal text-text-muted">
                            ({ep.totalDeliveries24h} calls)
                          </span>
                        </div>
                      </div>

                      <StatusPill
                        variant={
                          ep.status === "active"
                            ? "success"
                            : ep.status === "failing"
                            ? "danger"
                            : "neutral"
                        }
                        label={
                          ep.status === "active"
                            ? "Active"
                            : ep.status === "failing"
                            ? "Failing (5/5)"
                            : "Disabled"
                        }
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Secret Display & Dual Signing Notice */}
                  <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 max-w-xl">
                      <CopyField
                        label="Signing Secret"
                        value={ep.signingSecret}
                        prefix="whsec_"
                        isSecret
                      />
                      {isRotating && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-[#E0A93B]">
                          <Clock className="w-3 h-3" />
                          <span>
                            Dual-signing rotation active until {new Date(ep.secretRotationEndsAt!).toLocaleTimeString()} (Relay signs with both keys)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => {
                          setActiveEndpointForAction(ep);
                          setTestResult(null);
                          setIsTestModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface border border-border text-xs text-text flex items-center gap-1.5 transition-colors font-medium"
                      >
                        <Send className="w-3.5 h-3.5 text-accent" />
                        <span>Send Test Event</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveEndpointForAction(ep);
                          setIsRotateModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface border border-border text-xs text-text-muted hover:text-text flex items-center gap-1.5 transition-colors"
                        title="Rotate signing secret with 24h grace period"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Rotate Secret</span>
                      </button>

                      <button
                        onClick={() => handleToggleEndpoint(ep)}
                        className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface border border-border text-text-muted hover:text-text transition-colors"
                        title={ep.status === "disabled" ? "Enable Endpoint" : "Disable Endpoint"}
                      >
                        <Power className={`w-3.5 h-3.5 ${ep.status === "active" ? "text-[#3FB68B]" : "text-text-muted"}`} />
                      </button>

                      <button
                        onClick={() => handleDeleteEndpoint(ep.id)}
                        className="p-1.5 rounded-lg bg-surface-2 hover:bg-[#E5534B]/10 border border-border hover:border-[#E5534B]/40 text-text-muted hover:text-[#E5534B] transition-colors"
                        title="Delete Endpoint"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Endpoint Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-text">Add Webhook Endpoint</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Register a destination URL to receive signed HTTP POST event payloads.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-text-muted hover:text-text text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEndpoint} className="space-y-4">
              {/* URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  Endpoint URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://api.yourdomain.com/webhooks/relay"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs font-mono text-text outline-none"
                />
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>
                    {newEnvironment === "live"
                      ? "⚠️ Live production requires HTTPS (localhost not permitted)."
                      : "HTTP, HTTPS, and localhost URLs are permitted in Test mode."}
                  </span>
                  {receiverConfig && (
                    <button
                      type="button"
                      onClick={() => setNewUrl(receiverConfig.url)}
                      className="text-accent hover:underline font-mono"
                    >
                      Use Test Receiver
                    </button>
                  )}
                </div>
              </div>

              {/* Environment & Version */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    Environment
                  </label>
                  <select
                    value={newEnvironment}
                    onChange={(e) => setNewEnvironment(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#09090B] border border-border text-xs font-mono text-text outline-none"
                  >
                    <option value="test">Test (Sandbox)</option>
                    <option value="live">Live (Production)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    API Version
                  </label>
                  <select
                    value={newApiVersion}
                    onChange={(e) => setNewApiVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#09090B] border border-border text-xs font-mono text-text outline-none"
                  >
                    <option value="v2025-10-01">v2025-10-01 (Current)</option>
                  </select>
                </div>
              </div>

              {/* Event Subscriptions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    Subscribed Events ({selectedEvents.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const all = AVAILABLE_EVENTS.flatMap((c) => c.events.map((e) => e.id));
                      setSelectedEvents(selectedEvents.length === all.length ? [] : all);
                    }}
                    className="text-[11px] font-mono text-accent hover:underline"
                  >
                    {selectedEvents.length === AVAILABLE_EVENTS.flatMap((c) => c.events.map((e) => e.id)).length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>

                <div className="space-y-3 bg-[#09090B] p-3 rounded-xl border border-border max-h-48 overflow-y-auto">
                  {AVAILABLE_EVENTS.map((category) => (
                    <div key={category.category} className="space-y-1.5">
                      <div className="text-[10px] font-mono uppercase text-text-muted tracking-wider font-semibold">
                        {category.category}
                      </div>
                      <div className="space-y-1 pl-1">
                        {category.events.map((evt) => {
                          const isChecked = selectedEvents.includes(evt.id);
                          return (
                            <label
                              key={evt.id}
                              className="flex items-start gap-2 cursor-pointer text-xs group"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedEvents((prev) =>
                                    isChecked ? prev.filter((id) => id !== evt.id) : [...prev, evt.id]
                                  );
                                }}
                                className="mt-0.5 rounded border-border bg-surface text-accent"
                              />
                              <div className="leading-tight">
                                <span className="font-mono text-text group-hover:text-accent transition-colors">
                                  {evt.name}
                                </span>
                                <span className="text-text-muted text-[11px] block">
                                  {evt.desc}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || selectedEvents.length === 0}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {actionLoading ? "Registering..." : "Create Endpoint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secret Reveal Modal */}
      {isSecretRevealOpen && revealedSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3FB68B]/10 border border-[#3FB68B]/30 flex items-center justify-center text-[#3FB68B]">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">Signing Secret Generated</h3>
                <p className="text-xs text-text-muted">
                  Use this secret to verify the <code className="text-accent font-mono">Relay-Signature</code> header.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#E0A93B]/10 border border-[#E0A93B]/30 text-xs text-text-muted flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#E0A93B] shrink-0 mt-0.5" />
              <span>
                Save this signing secret now. For security purposes, Relay stores only hashed secrets and will not display the unmasked key again.
              </span>
            </div>

            <div className="space-y-1.5">
              <CopyField
                label="Webhook Signing Secret"
                value={revealedSecret.secret}
                prefix="whsec_"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setIsSecretRevealOpen(false);
                  setRevealedSecret(null);
                }}
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
              >
                I have securely saved this secret
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Rotation Confirmation Modal */}
      {isRotateModalOpen && activeEndpointForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E0A93B]/10 border border-[#E0A93B]/30 flex items-center justify-center text-[#E0A93B]">
                <RotateCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">Rotate Webhook Signing Secret</h3>
                <p className="text-xs text-text-muted truncate max-w-sm">
                  {activeEndpointForAction.url}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-text-muted leading-relaxed">
              <p>
                Relay uses <strong>zero-downtime dual-signing rotation</strong>:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>A new signing secret is generated immediately.</li>
                <li>
                  For the next <strong>24 hours</strong>, Relay signs payloads with <strong>both</strong> the new and old secrets (<code className="text-accent font-mono">v1=newSig,v1=oldSig</code>).
                </li>
                <li>Your backend has 24 hours to update its environment variable with zero dropped events.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                onClick={() => setIsRotateModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRotateSecret}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Rotating..." : "Start 24h Dual-Signing Rotation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Test Event Modal */}
      {isTestModalOpen && activeEndpointForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-text">Send Test Event</h3>
                <p className="text-xs text-text-muted mt-0.5 truncate max-w-md">
                  Target: <code className="font-mono text-accent">{activeEndpointForAction.url}</code>
                </p>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="text-text-muted hover:text-text text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  Choose Event Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "message.delivered",
                    "message.failed",
                    "message.sent",
                    "message.read",
                    "customer.profile.updated",
                    "workspace.kyc.updated",
                  ].map((evt) => (
                    <button
                      key={evt}
                      type="button"
                      onClick={() => setTestEventType(evt)}
                      className={`px-3 py-2 rounded-lg text-xs font-mono text-left border transition-all ${
                        testEventType === evt
                          ? "bg-accent/20 border-accent text-accent font-semibold"
                          : "bg-surface-2 hover:bg-surface border-border text-text-muted"
                      }`}
                    >
                      {evt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSendTestEvent}
                disabled={testSending}
                className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testSending ? "Dispatching HTTP POST..." : "Dispatch Test Event Now"}</span>
              </button>

              {/* Immediate Result Render */}
              {testResult && (
                <div className="p-4 rounded-xl bg-[#09090B] border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${
                          testResult.delivery?.responseStatus >= 200 && testResult.delivery?.responseStatus < 300
                            ? "bg-[#3FB68B]/15 text-[#3FB68B] border border-[#3FB68B]/30"
                            : "bg-[#E5534B]/15 text-[#E5534B] border border-[#E5534B]/30"
                        }`}
                      >
                        HTTP {testResult.delivery?.responseStatus || "Error"}
                      </span>
                      <span className="text-xs font-mono text-text-muted">
                        Latency: {testResult.delivery?.durationMs}ms
                      </span>
                    </div>

                    <Link
                      href="/console/logs"
                      className="text-xs font-mono text-accent hover:underline flex items-center gap-1"
                    >
                      <span>View in Event Logs</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {testResult.message && (
                    <p className="text-xs text-text-muted">{testResult.message}</p>
                  )}

                  {testResult.delivery?.responseBody && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase text-text-muted">Recipient Server Response:</span>
                      <pre className="p-2.5 rounded bg-surface border border-border text-xs font-mono text-text max-h-36 overflow-y-auto whitespace-pre-wrap">
                        {testResult.delivery.responseBody}
                      </pre>
                    </div>
                  )}

                  {testResult.delivery?.id && testResult.delivery.responseStatus >= 400 && (
                    <div className="pt-2 border-t border-border">
                      <WebhookAiExplanation deliveryId={testResult.delivery.id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Signature Checker & Verification Code Drawer / Modal */}
      {isSignatureCheckerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text">Webhook Signature Verification Bench</h3>
                  <p className="text-xs text-text-muted">
                    Validate Relay HMAC-SHA256 headers, diagnose raw-body deserialization bugs, and copy production code.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSignatureCheckerOpen(false)}
                className="text-text-muted hover:text-text text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Quick pre-loader callout */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-border text-xs">
              <span className="text-text-muted">
                Debugging customer issue? Test our pre-loaded scenario:
              </span>
              <button
                type="button"
                onClick={loadScenario2SignatureMismatch}
                className="px-2.5 py-1 rounded bg-[#E0A93B]/10 hover:bg-[#E0A93B]/20 text-[#E0A93B] border border-[#E0A93B]/30 font-mono font-medium transition-colors"
              >
                Load Scenario #2 (Re-serialized JSON Mismatch)
              </button>
            </div>

            {/* Interactive Checker Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                    1. Raw Request Body (Exact Bytes)
                  </label>
                  <textarea
                    rows={6}
                    value={checkerPayload}
                    onChange={(e) => setCheckerPayload(e.target.value)}
                    placeholder='{"id":"evt_123","type":"message.delivered",...}'
                    className="w-full p-2.5 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs font-mono text-text outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                    2. Relay-Signature Header
                  </label>
                  <input
                    type="text"
                    value={checkerHeader}
                    onChange={(e) => setCheckerHeader(e.target.value)}
                    placeholder="t=1793300000,v1=41496b8c8d8b..."
                    className="w-full px-3 py-2 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs font-mono text-text outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                    3. Endpoint Signing Secret
                  </label>
                  <input
                    type="text"
                    value={checkerSecret}
                    onChange={(e) => setCheckerSecret(e.target.value)}
                    placeholder="whsec_test_..."
                    className="w-full px-3 py-2 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs font-mono text-text outline-none"
                  />
                </div>

                <button
                  onClick={handleCheckSignature}
                  disabled={checkerLoading || !checkerPayload || !checkerHeader || !checkerSecret}
                  className="w-full py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{checkerLoading ? "Computing HMAC..." : "Verify Signature"}</span>
                </button>
              </div>

              {/* Diagnosis Output */}
              <div className="space-y-3">
                <label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                  Verification Diagnosis
                </label>
                <div className="p-4 rounded-xl bg-[#09090B] border border-border min-h-[280px] flex flex-col justify-between text-xs space-y-3">
                  {checkerResult ? (
                    <div className="space-y-3">
                      <div
                        className={`p-3 rounded-lg border font-mono text-xs flex items-center gap-2 ${
                          checkerResult.isValid
                            ? "bg-[#3FB68B]/10 border-[#3FB68B]/30 text-[#3FB68B]"
                            : "bg-[#E5534B]/10 border-[#E5534B]/30 text-[#E5534B]"
                        }`}
                      >
                        {checkerResult.isValid ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                        )}
                        <span className="font-bold">
                          {checkerResult.isValid ? "SIGNATURE VALID" : "SIGNATURE REJECTED"}
                        </span>
                      </div>

                      <div className="space-y-1 text-text-muted">
                        <p className="text-text leading-relaxed">{checkerResult.message}</p>
                        {checkerResult.hint && (
                          <div className="p-2.5 rounded bg-surface border border-accent/30 text-accent text-[11px] mt-2">
                            <strong>Diagnostic Hint:</strong> {checkerResult.hint}
                          </div>
                        )}
                      </div>

                      {checkerResult.computedSignature && (
                        <div className="space-y-1 text-[11px] font-mono text-text-muted pt-2 border-t border-border">
                          <div>
                            Computed: <code className="text-text">{checkerResult.computedSignature.slice(0, 24)}...</code>
                          </div>
                          {checkerResult.driftSeconds !== undefined && (
                            <div>
                              Clock Drift: <span className="text-text">{checkerResult.driftSeconds}s</span> (Allowed: &lt; 300s)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="my-auto text-center text-text-muted space-y-2">
                      <Terminal className="w-8 h-8 mx-auto text-text-muted/40" />
                      <p>Enter payload, header, and secret to compute diagnostic comparison.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ready-to-copy code snippets */}
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-text uppercase">
                  Production Verification Snippets
                </span>
                <div className="flex items-center gap-1 bg-[#09090B] p-1 rounded-lg border border-border">
                  {(["nodejs", "python", "go", "php", "java"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedSnippetLang(lang)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase transition-colors ${
                        selectedSnippetLang === lang
                          ? "bg-accent text-white font-bold"
                          : "text-text-muted hover:text-text"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <pre className="p-3.5 rounded-xl bg-[#09090B] border border-border text-xs font-mono text-accent overflow-x-auto max-h-56 leading-relaxed">
                  {CODE_SNIPPETS[selectedSnippetLang]}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(CODE_SNIPPETS[selectedSnippetLang]);
                  }}
                  className="absolute top-3 right-3 px-2 py-1 rounded bg-surface hover:bg-surface-2 border border-border text-[11px] font-mono text-text flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
