"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { formatINR, formatDateTimeIST } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";
import { toast } from "@/components/ui/Toaster";
import {
  verifyAuditIntegrityAction,
  exportAuditLogCsvAction,
} from "@/app/actions/audit";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Eye,
  X,
  RefreshCw,
  Copy,
  Check,
  Link as LinkIcon,
  Calendar,
  Lock,
} from "lucide-react";

export interface AuditLogEntry {
  id: string;
  timestamp: string | Date;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  avatarColor?: string;
  action: string;
  humanAction: string;
  targetType: string;
  targetId: string;
  orgId?: string | null;
  orgName?: string | null;
  before?: string | null;
  after?: string | null;
  reason: string;
  changeRequestId?: string | null;
  aiAssisted: boolean;
  isDenied: boolean;
  ip: string;
  prevHash?: string | null;
  hash?: string | null;
}

interface AuditLogViewerProps {
  initialLogs: AuditLogEntry[];
  orgId?: string;
  targetId?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export function AuditLogViewer({
  initialLogs,
  orgId,
  targetId,
  title = "Immutable Audit Trail",
  subtitle = "Cryptographically chained, append-only operational log recording every state mutation and access attempt in Indian Standard Time (IST).",
  compact = false,
}: AuditLogViewerProps) {
  const { currentRole, roleDefinition } = useRole();

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedActionType, setSelectedActionType] = useState("all");
  const [aiOnly, setAiOnly] = useState(false);
  const [deniedOnly, setDeniedOnly] = useState(false);

  // Diff Drawer State
  const [activeEntry, setActiveEntry] = useState<AuditLogEntry | null>(null);

