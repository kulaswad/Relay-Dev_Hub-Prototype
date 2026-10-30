"use client";

import React, { useState, useEffect } from "react";
import { useDevHub } from "@/components/providers/DevHubContext";
import {
  Key,
  Plus,
  RotateCw,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Globe,
  ExternalLink,
  ChevronRight,
  Info,
  Sliders,
  Activity,
  History,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  secretMasked: string;
  environment: "test" | "live";
  scopes: string;
  status: "active" | "rotating" | "revoked";
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  gracePeriodEndsAt: string | null;
  rotatedFromId: string | null;
  createdBy: string | null;
  ipAllowlist: string | null;
  isLocked?: boolean;
}

interface AuditLogItem {
  id: string;
  action: string;
  actor: string;
  details: string;
  createdAt: string;
}

interface RequestLogItem {
  id: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  errorCode: string | null;
  createdAt: string;
}

const SCOPE_DEFINITIONS = [
  {
    id: "messages:send",
    label: "messages:send",
    desc: "Dispatch SMS, RCS, and WhatsApp messages via Gateway",
  },
  {
    id: "messages:read",
    label: "messages:read",
    desc: "Read message status, carrier timelines, and delivery receipts",
  },
  {
    id: "events:write",
    label: "events:write",
    desc: "Ingest user actions and stream CDP event logs",
  },
  {
    id: "customers:read",
    label: "customers:read",
    desc: "Read unified customer profiles, consent, and traits",
  },
  {
    id: "customers:write",
    label: "customers:write",
    desc: "Update customer traits and consent records",
  },
  {
    id: "webhooks:manage",
    label: "webhooks:manage",
    desc: "Create, view, and delete destination webhook receivers",
  },
  {
    id: "usage:read",
    label: "usage:read",
    desc: "Inspect TPS limits, monthly quotas, and wallet balance",
  },
];

const PRESETS: Record<string, { label: string; desc: string; scopes: string[] }> = {
  backend: {
    label: "Backend sender",
    desc: "Standard transactional messaging service",
    scopes: ["messages:send", "messages:read"],
  },
  analytics: {
    label: "Read-only analytics",
    desc: "BI pipelines and dashboard integrations",
    scopes: ["messages:read", "customers:read", "usage:read"],
  },
  collector: {
    label: "Event collector (client-safe)",
    desc: "Frontend/Mobile SDK event ingestion",
    scopes: ["events:write"],
  },
  full: {
    label: "Full access (not recommended)",
    desc: "All programmatic actions across the workspace",
    scopes: SCOPE_DEFINITIONS.map((s) => s.id),
  },
};

