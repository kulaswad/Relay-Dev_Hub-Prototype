"use client";

import React, { useState, useEffect } from "react";
import { formatINR } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";
import { toast } from "@/components/ui/Toaster";
import {
  WorkspacePricingSummary,
  PlanCatalogItem,
} from "@/lib/services/plans";
import {
  getWorkspacePricingAndSeatsAction,
  calculateCustomPricingImpactAction,
  updateWorkspacePricingAction,
  getAddonCatalogAction,
  attachWorkspaceAddonAction,
  cancelWorkspaceAddonAction,
  createSeatCorrectionRequestAction,
} from "@/app/actions/plans";
import {
  Sliders,
  Check,
  AlertTriangle,
  Info,
  Layers,
  Users,
  Shield,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Clock,
  DollarSign,
} from "lucide-react";

interface PlanPricingManagerProps {
  orgId: string;
  workspaces: Array<{
    id: string;
    name: string;
    billingModel: string;
  }>;
  availablePlans: PlanCatalogItem[];
  defaultWorkspaceId?: string;
}

export function PlanPricingManager({
  orgId,
  workspaces,
  availablePlans,
  defaultWorkspaceId,
}: PlanPricingManagerProps) {
  const { currentRole } = useRole();
  const [selectedWsId, setSelectedWsId] = useState<string>(
    defaultWorkspaceId || workspaces[0]?.id || ""
  );

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WorkspacePricingSummary | null>(null);

  // Pricing Editor Form
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [baseFeeOverride, setBaseFeeOverride] = useState<string>("");
  const [smsRateOverride, setSmsRateOverride] = useState<string>("");
  const [rcsRateOverride, setRcsRateOverride] = useState<string>("");
  const [waRateOverride, setWaRateOverride] = useState<string>("");
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [discountEndDate, setDiscountEndDate] = useState<string>("");
  const [changeReason, setChangeReason] = useState<string>("");

  // Live Bill Impact & Approval Policy
  const [impact, setImpact] = useState<{
    currentSpend: number;
    proposedSpend: number;
    deltaINR: number;
    deltaPct: number;
    requiresApproval: boolean;
    approvalNotice: string;
    table: any;
  } | null>(null);

  const [savingPricing, setSavingPricing] = useState(false);

  // Add-ons modal state
  const [addonsCatalog, setAddonsCatalog] = useState<any[]>([]);
  const [showAttachAddonModal, setShowAttachAddonModal] = useState(false);
  const [selectedAddonId, setSelectedAddonId] = useState<string>("");
  const [addonQty, setAddonQty] = useState<number>(1);
  const [attachingAddon, setAttachingAddon] = useState(false);

  // Cancel Addon dialog
  const [cancellingAddonId, setCancellingAddonId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Seat reconcile action state
  const [reconcilingSeats, setReconcilingSeats] = useState(false);

  // 1. Fetch workspace pricing details
  const fetchPricingDetails = async (wsId: string) => {
    setLoading(true);
    try {
      const res = await getWorkspacePricingAndSeatsAction(wsId);
      if (res.success && res.data) {
        setData(res.data);
        setSelectedPlanId(res.data.subscription.planId || res.data.plan.id);
        setDiscountPct(res.data.subscription.discountPct || 0);
        setDiscountEndDate(
          res.data.subscription.discountEndDate
            ? new Date(res.data.subscription.discountEndDate).toISOString().split("T")[0]
            : ""
        );

        const custom = res.data.subscription.customPriceOverrides;
        setBaseFeeOverride(custom?.baseFeeMonthly !== undefined ? String(custom.baseFeeMonthly) : "");
        setSmsRateOverride(custom?.sms !== undefined ? String(custom.sms) : "");
        setRcsRateOverride(custom?.rcs !== undefined ? String(custom.rcs) : "");
        setWaRateOverride(custom?.whatsapp !== undefined ? String(custom.whatsapp) : "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWsId) {
      fetchPricingDetails(selectedWsId);
    }
  }, [selectedWsId]);

  // Load Addon Catalog once
  useEffect(() => {
    getAddonCatalogAction().then((res) => {
      if (res.success && res.data) {
        setAddonsCatalog(res.data);
        if (res.data.length > 0) setSelectedAddonId(res.data[0].id);
      }
    });
  }, []);

  // 2. Live Bill Impact Calculation as user changes values
  useEffect(() => {
    if (!selectedWsId || !data) return;

    const timer = setTimeout(async () => {
      try {
        const customOverrides: any = {};
        if (baseFeeOverride.trim() !== "") customOverrides.baseFeeMonthly = Number(baseFeeOverride);
        if (smsRateOverride.trim() !== "") customOverrides.sms = Number(smsRateOverride);
        if (rcsRateOverride.trim() !== "") customOverrides.rcs = Number(rcsRateOverride);
        if (waRateOverride.trim() !== "") customOverrides.whatsapp = Number(waRateOverride);

        const res = await calculateCustomPricingImpactAction({
          workspaceId: selectedWsId,
          proposedPlanId: selectedPlanId,
          customOverrides: Object.keys(customOverrides).length > 0 ? customOverrides : undefined,
          discountPct: Number(discountPct || 0),
        });

        if (res.success && res.data) {
          setImpact(res.data);
        }
      } catch (err) {
        console.error("Live calculation failed:", err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedWsId, selectedPlanId, baseFeeOverride, smsRateOverride, rcsRateOverride, waRateOverride, discountPct]);

  // Handle Save Pricing
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changeReason.trim().length < 10) {
      toast({
        title: "Justification Required",
        description: "Please provide a reason of at least 10 characters for audit logging.",
        variant: "destructive",
      });
      return;
    }

    setSavingPricing(true);
    try {
      const customOverrides: any = {};
      if (baseFeeOverride.trim() !== "") customOverrides.baseFeeMonthly = Number(baseFeeOverride);
      if (smsRateOverride.trim() !== "") customOverrides.sms = Number(smsRateOverride);
      if (rcsRateOverride.trim() !== "") customOverrides.rcs = Number(rcsRateOverride);
      if (waRateOverride.trim() !== "") customOverrides.whatsapp = Number(waRateOverride);

      const res = await updateWorkspacePricingAction({
        workspaceId: selectedWsId,
        planId: selectedPlanId,
        customOverrides: Object.keys(customOverrides).length > 0 ? customOverrides : undefined,
        discountPct: Number(discountPct || 0),
        discountReason: changeReason.trim(),
        discountEndDate: discountEndDate ? new Date(discountEndDate).toISOString() : null,
        reason: changeReason.trim(),
      });

      if (!res.success) {
        throw new Error(res.error);
      }

      if (res.data?.requiresApproval) {
        toast({
          title: "Approval Request Submitted",
          description: `Change Request #${res.data.changeRequestId} created for Sales Ops approval.`,
        });
      } else {
        toast({
          title: "Pricing Updated Immediately",
          description: "Workspace rate card and subscription terms updated successfully.",
        });
      }

      setChangeReason("");
      fetchPricingDetails(selectedWsId);
    } catch (err: any) {
      toast({
        title: "Pricing Update Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingPricing(false);
    }
  };

  // Handle Attach Add-on
  const handleAttachAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddonId) return;

    setAttachingAddon(true);
    try {
      const res = await attachWorkspaceAddonAction({
        workspaceId: selectedWsId,
        addonId: selectedAddonId,
        quantity: Number(addonQty || 1),
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Add-on Attached",
        description: `Successfully attached add-on to ${data?.workspaceName}.`,
      });

      setShowAttachAddonModal(false);
      fetchPricingDetails(selectedWsId);
    } catch (err: any) {
      toast({
        title: "Failed to Attach Add-on",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setAttachingAddon(false);
    }
  };

  // Handle Cancel Add-on
  const handleCancelAddon = async () => {
    if (!cancellingAddonId) return;
    if (cancelReason.trim().length < 10) {
      toast({
        title: "Justification Required",
        description: "Please enter a cancellation reason of at least 10 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsCancelling(true);
    try {
      const res = await cancelWorkspaceAddonAction({
        workspaceAddonId: cancellingAddonId,
        reason: cancelReason.trim(),
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Add-on Cancelled",
        description: "Add-on scheduled for cancellation at the end of the current billing cycle.",
      });

      setCancellingAddonId(null);
      setCancelReason("");
      fetchPricingDetails(selectedWsId);
    } catch (err: any) {
      toast({
        title: "Cancellation Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle Seat Correction
  const handleSeatCorrection = async (actionType: "true_up_billing" | "deprovision_inactive") => {
    setReconcilingSeats(true);
    try {
      const res = await createSeatCorrectionRequestAction({
        workspaceId: selectedWsId,
        actionType,
        reason:
          actionType === "true_up_billing"
            ? "Automated one-click true-up of additional seat licenses to reconcile provisioned user count."
            : "Correction request to review and de-provision inactive workspace seats.",
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Seat Correction Processed",
        description: res.data?.message || "Seat reconciliation request processed.",
      });

      fetchPricingDetails(selectedWsId);
    } catch (err: any) {
      toast({
        title: "Correction Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setReconcilingSeats(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-border bg-surface p-12 text-center text-xs text-text-muted">
        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[#7C7CFF]" />
        Loading workspace pricing and seat license details...
      </div>
    );
  }

  if (!data) return null;

  const currentPlan = availablePlans.find((p) => p.id === selectedPlanId) || data.plan;
  const isPostpaid = data.billingModel === "postpaid";
  const recon = data.seatReconciliation;

  return (
    <div className="space-y-6">
      {/* Workspace Selector Strip */}
      <div className="rounded-lg border border-border bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-[#7C7CFF]/30 bg-[#7C7CFF]/10 p-2 text-[#7C7CFF]">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              Workspace Contract &amp; Pricing
            </h3>
            <p className="text-[11px] text-text-muted">
              Configure per-workspace rate overrides, discounts, and modular add-on packs.
            </p>
          </div>
        </div>

        {/* Workspace Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted whitespace-nowrap">Active Workspace:</label>
          <select
            value={selectedWsId}
            onChange={(e) => setSelectedWsId(e.target.value)}
            className="rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.billingModel})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SEAT RECONCILIATION CARD (Single Source of Truth) */}
      <SeatReconcileCard
        recon={recon}
        onTrueUp={() => handleSeatCorrection("true_up_billing")}
        onDeprovision={() => handleSeatCorrection("deprovision_inactive")}
        isProcessing={reconcilingSeats}
      />

      {/* Main Grid: Custom Pricing Editor (Left) & Active Add-ons (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: PRICING EDITOR */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text">
                  Commercial Rate Card &amp; Discount Editor
                </h4>
                <p className="text-[11px] text-text-muted">
                  Overrides apply directly to {data.workspaceName}. Base rates below floors trigger approval.
                </p>
              </div>
              <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-muted uppercase">
                {isPostpaid ? "Postpaid Credit" : "Prepaid Wallet"}
              </span>
            </div>

            <form onSubmit={handleSavePricing} className="space-y-4 text-xs">
              {/* Plan Selection & Base Fee */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-text-muted">Subscribed Plan</label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  >
                    {availablePlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatINR(p.baseFeeMonthly)}/mo)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-text-muted">
                    Base Fee Override (INR)
                  </label>
                  <input
                    type="number"
                    placeholder={`List: ₹${currentPlan.baseFeeMonthly}`}
                    value={baseFeeOverride}
                    onChange={(e) => setBaseFeeOverride(e.target.value)}
                    className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  />
                </div>
              </div>

              {/* Per-Channel Rate Card Overrides */}
              <div className="rounded border border-border/80 bg-surface-2/40 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-semibold text-text tracking-wider">
                    Per-Message Custom Tariffs
                  </span>
                  <span className="text-[10px] text-text-muted">Leave empty to use plan standard</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* SMS */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-[#7C7CFF]">SMS (DLT)</span>
                      <span className="text-text-muted font-mono">List: ₹{currentPlan.perMessageRates.sms}</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`₹${currentPlan.perMessageRates.sms}`}
                      value={smsRateOverride}
                      onChange={(e) => setSmsRateOverride(e.target.value)}
                      className="w-full rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                    />
                    <span className="text-[9px] text-text-muted block">
                      Floor: <span className="font-mono text-warning">₹{currentPlan.priceFloors.sms}</span>
                    </span>
                  </div>

                  {/* RCS */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-success">RCS Rich</span>
                      <span className="text-text-muted font-mono">List: ₹{currentPlan.perMessageRates.rcs}</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`₹${currentPlan.perMessageRates.rcs}`}
                      value={rcsRateOverride}
                      onChange={(e) => setRcsRateOverride(e.target.value)}
                      className="w-full rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                    />
                    <span className="text-[9px] text-text-muted block">
                      Floor: <span className="font-mono text-warning">₹{currentPlan.priceFloors.rcs}</span>
                    </span>
                  </div>

                  {/* WhatsApp */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-info">WhatsApp</span>
                      <span className="text-text-muted font-mono">List: ₹{currentPlan.perMessageRates.whatsapp}</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`₹${currentPlan.perMessageRates.whatsapp}`}
                      value={waRateOverride}
                      onChange={(e) => setWaRateOverride(e.target.value)}
                      className="w-full rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                    />
                    <span className="text-[9px] text-text-muted block">
                      Floor: <span className="font-mono text-warning">₹{currentPlan.priceFloors.whatsapp}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Commercial Discount & End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-text-muted">Contract Discount (%)</label>
                    <span className="text-[10px] text-text-muted">&gt;15% triggers approval</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-text-muted">Discount End Date</label>
                  <input
                    type="date"
                    value={discountEndDate}
                    onChange={(e) => setDiscountEndDate(e.target.value)}
                    className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  />
                </div>
              </div>

              {/* LIVE EFFECTIVE PRICE TABLE */}
              {impact && (
                <div className="rounded border border-border bg-surface-2/30 p-3 space-y-2">
                  <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                    Live Effective Price Breakdown
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border text-[10px] uppercase text-text-muted">
                        <tr>
                          <th className="py-1">Channel</th>
                          <th className="py-1">List Price</th>
                          <th className="py-1">Custom Rate</th>
                          <th className="py-1">Effective Rate</th>
                          <th className="py-1">Effective Discount</th>
                          <th className="py-1 text-right">Floor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        <tr>
                          <td className="py-1.5 font-sans font-medium text-[#7C7CFF]">SMS (DLT)</td>
                          <td className="py-1.5 text-text-muted">₹{impact.table.sms.list.toFixed(2)}</td>
                          <td className="py-1.5 text-text">₹{impact.table.sms.custom.toFixed(2)}</td>
                          <td className="py-1.5 font-bold text-text">₹{impact.table.sms.effective.toFixed(2)}</td>
                          <td className="py-1.5 text-success">
                            {impact.table.sms.discountPct > 0 ? `-${impact.table.sms.discountPct}%` : "0%"}
                          </td>
                          <td className="py-1.5 text-right">
                            <span className={impact.table.sms.isBelowFloor ? "text-danger font-bold" : "text-text-muted"}>
                              ₹{impact.table.sms.floor.toFixed(2)}
                              {impact.table.sms.isBelowFloor && " ⚠"}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 font-sans font-medium text-success">RCS Rich</td>
                          <td className="py-1.5 text-text-muted">₹{impact.table.rcs.list.toFixed(2)}</td>
                          <td className="py-1.5 text-text">₹{impact.table.rcs.custom.toFixed(2)}</td>
                          <td className="py-1.5 font-bold text-text">₹{impact.table.rcs.effective.toFixed(2)}</td>
                          <td className="py-1.5 text-success">
                            {impact.table.rcs.discountPct > 0 ? `-${impact.table.rcs.discountPct}%` : "0%"}
                          </td>
                          <td className="py-1.5 text-right">
                            <span className={impact.table.rcs.isBelowFloor ? "text-danger font-bold" : "text-text-muted"}>
                              ₹{impact.table.rcs.floor.toFixed(2)}
                              {impact.table.rcs.isBelowFloor && " ⚠"}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 font-sans font-medium text-info">WhatsApp</td>
                          <td className="py-1.5 text-text-muted">₹{impact.table.whatsapp.list.toFixed(2)}</td>
                          <td className="py-1.5 text-text">₹{impact.table.whatsapp.custom.toFixed(2)}</td>
                          <td className="py-1.5 font-bold text-text">₹{impact.table.whatsapp.effective.toFixed(2)}</td>
                          <td className="py-1.5 text-success">
                            {impact.table.whatsapp.discountPct > 0 ? `-${impact.table.whatsapp.discountPct}%` : "0%"}
                          </td>
                          <td className="py-1.5 text-right">
                            <span className={impact.table.whatsapp.isBelowFloor ? "text-danger font-bold" : "text-text-muted"}>
                              ₹{impact.table.whatsapp.floor.toFixed(2)}
                              {impact.table.whatsapp.isBelowFloor && " ⚠"}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 30-Day Monthly Bill Impact Callout */}
                  <div className="mt-2 rounded bg-surface p-2.5 border border-border flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-text-muted">
                        30-Day Usage Impact ({data.usage30d.totalMessages.toLocaleString("en-IN")} msgs)
                      </span>
                      <div className="font-sans text-xs text-text mt-0.5">
                        {impact.deltaINR <= 0 ? (
                          <span className="text-success font-medium">
                            At current usage this changes the monthly bill by{" "}
                            <span className="font-mono font-bold">-₹{Math.abs(impact.deltaINR).toLocaleString("en-IN")}</span> ({impact.deltaPct}%)
                          </span>
                        ) : (
                          <span className="text-warning font-medium">
                            At current usage this increases the monthly bill by{" "}
                            <span className="font-mono font-bold">+₹{impact.deltaINR.toLocaleString("en-IN")}</span> (+{impact.deltaPct}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <div className="text-text-muted">Est: {formatINR(impact.proposedSpend)}/mo</div>
                    </div>
                  </div>
                </div>
              )}

              {/* LIVE POLICY NOTICE BANNER */}
              {impact?.requiresApproval && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 flex items-start gap-2.5 text-xs text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                  <div>
                    <span className="font-semibold">{impact.approvalNotice}</span>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Submission will generate a maker-checker change request in the Approvals queue.
                    </p>
                  </div>
                </div>
              )}

              {/* Mandatory Reason */}
              <div>
                <label className="text-[11px] font-medium text-text">
                  Commercial Pricing Justification <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g., Annual enterprise contract renewal with committed 5M monthly volume."
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingPricing || changeReason.trim().length < 10}
                  className={`rounded px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-40 flex items-center gap-1.5 ${
                    impact?.requiresApproval
                      ? "bg-warning hover:bg-warning/90 text-black font-bold"
                      : "bg-[#7C7CFF] hover:bg-[#6868F7]"
                  }`}
                >
                  {savingPricing ? (
                    "Processing..."
                  ) : impact?.requiresApproval ? (
                    <>
                      <Shield className="h-3.5 w-3.5" />
                      <span>Request Approval</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Apply Immediately</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE ADD-ONS & ATTACH MODAL */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text">
                  Active Workspace Add-ons
                </h4>
                <p className="text-[11px] text-text-muted">
                  Attached modular capacity and license packs
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAttachAddonModal(true)}
                className="inline-flex items-center gap-1 rounded bg-[#7C7CFF] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#6868F7] transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>Attach Add-on</span>
              </button>
            </div>

            {data.activeAddons.length === 0 ? (
              <div className="rounded border border-border/60 bg-surface-2/40 p-6 text-center text-xs text-text-muted">
                No add-ons currently attached to this workspace.
              </div>
            ) : (
              <div className="space-y-2">
                {data.activeAddons.map((addon) => {
                  const isRecurring = addon.type === "recurring";
                  return (
                    <div
                      key={addon.id}
                      className="rounded border border-border bg-surface-2/50 p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text">{addon.name}</span>
                          <span
                            className={`text-[9px] font-mono uppercase px-1 py-0.2 rounded ${
                              isRecurring ? "text-[#7C7CFF] bg-[#7C7CFF]/10" : "text-warning bg-warning/10"
                            }`}
                          >
                            {isRecurring ? "Recurring" : "One-Time"}
                          </span>
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5 flex items-center gap-2 font-mono">
                          <span>Qty: {addon.quantity}</span>
                          <span>•</span>
                          <span>Unit: {formatINR(addon.unitPrice)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-text">
                            {formatINR(addon.monthlyTotal)}
                          </div>
                          <span className="text-[9px] text-text-muted">
                            {isRecurring ? "/month" : "flat"}
                          </span>
                        </div>

                        {isRecurring && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancellingAddonId(addon.id);
                              setCancelReason("");
                            }}
                            className="rounded p-1 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Cancel recurring add-on at cycle end"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Total Monthly Add-on Spend */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-semibold">
                  <span className="text-text-muted">Total Monthly Add-on Spend:</span>
                  <span className="font-mono text-text">
                    {formatINR(
                      data.activeAddons
                        .filter((a) => a.type === "recurring")
                        .reduce((acc, a) => acc + a.monthlyTotal, 0)
                    )}
                    /mo
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: ATTACH ADD-ON */}
      {showAttachAddonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-5 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text">Attach Catalog Add-on</h3>
                <p className="text-xs text-text-muted">Add modular seats or throughput packs</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAttachAddonModal(false)}
                className="text-text-muted hover:text-text text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAttachAddon} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-medium text-text-muted">Select Add-on</label>
                <select
                  value={selectedAddonId}
                  onChange={(e) => setSelectedAddonId(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                >
                  {addonsCatalog.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatINR(a.price)} {a.type === "recurring" ? "/mo" : "flat"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text-muted">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={addonQty}
                  onChange={(e) => setAddonQty(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />
              </div>

              {/* Charge Mechanism Notice */}
              {(() => {
                const selected = addonsCatalog.find((a) => a.id === selectedAddonId);
                const cost = selected ? selected.price * addonQty : 0;
                return (
                  <div className="rounded border border-border bg-surface-2 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-text">
                      <span>Total Charge:</span>
                      <span className="font-mono text-sm">{formatINR(cost)}</span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      {selected?.type === "one_time"
                        ? isPostpaid
                          ? "One-time charge will be appended as an invoice line item on the current billing cycle."
                          : "One-time charge will be immediately debited from the prepaid wallet ledger."
                        : selected?.id === "addon_seat"
                        ? `Adding ${addonQty} Additional Seat license(s) directly increments paid seats in seat reconciliation.`
                        : "Monthly recurring line item billed at the start of each monthly billing cycle."}
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAttachAddonModal(false)}
                  className="rounded px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={attachingAddon}
                  className="rounded bg-[#7C7CFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7] transition-colors disabled:opacity-40"
                >
                  {attachingAddon ? "Attaching..." : "Confirm & Attach"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL ADD-ON */}
      {cancellingAddonId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-2xl p-5 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text">Cancel Recurring Add-on</h3>
                <p className="text-xs text-text-muted">
                  Cancellation will take effect at the end of the current billing cycle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancellingAddonId(null)}
                className="text-text-muted hover:text-text text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-text">
                  Cancellation Reason <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Customer requested downgrade of throughput burst capacity."
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingAddonId(null)}
                  className="rounded px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text"
                >
                  Keep Add-on
                </button>
                <button
                  type="button"
                  onClick={handleCancelAddon}
                  disabled={isCancelling || cancelReason.trim().length < 10}
                  className="rounded bg-danger px-4 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 transition-colors disabled:opacity-40"
                >
                  {isCancelling ? "Processing..." : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Reusable Seat Reconciliation Card (Rendered on Plan tab and Users tab)
 */
export function SeatReconcileCard({
  recon,
  onTrueUp,
  onDeprovision,
  isProcessing,
}: {
  recon: {
    seatsBilled: number;
    seatsProvisioned: number;
    seatsActive: number;
    seatWasteCount: number;
    seatWasteMonthlyINR: number;
    mismatchDetected: boolean;
    mismatchType: "over_provisioned" | "under_utilized" | "in_sync";
    mismatchMessage: string;
  };
  onTrueUp: () => void;
  onDeprovision: () => void;
  isProcessing?: boolean;
}) {
  const isOver = recon.mismatchType === "over_provisioned";
  const isUnder = recon.mismatchType === "under_utilized";

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isOver
          ? "border-danger/40 bg-danger/5"
          : isUnder
          ? "border-warning/40 bg-warning/5"
          : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text">
              Seat License Reconciliation
            </h4>
            {recon.mismatchDetected ? (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase font-semibold ${
                  isOver ? "bg-danger/20 text-danger" : "bg-warning/20 text-warning"
                }`}
              >
                Mismatch Detected
              </span>
            ) : (
              <span className="rounded bg-success/20 text-success px-1.5 py-0.5 text-[10px] font-mono uppercase font-semibold">
                In Sync
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted">{recon.mismatchMessage}</p>
        </div>

        {/* 3 Metric Pills */}
        <div className="flex items-center gap-2 font-mono text-center text-xs">
          <div className="rounded border border-border bg-surface-2 px-3 py-1.5">
            <span className="text-[10px] uppercase text-text-muted block font-sans">Billed Seats</span>
            <span className="font-bold text-text text-sm">{recon.seatsBilled}</span>
          </div>

          <div className="rounded border border-border bg-surface-2 px-3 py-1.5">
            <span className="text-[10px] uppercase text-text-muted block font-sans">Provisioned</span>
            <span
              className={`font-bold text-sm ${
                isOver ? "text-danger" : isUnder ? "text-warning" : "text-text"
              }`}
            >
              {recon.seatsProvisioned}
            </span>
          </div>

          <div className="rounded border border-border bg-surface-2 px-3 py-1.5">
            <span className="text-[10px] uppercase text-text-muted block font-sans">Active (30d)</span>
            <span className="font-bold text-success text-sm">{recon.seatsActive}</span>
          </div>

          {recon.seatWasteCount > 0 && (
            <div className="rounded border border-warning/30 bg-warning/10 px-3 py-1.5 text-warning">
              <span className="text-[10px] uppercase block font-sans font-medium">Ghost Waste</span>
              <span className="font-bold text-sm">{formatINR(recon.seatWasteMonthlyINR)}/mo</span>
            </div>
          )}
        </div>
      </div>

      {/* One-Click Action when Mismatch Detected */}
      {recon.mismatchDetected && (
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
          <div className="text-[11px] text-text-muted">
            {isOver
              ? "Users provisioned exceed paid seat licenses. True up billing to prevent revenue leakage."
              : "Paid seat licenses exceed provisioned users. Review inactive user accounts to eliminate license waste."}
          </div>

          <div className="flex items-center gap-2">
            {isOver ? (
              <button
                type="button"
                onClick={onTrueUp}
                disabled={isProcessing}
                className="rounded bg-danger px-3 py-1 text-xs font-semibold text-white hover:bg-danger/90 transition-colors disabled:opacity-40"
              >
                {isProcessing ? "Processing..." : "True-up Billing Add-on (+1 Click)"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onDeprovision}
                disabled={isProcessing}
                className="rounded border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning hover:bg-warning/20 transition-colors disabled:opacity-40"
              >
                {isProcessing ? "Processing..." : "Create Deprovisioning Request"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