  // Integrity Check State
  const [isVerifying, setIsVerifying] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<any | null>(null);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);

  // CSV Export State
  const [isExporting, setIsExporting] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Filtered Entries
  const filteredLogs = useMemo(() => {
    return initialLogs.filter((entry) => {
      // 1. Contextual Org / Target filters
      if (orgId && entry.orgId !== orgId) return false;
      if (targetId && entry.targetId !== targetId) return false;

      // 2. Role filter
      if (selectedRole !== "all" && entry.actorRole !== selectedRole) return false;

      // 3. Action type filter
      if (selectedActionType !== "all") {
        const act = entry.action.toLowerCase();
        if (selectedActionType === "money" && !act.includes("credit") && !act.includes("wallet") && !act.includes("invoice") && !act.includes("topup") && !act.includes("adjustment")) return false;
        if (selectedActionType === "lifecycle" && !act.includes("status") && !act.includes("suspend") && !act.includes("reactivat") && !act.includes("onboard")) return false;
        if (selectedActionType === "compliance" && !act.includes("kyc") && !act.includes("sender") && !act.includes("template")) return false;
        if (selectedActionType === "plans" && !act.includes("plan") && !act.includes("discount") && !act.includes("rate")) return false;
        if (selectedActionType === "support" && !act.includes("ticket") && !act.includes("user") && !act.includes("seat")) return false;
      }

      // 4. AI-only toggle
      if (aiOnly && !entry.aiAssisted) return false;

      // 5. Denied-only toggle
      if (deniedOnly && !entry.isDenied) return false;

      // 6. Free text search
      if (search.trim().length > 0) {
        const q = search.toLowerCase().trim();
        const haystack = [
          entry.id,
          entry.humanAction,
          entry.action,
          entry.reason,
          entry.actorName,
          entry.actorEmail,
          entry.orgName || "",
          entry.targetId,
          entry.targetType,
          entry.before || "",
          entry.after || "",
        ].join(" ").toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [initialLogs, orgId, targetId, selectedRole, selectedActionType, aiOnly, deniedOnly, search]);

  // Handle Verify Integrity
  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyAuditIntegrityAction();
      if (!res.success) throw new Error(res.error);

      setIntegrityResult(res.data);
      setShowIntegrityModal(true);

      if (res.data?.valid) {
        toast({
          title: "Cryptographic Chain Intact",
          description: `All ${res.data.totalVerified} audit blocks successfully verified against SHA-256 hash sequence.`,
        });
      } else {
        toast({
          title: "Tamper Alert!",
          description: `Integrity failure detected at entry #${res.data?.brokenEntryId}.`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle CSV Export (audited)
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await exportAuditLogCsvAction({
        search,
        role: selectedRole,
        actionType: selectedActionType,
        aiOnly,
        deniedOnly,
        orgId,
        targetId,
      });

      if (!res.success || !res.csv) throw new Error(res.error || "Failed to generate CSV export");

      // Trigger browser download
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", res.filename || "relay-audit-export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Audit Log Exported",
        description: `Downloaded ${res.rowCount} entries. Export operation was recorded in the tamper-evident audit trail.`,
      });
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Copy hash helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
    toast({ title: "Copied to clipboard", description: "SHA-256 block hash copied." });
  };

  // Render parsed JSON diff
  const renderDiff = (beforeJson: string | null | undefined, afterJson: string | null | undefined) => {
    let beforeObj: Record<string, any> = {};
    let afterObj: Record<string, any> = {};

    try {
      if (beforeJson) beforeObj = JSON.parse(beforeJson);
    } catch {}
    try {
      if (afterJson) afterObj = JSON.parse(afterJson);
    } catch {}

    const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));

    if (allKeys.length === 0) {
      return (
        <div className="rounded border border-border/60 bg-surface-2/40 p-4 text-center text-xs text-text-muted italic">
          No structured field changes recorded for this entry.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2">
          <div className="col-span-4">Field</div>
          <div className="col-span-4">Previous Value</div>
          <div className="col-span-4">New Value</div>
        </div>
        <div className="divide-y divide-border/40 rounded border border-border bg-surface-2/30">
          {allKeys.map((key) => {
            const oldVal = beforeObj[key];
            const newVal = afterObj[key];
            const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

            const formatVal = (v: any) => {
              if (v === undefined || v === null) return <span className="text-text-muted italic">—</span>;
              if (typeof v === "number" && (key.toLowerCase().includes("limit") || key.toLowerCase().includes("amount") || key.toLowerCase().includes("balance") || key.toLowerCase().includes("used") || key.toLowerCase().includes("spend"))) {
                return formatINR(v);
              }
              if (typeof v === "object") return <code className="text-[10px]">{JSON.stringify(v)}</code>;
              return String(v);
            };

            return (
              <div
                key={key}
                className={`grid grid-cols-12 gap-2 p-2.5 text-xs font-mono items-center transition-colors ${
                  isChanged ? "bg-accent/5" : ""
                }`}
              >
                <div className="col-span-4 font-semibold text-text truncate">
                  {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                </div>
                <div className="col-span-4 text-danger/80 truncate">
                  {formatVal(oldVal)}
                </div>
                <div className="col-span-4 text-success font-semibold truncate">
                  {formatVal(newVal)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Tamper-Evident Chain Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-text tracking-tight">{title}</h2>
            <div className="flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-[11px] font-mono text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Tamper-Evident SHA-256 Chain</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-text-muted max-w-3xl">{subtitle}</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleVerifyIntegrity}
            disabled={isVerifying}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover hover:border-accent transition-colors disabled:opacity-50"
            title="Recompute all cryptographic hashes in the blockchain-style log"
          >
            {isVerifying ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent" />
            ) : (
              <Shield className="h-3.5 w-3.5 text-accent" />
            )}
            <span>Verify Integrity</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
            title="Export filtered audit logs to CSV (audited operation)"
          >
            <Download className="h-3.5 w-3.5 text-text-muted" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Role Scoping Notice */}
      <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-2/40 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-text-muted">Viewing as:</span>
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold border"
            style={{
              backgroundColor: `${roleDefinition.badgeColor}18`,
              borderColor: `${roleDefinition.badgeColor}40`,
              color: roleDefinition.badgeColor,
            }}
          >
            {roleDefinition.label}
          </span>
          <span className="text-text-muted/70 text-[11px] hidden sm:inline">
            {currentRole === "admin" || currentRole === "compliance"
              ? "(Full platform audit visibility)"
              : currentRole === "finance" || currentRole === "finance_head"
              ? "(Scoped to commercial and financial mutations)"
              : currentRole === "account_manager"
              ? "(Scoped to assigned customer accounts)"
              : "(Scoped to support tickets and user actions)"}
          </span>
        </div>
        <span className="font-mono text-[11px] text-text-muted">
          Showing {filteredLogs.length} of {initialLogs.length} events
        </span>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-surface p-3 rounded-lg border border-border">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reasons, actors, target IDs, or field values..."
            className="w-full rounded-md border border-border bg-surface-2 pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-text-muted hover:text-text"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Action Category Filter */}
        <select
          value={selectedActionType}
          onChange={(e) => setSelectedActionType(e.target.value)}
          className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text focus:outline-none focus:border-accent"
        >
          <option value="all">All Action Categories</option>
          <option value="money">Money &amp; Credit</option>
          <option value="lifecycle">Lifecycle &amp; Status</option>
          <option value="compliance">Compliance &amp; DLT</option>
          <option value="plans">Plans &amp; Pricing</option>
          <option value="support">Tickets &amp; Seats</option>
        </select>

        {/* Role Filter */}
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text focus:outline-none focus:border-accent"
        >
          <option value="all">All Actor Roles</option>
          <option value="account_manager">Account Manager</option>
          <option value="support">Support</option>
          <option value="finance">Finance</option>
          <option value="finance_head">Finance Head</option>
          <option value="sales_ops">Sales Ops</option>
          <option value="compliance">Compliance</option>
          <option value="admin">Admin</option>
        </select>

        {/* AI Assisted Toggle */}
        <button
          type="button"
          onClick={() => setAiOnly(!aiOnly)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors ${
            aiOnly
              ? "bg-[#7C7CFF]/20 border-[#7C7CFF] text-[#7C7CFF]"
              : "border-border bg-surface-2 text-text-muted hover:text-text"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI-Assisted</span>
        </button>

        {/* Denied Attempts Toggle */}
        <button
          type="button"
          onClick={() => setDeniedOnly(!deniedOnly)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors ${
            deniedOnly
              ? "bg-danger/20 border-danger text-danger font-semibold"
              : "border-border bg-surface-2 text-text-muted hover:text-text"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Denied Attempts</span>
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-text-muted text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-3 px-3.5">Timestamp (IST)</th>
                <th className="py-3 px-3.5">Actor</th>
                <th className="py-3 px-3.5">Action</th>
                <th className="py-3 px-3.5">Target</th>
                <th className="py-3 px-3.5 max-w-[280px]">Justification / Reason</th>
                <th className="py-3 px-3.5">Flags</th>
                <th className="py-3 px-3.5 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted italic">
                    No audit records matching your current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-surface-2/50 transition-colors ${
                        log.isDenied ? "bg-danger/5" : ""
                      }`}
                    >
                      {/* Timestamp in IST */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-text">
                        <div>{formatDateTimeIST(log.timestamp)}</div>
                        <div className="text-[10px] text-text-muted font-mono">{log.id}</div>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-sans">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white font-mono"
                            style={{ backgroundColor: log.avatarColor || "#7C7CFF" }}
                          >
                            {log.actorName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-text text-xs leading-none">
                              {log.actorName}
                            </div>
                            <span className="text-[10px] text-text-muted capitalize">
                              {log.actorRole.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3.5 font-sans">
                        <div className="font-semibold text-text text-xs">{log.humanAction}</div>
                        <code className="text-[10px] text-text-muted font-mono">{log.action}</code>
                      </td>

                      {/* Target */}
                      <td className="py-3 px-3.5 font-sans">
                        {log.orgId ? (
                          <Link
                            href={`/accounts/${log.orgId}`}
                            className="text-text hover:text-accent font-medium text-xs block transition-colors"
                          >
                            {log.orgName || log.orgId}
                          </Link>
                        ) : (
                          <span className="text-text font-medium text-xs capitalize">
                            {log.targetType}
                          </span>
                        )}
                        <span className="text-[10px] text-text-muted font-mono block">
                          {log.targetId}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-3.5 font-sans max-w-[280px]">
                        <p className="text-xs text-text line-clamp-2 leading-relaxed">
                          {log.reason}
                        </p>
                      </td>

                      {/* Badges / Flags */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {log.isDenied && (
                            <span className="rounded bg-danger/20 border border-danger/40 px-1.5 py-0.5 text-[9px] font-bold text-danger uppercase tracking-wider">
                              Denied Attempt
                            </span>
                          )}
                          {log.aiAssisted && (
                            <span className="flex items-center gap-1 rounded bg-[#7C7CFF]/15 border border-[#7C7CFF]/30 px-1.5 py-0.5 text-[9px] font-bold text-[#7C7CFF]">
                              <Sparkles className="h-2.5 w-2.5" />
                              AI-Assisted
                            </span>
                          )}
                          {log.changeRequestId && (
                            <Link
                              href="/approvals"
                              className="rounded bg-surface-2 border border-border px-1.5 py-0.5 text-[9px] font-mono text-text hover:border-accent"
                            >
                              CR #{log.changeRequestId.slice(-4)}
                            </Link>
                          )}
                        </div>
                      </td>

                      {/* Inspect Drawer CTA */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setActiveEntry(log)}
                          className="inline-flex items-center gap-1 rounded bg-surface-2 border border-border px-2.5 py-1 text-[11px] font-medium text-text hover:bg-surface-hover hover:border-accent transition-colors"
                        >
                          <Eye className="h-3 w-3 text-accent" />
                          <span>Inspect Changes</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Before -> After Diff Drawer Modal */}
      {activeEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in-0">
          <div className="relative w-full max-w-3xl rounded-xl border border-border bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-accent">
                    #{activeEntry.id}
                  </span>
                  <span className="text-base font-bold text-text">
                    {activeEntry.humanAction}
                  </span>
                  {activeEntry.isDenied && (
                    <span className="rounded bg-danger/20 border border-danger/40 px-2 py-0.5 text-[10px] font-bold text-danger uppercase">
                      Denied Attempt
                    </span>
                  )}
                  {activeEntry.aiAssisted && (
                    <span className="flex items-center gap-1 rounded bg-[#7C7CFF]/20 px-2 py-0.5 text-[10px] font-bold text-[#7C7CFF]">
                      <Sparkles className="h-3 w-3" /> AI-Assisted
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  Executed at {formatDateTimeIST(activeEntry.timestamp)} by{" "}
                  <strong className="text-text">{activeEntry.actorName}</strong> (
                  {activeEntry.actorRole.replace(/_/g, " ")}) from IP {activeEntry.ip}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveEntry(null)}
                className="rounded p-1 text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Justification Section */}
            <div className="mt-4 rounded-lg border border-border/80 bg-surface-2/40 p-3.5">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                Audit Justification / Operational Reason
              </div>
              <p className="text-xs text-text leading-relaxed font-sans font-medium">
                "{activeEntry.reason}"
              </p>
            </div>

            {/* Cryptographic Hash Chain Proof */}
            <div className="mt-4 rounded-lg border border-border/80 bg-surface-2/60 p-3.5 font-mono text-[11px]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-semibold text-text">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  <span>Cryptographic Block Verification</span>
                </div>
                <span className="text-[10px] text-text-muted">SHA-256 Link</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-text-muted">
                  <span>Previous Block Hash:</span>
                  <span className="truncate max-w-[280px]" title={activeEntry.prevHash || ""}>
                    {activeEntry.prevHash ? `${activeEntry.prevHash.substring(0, 16)}...` : "GENESIS_BLOCK"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-text font-bold">
                  <span>Current Entry Hash:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate max-w-[280px]" title={activeEntry.hash || ""}>
                      {activeEntry.hash ? `${activeEntry.hash.substring(0, 24)}...` : "—"}
                    </span>
                    {activeEntry.hash && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(activeEntry.hash!)}
                        className="text-text-muted hover:text-accent p-0.5 rounded"
                      >
                        {copiedHash ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Before -> After Diff View */}
            <div className="mt-5 space-y-2">
              <div className="text-xs font-semibold text-text uppercase tracking-wider">
                State Transition Diff (Before → After)
              </div>
              {renderDiff(activeEntry.before, activeEntry.after)}
            </div>

            {/* Footer Actions */}
            <div className="mt-6 border-t border-border pt-4 flex items-center justify-between">
              {activeEntry.changeRequestId ? (
                <Link
                  href="/approvals"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  View Linked Change Request #{activeEntry.changeRequestId}{" "}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <span className="text-xs text-text-muted">Direct mutation (Within policy thresholds)</span>
              )}
              <button
                type="button"
                onClick={() => setActiveEntry(null)}
                className="rounded-md bg-surface-2 border border-border px-4 py-1.5 text-xs font-medium text-text hover:bg-surface-hover transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integrity Verification Report Modal */}
      {showIntegrityModal && integrityResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in-0">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  integrityResult.valid
                    ? "bg-success/20 text-success border border-success/40"
                    : "bg-danger/20 text-danger border border-danger/40"
                }`}
              >
                {integrityResult.valid ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-text">
                  {integrityResult.valid
                    ? "Cryptographic Integrity Verified"
                    : "Audit Log Integrity Violation!"}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Recomputed all SHA-256 blocks from genesis to the latest record.
                </p>
              </div>
            </div>

            <div
              className={`rounded-lg border p-4 text-xs font-mono leading-relaxed ${
                integrityResult.valid
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-danger/40 bg-danger/10 text-danger"
              }`}
            >
              {integrityResult.message}
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-surface-2/60 p-3.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-text-muted">Total Blocks Replayed:</span>
                <span className="font-bold text-text">{integrityResult.totalVerified}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Chain Status:</span>
                <span className={integrityResult.valid ? "text-success font-bold" : "text-danger font-bold"}>
                  {integrityResult.valid ? "100% UNBROKEN" : "TAMPERED"}
                </span>
              </div>
              {integrityResult.brokenEntryId && (
                <div className="flex justify-between text-danger font-bold">
                  <span>First Broken Entry:</span>
                  <span>#{integrityResult.brokenEntryId}</span>
                </div>
              )}
              {integrityResult.latestHash && (
                <div className="pt-2 border-t border-border flex flex-col gap-1">
                  <span className="text-[10px] text-text-muted uppercase">Latest Block SHA-256:</span>
                  <span className="text-[10px] text-text break-all">
                    {integrityResult.latestHash}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowIntegrityModal(false)}
                className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent/80 transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