export default function CredentialsConsolePage() {
  const { environment, setEnvironment } = useDevHub();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiveLocked, setIsLiveLocked] = useState(false);
  const [workspaceKycStatus, setWorkspaceKycStatus] = useState("not_started");
  const [walletBalance, setWalletBalance] = useState(0);

  // Modals & Drawers state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [rotateModalKey, setRotateModalKey] = useState<ApiKeyItem | null>(null);
  const [revokeModalKey, setRevokeModalKey] = useState<ApiKeyItem | null>(null);
  const [createdSecretModal, setCreatedSecretModal] = useState<{
    keyName: string;
    rawSecret: string;
    isRotation?: boolean;
  } | null>(null);
  const [detailDrawerKey, setDetailDrawerKey] = useState<ApiKeyItem | null>(null);
  const [keyDetails, setKeyDetails] = useState<{
    auditLogs: AuditLogItem[];
    recentRequests: RequestLogItem[];
    usageCount24h: number;
    usageChart: Array<{ date: string; successful: number; failed: number }>;
  } | null>(null);

  // Form states
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<"test" | "live">(environment);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "messages:send",
    "messages:read",
  ]);
  const [selectedPreset, setSelectedPreset] = useState("backend");
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [ipAllowlist, setIpAllowlist] = useState("");
  const [gracePeriodHours, setGracePeriodHours] = useState<1 | 24 | 168>(24);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSavingScopes, setIsSavingScopes] = useState(false);
  const [drawerScopes, setDrawerScopes] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch keys list
  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/internal/api-keys?environment=${environment}`);
      const data = await res.json();
      if (data.keys) {
        setKeys(data.keys);
        setIsLiveLocked(data.isLiveLocked);
        setWorkspaceKycStatus(data.workspaceKycStatus);
        setWalletBalance(data.walletBalance || 0);
      }
    } catch (e) {
      console.error("Failed to load keys:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    setNewKeyEnv(environment);
  }, [environment]);

  // Load key details for drawer
  const openKeyDetails = async (key: ApiKeyItem) => {
    setDetailDrawerKey(key);
    let initialScopes: string[] = [];
    try {
      initialScopes = JSON.parse(key.scopes);
    } catch {}
    setDrawerScopes(initialScopes);
    try {
      const res = await fetch(`/api/internal/api-keys/${key.id}/details`);
      const data = await res.json();
      setKeyDetails(data);
    } catch (err) {
      console.error("Error loading key details:", err);
    }
  };

  // Toggle KYC simulation for demo
  const handleToggleKycSimulation = async (status: "approved" | "in_review") => {
    try {
      setActionLoading(true);
      await fetch("/api/internal/simulate-kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kycStatus: status }),
      });
      await fetchKeys();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch("/api/internal/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          environment: newKeyEnv,
          scopes: selectedScopes,
          expiresInDays: expiresInDays,
          ipAllowlist: ipAllowlist.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success && data.rawKey) {
        setCreateModalOpen(false);
        setCreatedSecretModal({
          keyName: newKeyName,
          rawSecret: data.rawKey,
        });
        setNewKeyName("");
        await fetchKeys();
      } else {
        alert(data.error || "Failed to create key");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Rotate Key
  const handleRotateKey = async () => {
    if (!rotateModalKey) return;
    try {
      setActionLoading(true);
      const res = await fetch("/api/internal/api-keys/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId: rotateModalKey.id,
          gracePeriodHours,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRotateModalKey(null);
        setCreatedSecretModal({
          keyName: `${rotateModalKey.name} (Rotated)`,
          rawSecret: data.rawKey,
          isRotation: true,
        });
        await fetchKeys();
      } else {
        alert(data.error || "Failed to rotate key");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Revoke Key
  const handleRevokeKey = async () => {
    if (!revokeModalKey) return;
    try {
      setActionLoading(true);
      const res = await fetch("/api/internal/api-keys/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: revokeModalKey.id }),
      });
      const data = await res.json();
      if (data.success) {
        setRevokeModalKey(null);
        if (detailDrawerKey?.id === revokeModalKey.id) {
          setDetailDrawerKey(null);
        }
        await fetchKeys();
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle End Grace Period Now
  const handleEndGracePeriod = async (keyId: string) => {
    if (!confirm("Are you sure you want to terminate the rotation grace period immediately? The old key will stop working.")) {
      return;
    }
    try {
      await fetch("/api/internal/api-keys/end-grace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });
      await fetchKeys();
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Save Scopes in Drawer
  const handleSaveDrawerScopes = async () => {
    if (!detailDrawerKey) return;
    try {
      setIsSavingScopes(true);
      const res = await fetch(`/api/internal/api-keys/${detailDrawerKey.id}/scopes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes: drawerScopes }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchKeys();
        // Refresh details
        const detRes = await fetch(`/api/internal/api-keys/${detailDrawerKey.id}/details`);
        const detData = await detRes.json();
        setKeyDetails(detData);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingScopes(false);
    }
  };

  // Rotating keys banner check
  const rotatingKey = keys.find((k) => k.status === "rotating");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Title & Environment Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text tracking-tight flex items-center gap-2.5">
              <Key className="w-6 h-6 text-accent" />
              API Keys & Credentials
            </h1>
            <span
              className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                environment === "test"
                  ? "bg-[#E0A93B]/10 text-[#E0A93B] border-[#E0A93B]/30"
                  : "bg-[#3FB68B]/10 text-[#3FB68B] border-[#3FB68B]/30"
              }`}
            >
              {environment === "test" ? "Test Sandbox" : "Live Production"}
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1 leading-relaxed">
            Manage programmatic authentication secrets, fine-grained permission scopes, and zero-downtime rotation grace periods.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setNewKeyEnv(environment);
              setCreateModalOpen(true);
            }}
            disabled={environment === "live" && isLiveLocked}
            className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-[#09090B] font-semibold px-4 py-2 rounded-lg text-xs transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create API Key
          </button>
        </div>
      </div>

      {/* Rotating Key Active Warning Banner */}
      {rotatingKey && (
        <div className="p-4 rounded-lg bg-[#E0A93B]/10 border border-[#E0A93B]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <RotateCw className="w-5 h-5 text-[#E0A93B] shrink-0 mt-0.5 animate-spin-slow" />
            <div>
              <div className="text-xs font-bold text-[#E0A93B] uppercase tracking-wider">
                Rotation Grace Period Active
              </div>
              <p className="text-xs text-text mt-0.5">
                Key <span className="font-mono font-semibold">{rotatingKey.name}</span> ({rotatingKey.secretMasked}) is rotating.
                Both keys remain active until{" "}
                <span className="font-semibold text-text">
                  {rotatingKey.gracePeriodEndsAt ? new Date(rotatingKey.gracePeriodEndsAt).toLocaleString() : "end of grace period"}
                </span>.
              </p>
              <p className="text-[11px] text-text-muted mt-1">
                Last used: {rotatingKey.lastUsedAt ? new Date(rotatingKey.lastUsedAt).toLocaleString() : "Never"}.
                Verify your services have switched to the new key before ending grace.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleEndGracePeriod(rotatingKey.id)}
            className="px-3 py-1.5 rounded bg-[#E0A93B]/20 hover:bg-[#E0A93B]/30 border border-[#E0A93B]/40 text-[#E0A93B] text-xs font-semibold shrink-0 transition-colors"
          >
            End grace period now
          </button>
        </div>
      )}

      {/* Security UX Advisory & Exposed Key Helper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-surface border border-border text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-accent" />
          <span>
            API keys authenticate via cryptographic SHA-256 hashes. Plaintext keys are never stored.
          </span>
        </div>
        <a
          href="#exposed-keys"
          onClick={(e) => {
            e.preventDefault();
            alert("If an API key is exposed publicly, immediately click 'Rotate' or 'Revoke' below to invalidate it without delay.");
          }}
          className="text-accent hover:underline flex items-center gap-1 font-medium shrink-0"
        >
          Exposed key? Emergency response <ArrowRight className="w-3 h-3" />
        </a>
      </div>

      {/* Environment-Specific View: Test vs Live */}
      {environment === "live" && isLiveLocked ? (
        /* KYC Locked State for Live Environment */
        <div className="space-y-6">
          <div className="p-8 rounded-xl border border-[#E0A93B]/30 bg-[#E0A93B]/5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#E0A93B]/10 border border-[#E0A93B]/30 flex items-center justify-center mx-auto text-[#E0A93B]">
              <Lock className="w-6 h-6" />
            </div>
            <div className="max-w-xl mx-auto space-y-2">
              <h2 className="text-xl font-bold text-text">
                Live keys unlock after KYC approval
              </h2>
              <p className="text-xs text-text-muted leading-relaxed">
                Under Indian Telecom Regulations (TRAI TCCCPR 2018), live commercial SMS, RCS, and WhatsApp messaging requires an active Certificate of Incorporation and approved DLT headers.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setEnvironment("test")}
                className="bg-accent hover:bg-accent/90 text-[#09090B] font-bold px-5 py-2.5 rounded-lg text-xs transition-all shadow-md"
              >
                Keep building in Test, nothing here is blocked
              </button>

              <button
                onClick={() => handleToggleKycSimulation("approved")}
                disabled={actionLoading}
                className="bg-surface hover:bg-surface-2 border border-border text-text font-semibold px-4 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-[#3FB68B]" />
                Simulate KYC Approved (Demo Mode)
              </button>
            </div>
          </div>

          {/* KYC Progress Tracker Card */}
          <div className="p-6 rounded-xl border border-border bg-surface space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <div>
                <h3 className="text-sm font-bold text-text">
                  Enterprise Compliance & Onboarding Checklist
                </h3>
                <p className="text-xs text-text-muted">
                  Required milestones to unlock live message dispatch and billing wallet.
                </p>
              </div>
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-[#E0A93B]/10 text-[#E0A93B] border border-[#E0A93B]/30 font-semibold">
                Status: In Review
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-surface-2/60 border border-[#3FB68B]/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#3FB68B]">
                  <span>1. Documents</span>
                  <Check className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-text">MCA & GSTIN</p>
                <p className="text-[11px] text-text-muted">Certificate of Incorporation verified.</p>
                <div className="text-[10px] text-[#3FB68B] font-mono">Completed ✓</div>
              </div>

              <div className="p-4 rounded-lg bg-surface-2/60 border border-[#E0A93B]/40 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#E0A93B]">
                  <span>2. Verification</span>
                  <Clock className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-text">Entity Scrutiny</p>
                <p className="text-[11px] text-text-muted">Telecom carrier cross-referencing GST portal.</p>
                <div className="text-[10px] text-[#E0A93B] font-mono">In Review (est. 2-4 hrs)</div>
              </div>

              <div className="p-4 rounded-lg bg-surface-2/60 border border-[#3FB68B]/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#3FB68B]">
                  <span>3. Sender ID</span>
                  <Check className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-text">TRAI Header</p>
                <p className="text-[11px] text-text-muted">Headers &apos;RELAYI&apos; and &apos;ACMEPY&apos; provisioned.</p>
                <div className="text-[10px] text-[#3FB68B] font-mono">Approved ✓</div>
              </div>

              <div className="p-4 rounded-lg bg-surface-2/60 border border-[#E0A93B]/40 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#E0A93B]">
                  <span>4. DLT Template</span>
                  <Clock className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-text">Content Templates</p>
                <p className="text-[11px] text-text-muted">3 transactional templates under carrier review.</p>
                <div className="text-[10px] text-[#E0A93B] font-mono">Pending Operator (est. 12 hrs)</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Unlocked State: Active Keys Table */
        <div className="space-y-4">
          {environment === "live" && (
            <div className="p-4 rounded-lg bg-[#3FB68B]/10 border border-[#3FB68B]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#3FB68B]" />
                <div>
                  <span className="font-bold text-text">Live Production Mode Active. </span>
                  <span className="text-text-muted">
                    Prepaid wallet balance: <span className="font-mono text-[#3FB68B] font-bold">₹{walletBalance.toFixed(2)}</span>.
                    Live traffic deducts per rate-card: SMS ₹0.12, RCS ₹0.25, WhatsApp ₹0.70.
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleToggleKycSimulation("in_review")}
                className="text-[11px] font-mono text-text-muted hover:text-text underline shrink-0"
              >
                Revert to KYC In Review (Demo)
              </button>
            </div>
          )}

          {/* Keys Table Card */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="p-4 border-b border-border/80 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Active Keys ({keys.length})
              </h3>
              <span className="text-[11px] text-text-muted">
                Click any key to open telemetry & scope manager
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-text-muted">Loading credentials...</div>
            ) : keys.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="text-sm font-semibold text-text">No API keys found for this environment</p>
                <p className="text-xs text-text-muted">Generate a key to begin integrating the Relay API.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2/60 border-b border-border text-text-muted font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Name & Secret Mask</th>
                      <th className="py-3 px-4 font-semibold">Environment</th>
                      <th className="py-3 px-4 font-semibold">Scopes</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Last Used</th>
                      <th className="py-3 px-4 font-semibold">Expiry</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {keys.map((k) => {
                      let scopesList: string[] = [];
                      try {
                        scopesList = JSON.parse(k.scopes);
                      } catch {}

                      return (
                        <tr
                          key={k.id}
                          onClick={() => openKeyDetails(k)}
                          className="hover:bg-surface-2/50 cursor-pointer transition-colors group"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-text flex items-center gap-2">
                              <span>{k.name}</span>
                              {k.isLocked && (
                                <Lock className="w-3 h-3 text-[#E0A93B]" />
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5">
                              <span>{k.secretMasked}</span>
                              <span className="text-[10px] text-text-muted/60">({k.id})</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`font-mono text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${
                                k.environment === "test"
                                  ? "bg-[#E0A93B]/10 text-[#E0A93B] border-[#E0A93B]/30"
                                  : "bg-[#3FB68B]/10 text-[#3FB68B] border-[#3FB68B]/30"
                              }`}
                            >
                              {k.environment}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {scopesList.slice(0, 2).map((s) => (
                                <span
                                  key={s}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-muted border border-border"
                                >
                                  {s}
                                </span>
                              ))}
                              {scopesList.length > 2 && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-accent font-semibold border border-border">
                                  +{scopesList.length - 2}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-0.5 rounded border font-semibold ${
                                k.status === "active"
                                  ? "text-[#3FB68B] bg-[#3FB68B]/10 border-[#3FB68B]/30"
                                  : k.status === "rotating"
                                  ? "text-[#E0A93B] bg-[#E0A93B]/10 border-[#E0A93B]/30"
                                  : "text-[#E5534B] bg-[#E5534B]/10 border-[#E5534B]/30"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  k.status === "active"
                                    ? "bg-[#3FB68B]"
                                    : k.status === "rotating"
                                    ? "bg-[#E0A93B]"
                                    : "bg-[#E5534B]"
                                }`}
                              />
                              {k.status.toUpperCase()}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-text-muted">
                            {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-text-muted">
                            {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "Never"}
                          </td>

                          <td
                            className="py-3.5 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              {k.status !== "revoked" && (
                                <>
                                  <button
                                    onClick={() => setRotateModalKey(k)}
                                    title="Rotate Key"
                                    className="p-1.5 rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setRevokeModalKey(k)}
                                    title="Revoke Key"
                                    className="p-1.5 rounded hover:bg-[#E5534B]/10 text-text-muted hover:text-[#E5534B] transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => openKeyDetails(k)}
                                className="p-1.5 rounded hover:bg-surface-2 text-text-muted hover:text-accent transition-colors"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: Create API Key                                        */}
      {/* ============================================================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-xl border border-border bg-[#0C0C0F] shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" />
                Create New API Key
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-text-muted hover:text-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text">Key Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Order Sender"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              {/* Environment */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text">Environment</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv("test")}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between ${
                      newKeyEnv === "test"
                        ? "bg-[#E0A93B]/10 border-[#E0A93B] text-text"
                        : "bg-surface border-border text-text-muted"
                    }`}
                  >
                    <span>Test Sandbox</span>
                    <span className="font-mono text-[10px] text-[#E0A93B]">rl_test_...</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isLiveLocked) {
                        alert("Cannot select Live Production: KYC is pending. Please complete KYC in Settings first.");
                        return;
                      }
                      setNewKeyEnv("live");
                    }}
                    disabled={isLiveLocked}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between ${
                      newKeyEnv === "live"
                        ? "bg-[#3FB68B]/10 border-[#3FB68B] text-text"
                        : isLiveLocked
                        ? "bg-surface/50 border-border opacity-50 cursor-not-allowed text-text-muted"
                        : "bg-surface border-border text-text-muted"
                    }`}
                  >
                    <span>Live Production</span>
                    <span className="font-mono text-[10px] text-[#3FB68B]">rl_live_...</span>
                  </button>
                </div>
              </div>

              {/* Presets */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text">Permission Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(key);
                        setSelectedScopes(preset.scopes);
                      }}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                        selectedPreset === key
                          ? "bg-accent/10 border-accent text-text"
                          : "bg-surface border-border text-text-muted hover:border-text-muted"
                      }`}
                    >
                      <div className="font-bold text-text">{preset.label}</div>
                      <div className="text-[10px] text-text-muted leading-tight mt-0.5">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Security Advisory Warning for Full Access */}
              {selectedPreset === "full" && (
                <div className="p-3 rounded-lg bg-[#E0A93B]/10 border border-[#E0A93B]/30 flex items-start gap-2.5 text-xs text-[#E0A93B]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Principle of Least Privilege: </span>
                    Granting full access is discouraged for production backend microservices. Restrict keys to explicit permissions (e.g. messages:send).
                  </div>
                </div>
              )}

              {/* Granular Scope Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text">Fine-Grained Scopes</label>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {SCOPE_DEFINITIONS.map((scope) => {
                    const isChecked = selectedScopes.includes(scope.id);
                    return (
                      <label
                        key={scope.id}
                        className={`flex items-start gap-2.5 p-2 rounded border cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-surface-2 border-border"
                            : "bg-surface border-border/60 hover:border-border"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setSelectedPreset("custom");
                            if (e.target.checked) {
                              setSelectedScopes([...selectedScopes, scope.id]);
                            } else {
                              setSelectedScopes(selectedScopes.filter((s) => s !== scope.id));
                            }
                          }}
                          className="mt-0.5 accent-accent"
                        />
                        <div className="flex-1">
                          <span className="font-mono text-xs font-semibold text-text">
                            {scope.label}
                          </span>
                          <p className="text-[11px] text-text-muted leading-tight">
                            {scope.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Optional Expiry & IP Allowlist */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-text">Expiration</label>
                  <select
                    value={expiresInDays || ""}
                    onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-accent"
                  >
                    <option value="">Never Expires</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="365">1 Year</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-text">IP Allowlist (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.1, 127.0.0.1"
                    value={ipAllowlist}
                    onChange={(e) => setIpAllowlist(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || selectedScopes.length === 0}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent hover:bg-accent/90 disabled:opacity-50 text-[#09090B] transition-all"
                >
                  {actionLoading ? "Generating Key..." : "Generate Key Secret"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: Reveal Secret Once (Zero plaintext stored)           */}
      {/* ============================================================== */}
      {createdSecretModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl border border-accent/40 bg-[#0C0C0F] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-accent font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-accent" />
              <span>{createdSecretModal.isRotation ? "New Rotated Secret Generated" : "API Key Generated Successfully"}</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#E0A93B]/10 border border-[#E0A93B]/30 flex items-start gap-2.5 text-xs text-[#E0A93B]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">You will not see this secret again! </span>
                Relay stores only the cryptographic SHA-256 hash. Copy and save this secret in your environment variables now.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text">{createdSecretModal.keyName}</label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-surface border border-border">
                <span className="font-mono text-xs text-text select-all break-all flex-1">
                  {createdSecretModal.rawSecret}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdSecretModal.rawSecret);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="p-1.5 rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors shrink-0"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-[#3FB68B]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setCreatedSecretModal(null)}
                className="bg-accent hover:bg-accent/90 text-[#09090B] font-bold px-5 py-2 rounded-lg text-xs transition-all"
              >
                I Have Securely Copied This Secret
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: Rotate Key with Grace Period                         */}
      {/* ============================================================== */}
      {rotateModalKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl border border-border bg-[#0C0C0F] shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-text flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-[#E0A93B]" />
              Rotate API Key: {rotateModalKey.name}
            </h3>

            <p className="text-xs text-text-muted leading-relaxed">
              Zero-downtime key rotation creates a new secret immediately. The old secret remains active during the selected grace period, allowing your backend servers to switch seamlessly.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text">Migration Grace Period</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { hours: 1 as const, label: "1 Hour", sub: "Urgent" },
                  { hours: 24 as const, label: "24 Hours", sub: "Standard" },
                  { hours: 168 as const, label: "7 Days", sub: "Gradual" },
                ].map((opt) => (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() => setGracePeriodHours(opt.hours)}
                    className={`p-2.5 rounded-lg border text-center text-xs transition-colors ${
                      gracePeriodHours === opt.hours
                        ? "bg-[#E0A93B]/10 border-[#E0A93B] text-text font-bold"
                        : "bg-surface border-border text-text-muted hover:border-text-muted"
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-[10px] text-text-muted">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setRotateModalKey(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRotateKey}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#E0A93B] hover:bg-[#E0A93B]/90 text-[#09090B] transition-all"
              >
                {actionLoading ? "Rotating..." : "Proceed with Rotation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: Revoke Key Confirmation                              */}
      {/* ============================================================== */}
      {revokeModalKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl border border-[#E5534B]/40 bg-[#0C0C0F] shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-text flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-[#E5534B]" />
              Revoke Key Immediately?
            </h3>

            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to revoke <span className="font-semibold text-text">{revokeModalKey.name}</span> ({revokeModalKey.secretMasked})?
            </p>

            <div className="p-3 rounded-lg bg-[#E5534B]/10 border border-[#E5534B]/30 text-xs text-[#E5534B] space-y-1">
              <div className="font-bold">Immediate Production Impact:</div>
              <p className="text-[11px] leading-relaxed">
                Last used: {revokeModalKey.lastUsedAt ? new Date(revokeModalKey.lastUsedAt).toLocaleString() : "Never"}.
                Any background worker using this credential will be rejected immediately with HTTP 401 key_revoked.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRevokeModalKey(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeKey}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#E5534B] hover:bg-[#E5534B]/90 text-white transition-all shadow-md"
              >
                {actionLoading ? "Revoking..." : "Revoke Key Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DRAWER: Key Detail, Telemetry & Dynamic Scope Editor           */}
      {/* ============================================================== */}
      {detailDrawerKey && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[#0F0F12] border-l border-border h-full shadow-2xl flex flex-col justify-between overflow-y-auto p-6 space-y-6">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-text">{detailDrawerKey.name}</h2>
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${
                        detailDrawerKey.status === "active"
                          ? "text-[#3FB68B] bg-[#3FB68B]/10 border-[#3FB68B]/30"
                          : detailDrawerKey.status === "rotating"
                          ? "text-[#E0A93B] bg-[#E0A93B]/10 border-[#E0A93B]/30"
                          : "text-[#E5534B] bg-[#E5534B]/10 border-[#E5534B]/30"
                      }`}
                    >
                      {detailDrawerKey.status}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-text-muted mt-1 flex items-center gap-2">
                    <span>{detailDrawerKey.secretMasked}</span>
                    <span>•</span>
                    <span>{detailDrawerKey.id}</span>
                  </div>
                </div>
                <button
                  onClick={() => setDetailDrawerKey(null)}
                  className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 24h Telemetry Summary & 7-Day Chart */}
              <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-accent" />
                    Usage & Request Activity (Last 7 Days)
                  </h4>
                  <span className="font-mono text-xs font-bold text-text">
                    {keyDetails?.usageCount24h || 0} reqs / 24h
                  </span>
                </div>

                {keyDetails?.usageChart && (
                  <div className="h-32 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={keyDetails.usageChart}>
                        <XAxis dataKey="date" stroke="#8A8A94" fontSize={10} tickLine={false} />
                        <YAxis stroke="#8A8A94" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#16161A", borderColor: "#222228", fontSize: "11px" }}
                        />
                        <Bar dataKey="successful" fill="#3FB68B" name="Successful (2xx)" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="failed" fill="#E5534B" name="Failed (4xx/5xx)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Dynamic Scope Editor */}
              <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-accent" />
                      Dynamic Scope Permissions
                    </h4>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Changes apply immediately without key rotation.
                    </p>
                  </div>
                  <button
                    onClick={handleSaveDrawerScopes}
                    disabled={isSavingScopes || detailDrawerKey.status === "revoked"}
                    className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-[#09090B] font-semibold text-xs transition-all"
                  >
                    {isSavingScopes ? "Saving..." : "Apply Scopes"}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  {SCOPE_DEFINITIONS.map((scope) => {
                    const isChecked = drawerScopes.includes(scope.id);
                    return (
                      <label
                        key={scope.id}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked ? "bg-surface-2 border-border" : "bg-surface border-border/50 opacity-80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={detailDrawerKey.status === "revoked"}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDrawerScopes([...drawerScopes, scope.id]);
                            } else {
                              setDrawerScopes(drawerScopes.filter((s) => s !== scope.id));
                            }
                          }}
                          className="mt-0.5 accent-accent"
                        />
                        <div className="flex-1">
                          <span className="font-mono text-xs font-semibold text-text">{scope.label}</span>
                          <p className="text-[11px] text-text-muted leading-tight">{scope.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Audit Trail Timeline */}
              <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-accent" />
                  Key Lifecycle Audit Trail
                </h4>

                <div className="space-y-3 pt-1">
                  {keyDetails?.auditLogs && keyDetails.auditLogs.length > 0 ? (
                    keyDetails.auditLogs.map((log) => (
                      <div key={log.id} className="text-xs border-l-2 border-accent/40 pl-3 py-1 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-accent uppercase text-[11px]">
                            {log.action}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-text-muted text-[11px]">By {log.actor}</p>
                        {log.details && (
                          <div className="font-mono text-[10px] text-text-muted/80 bg-surface-2 p-1.5 rounded mt-1 overflow-x-auto">
                            {log.details}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-text-muted">No audit events recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Recent Requests Table */}
              <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                  Recent Inbound Requests (Key: {detailDrawerKey.id})
                </h4>
                <div className="space-y-1.5 text-xs font-mono">
                  {keyDetails?.recentRequests && keyDetails.recentRequests.length > 0 ? (
                    keyDetails.recentRequests.map((req) => (
                      <div key={req.id} className="p-2 rounded bg-surface-2 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="text-accent font-bold">{req.method}</span>
                          <span className="text-text">{req.path}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={req.status < 400 ? "text-[#3FB68B]" : "text-[#E5534B]"}>
                            {req.status}
                          </span>
                          <span className="text-text-muted">{req.durationMs}ms</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-text-muted">No recent requests recorded for this key.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              {detailDrawerKey.status !== "revoked" ? (
                <button
                  onClick={() => {
                    setRevokeModalKey(detailDrawerKey);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#E5534B]/10 hover:bg-[#E5534B]/20 text-[#E5534B] text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revoke Key
                </button>
              ) : (
                <span className="text-xs text-[#E5534B] font-mono">KEY IS PERMANENTLY REVOKED</span>
              )}
              <button
                onClick={() => setDetailDrawerKey(null)}
                className="px-4 py-2 rounded-lg bg-surface border border-border hover:bg-surface-2 text-text text-xs font-semibold transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
