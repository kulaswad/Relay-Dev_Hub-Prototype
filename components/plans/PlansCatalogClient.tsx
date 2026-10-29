"use client";

import React, { useState } from "react";
import { PlanCatalogItem } from "@/lib/services/plans";
import { useRole } from "@/components/layout/RoleContext";
import { formatINR } from "@/lib/utils";
import {
  Sliders,
  Check,
  Shield,
  Layers,
  Sparkles,
  Zap,
  Users,
  Edit2,
  AlertTriangle,
  Info,
  DollarSign,
  Package,
  Plus,
} from "lucide-react";
import { updatePlanCatalogAction } from "@/app/actions/plans";
import { toast } from "@/components/ui/Toaster";

interface PlansCatalogClientProps {
  initialPlans: PlanCatalogItem[];
  addonsCatalog: Array<{
    id: string;
    name: string;
    type: string;
    price: number;
  }>;
}

export function PlansCatalogClient({ initialPlans, addonsCatalog }: PlansCatalogClientProps) {
  const { currentRole } = useRole();
  const [plansList, setPlansList] = useState<PlanCatalogItem[]>(initialPlans);
  const [editingPlan, setEditingPlan] = useState<PlanCatalogItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for editing
  const [editForm, setEditForm] = useState<{
    baseFeeMonthly: number;
    includedSeats: number;
    throughputMps: number;
    billingModel: "prepaid" | "postpaid" | "both";
    smsRate: number;
    rcsRate: number;
    whatsappRate: number;
    smsFloor: number;
    rcsFloor: number;
    whatsappFloor: number;
    reason: string;
  }>({
    baseFeeMonthly: 0,
    includedSeats: 3,
    throughputMps: 50,
    billingModel: "both",
    smsRate: 0.14,
    rcsRate: 0.22,
    whatsappRate: 0.38,
    smsFloor: 0.11,
    rcsFloor: 0.18,
    whatsappFloor: 0.3,
    reason: "",
  });

  const canEditCatalog = currentRole === "admin" || currentRole === "sales_ops";

  const totalSubscribedWorkspaces = plansList.reduce((acc, p) => acc + p.workspaceCount, 0);

  const openEditModal = (p: PlanCatalogItem) => {
    setEditingPlan(p);
    setEditForm({
      baseFeeMonthly: p.baseFeeMonthly,
      includedSeats: p.includedSeats,
      throughputMps: p.throughputMps,
      billingModel: p.billingModel,
      smsRate: p.perMessageRates.sms,
      rcsRate: p.perMessageRates.rcs,
      whatsappRate: p.perMessageRates.whatsapp,
      smsFloor: p.priceFloors.sms,
      rcsFloor: p.priceFloors.rcs,
      whatsappFloor: p.priceFloors.whatsapp,
      reason: "",
    });
  };

  const handleSaveCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    if (editForm.reason.trim().length < 10) {
      toast({
        title: "Justification Required",
        description: "Please provide a reason of at least 10 characters for auditing.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updatePlanCatalogAction({
        planId: editingPlan.id,
        baseFeeMonthly: Number(editForm.baseFeeMonthly),
        includedSeats: Number(editForm.includedSeats),
        throughputMps: Number(editForm.throughputMps),
        billingModel: editForm.billingModel,
        perMessageRates: {
          sms: Number(editForm.smsRate),
          rcs: Number(editForm.rcsRate),
          whatsapp: Number(editForm.whatsappRate),
        },
        priceFloors: {
          sms: Number(editForm.smsFloor),
          rcs: Number(editForm.rcsFloor),
          whatsapp: Number(editForm.whatsappFloor),
        },
        reason: editForm.reason.trim(),
      });

      if (!res.success) {
        throw new Error(res.error);
      }

      toast({
        title: "Plan Catalog Updated",
        description: `Successfully updated standard terms for ${editingPlan.name}.`,
      });

      // Update local state
      setPlansList((prev) =>
        prev.map((p) =>
          p.id === editingPlan.id
            ? {
                ...p,
                baseFeeMonthly: Number(editForm.baseFeeMonthly),
                includedSeats: Number(editForm.includedSeats),
                throughputMps: Number(editForm.throughputMps),
                billingModel: editForm.billingModel,
                perMessageRates: {
                  sms: Number(editForm.smsRate),
                  rcs: Number(editForm.rcsRate),
                  whatsapp: Number(editForm.whatsappRate),
                },
                priceFloors: {
                  sms: Number(editForm.smsFloor),
                  rcs: Number(editForm.rcsFloor),
                  whatsapp: Number(editForm.whatsappFloor),
                },
              }
            : p
        )
      );

      setEditingPlan(null);
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text">Plans &amp; Add-ons Catalog</h1>
            <span className="rounded-md border border-[#7C7CFF]/30 bg-[#7C7CFF]/10 px-2 py-0.5 text-[11px] font-mono text-[#7C7CFF]">
              v2.4
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Commercial pricing tiers, base subscription fees, per-channel message rate cards, and regulatory price floors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-muted">
            Active Role: <span className="font-mono text-text font-semibold capitalize">{currentRole.replace("_", " ")}</span>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <span className="text-[11px] text-text-muted uppercase font-medium">Standard Tiers</span>
          <div className="mt-1 font-mono text-2xl font-bold text-text">{plansList.length}</div>
          <span className="text-[11px] text-text-muted">Starter to Enterprise</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <span className="text-[11px] text-text-muted uppercase font-medium">Active Subscribed Workspaces</span>
          <div className="mt-1 font-mono text-2xl font-bold text-[#7C7CFF]">{totalSubscribedWorkspaces}</div>
          <span className="text-[11px] text-text-muted">Across all accounts</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <span className="text-[11px] text-text-muted uppercase font-medium">Lowest Floor Rate</span>
          <div className="mt-1 font-mono text-2xl font-bold text-success">₹0.06</div>
          <span className="text-[11px] text-text-muted">Enterprise SMS threshold</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <span className="text-[11px] text-text-muted uppercase font-medium">Catalog Add-ons</span>
          <div className="mt-1 font-mono text-2xl font-bold text-text">{addonsCatalog.length}</div>
          <span className="text-[11px] text-text-muted">Recurring &amp; one-time</span>
        </div>
      </div>

      {/* Plans Catalog Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text">Standard Plan Tiers</h2>
            <p className="text-xs text-text-muted">Standard rate cards and wholesale commitments</p>
          </div>
          {!canEditCatalog && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted italic">
              <Shield className="h-3 w-3" />
              <span>Editing catalog requires Admin or Sales Ops role</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plansList.map((plan) => {
            const isScaleOrEnterprise = plan.id === "plan_scale" || plan.id === "plan_enterprise";
            return (
              <div
                key={plan.id}
                className={`flex flex-col justify-between rounded-lg border bg-surface transition-all ${
                  isScaleOrEnterprise ? "border-[#7C7CFF]/40 shadow-sm" : "border-border"
                }`}
              >
                {/* Header */}
                <div className="p-5 border-b border-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-text">{plan.name}</span>
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-muted">
                      {plan.workspaceCount} ws
                    </span>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-2xl font-bold text-text">
                        {formatINR(plan.baseFeeMonthly)}
                      </span>
                      <span className="text-xs text-text-muted">/month</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-block rounded bg-surface-2 px-2 py-0.5 text-[10px] font-mono uppercase text-text-muted">
                        {plan.billingModel === "both"
                          ? "Prepaid / Postpaid"
                          : `${plan.billingModel} only`}
                      </span>
                    </div>
                  </div>

                  {/* Core Limits */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
                    <div>
                      <span className="text-[10px] uppercase text-text-muted">Included Seats</span>
                      <div className="font-mono font-semibold text-text">{plan.includedSeats} seats</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-text-muted">Throughput</span>
                      <div className="font-mono font-semibold text-text">{plan.throughputMps} MPS</div>
                    </div>
                  </div>
                </div>

                {/* Rates & Floors Table */}
                <div className="p-5 space-y-4 flex-1">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                      Channel Tariffs &amp; Floor Rules
                    </span>
                    <div className="mt-2 space-y-2 text-xs">
                      {/* SMS */}
                      <div className="flex items-center justify-between rounded bg-surface-2/60 p-2 border border-border/40">
                        <div>
                          <div className="font-medium text-text">SMS (DLT)</div>
                          <span className="text-[10px] text-text-muted">
                            Floor: <span className="font-mono text-warning">₹{plan.priceFloors.sms.toFixed(2)}</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-text">
                            ₹{plan.perMessageRates.sms.toFixed(2)}
                          </div>
                          <span className="text-[9px] text-text-muted">/msg</span>
                        </div>
                      </div>

                      {/* RCS */}
                      <div className="flex items-center justify-between rounded bg-surface-2/60 p-2 border border-border/40">
                        <div>
                          <div className="font-medium text-text">RCS Rich</div>
                          <span className="text-[10px] text-text-muted">
                            Floor: <span className="font-mono text-warning">₹{plan.priceFloors.rcs.toFixed(2)}</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-text">
                            ₹{plan.perMessageRates.rcs.toFixed(2)}
                          </div>
                          <span className="text-[9px] text-text-muted">/event</span>
                        </div>
                      </div>

                      {/* WhatsApp */}
                      <div className="flex items-center justify-between rounded bg-surface-2/60 p-2 border border-border/40">
                        <div>
                          <div className="font-medium text-text">WhatsApp</div>
                          <span className="text-[10px] text-text-muted">
                            Floor: <span className="font-mono text-warning">₹{plan.priceFloors.whatsapp.toFixed(2)}</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-text">
                            ₹{plan.perMessageRates.whatsapp.toFixed(2)}
                          </div>
                          <span className="text-[9px] text-text-muted">/conv</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Feature Highlights */}
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                      Included Capabilities
                    </span>
                    <ul className="mt-2 space-y-1.5 text-xs text-text-muted">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                          <span className="leading-tight text-[11px] text-text">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-border/60 bg-surface-2/30">
                  <button
                    type="button"
                    onClick={() => openEditModal(plan)}
                    disabled={!canEditCatalog}
                    className="w-full flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-text-muted" />
                    <span>Edit Catalog Entry</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add-ons Catalog Shelf */}
      <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text">
              Modular Add-ons Catalog
            </h3>
            <p className="text-xs text-text-muted">
              Add-ons can be attached directly to any customer workspace from the Account 360 Plan tab.
            </p>
          </div>
          <span className="font-mono text-xs text-[#7C7CFF] bg-[#7C7CFF]/10 px-2 py-0.5 rounded border border-[#7C7CFF]/20">
            {addonsCatalog.length} catalog offerings
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {addonsCatalog.map((addon) => {
            const isRecurring = addon.type === "recurring";
            return (
              <div
                key={addon.id}
                className="rounded-md border border-border bg-surface-2 p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        isRecurring
                          ? "bg-[#7C7CFF]/10 text-[#7C7CFF] border border-[#7C7CFF]/20"
                          : "bg-warning/10 text-warning border border-warning/20"
                      }`}
                    >
                      {isRecurring ? "Monthly Recurring" : "One-Time Charge"}
                    </span>
                    <span className="font-mono text-[10px] text-text-muted">#{addon.id}</span>
                  </div>

                  <h4 className="mt-2 text-sm font-semibold text-text">{addon.name}</h4>
                  <p className="text-[11px] text-text-muted mt-1">
                    {addon.id === "addon_seat"
                      ? "Increases workspace paid seat license count. Used for billing & seat reconciliation."
                      : addon.id === "addon_extra_tps_50"
                      ? "Expands gateway burst capacity by 50 messages per second."
                      : addon.id === "addon_dedicated_number"
                      ? "Exclusive long-code / 10DLC virtual number for high-deliverability SMS."
                      : "Enterprise SLA support with 15-minute response time."}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-base font-bold text-text">
                      {formatINR(addon.price)}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {isRecurring ? " /mo" : " flat"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Catalog Entry Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-lg border border-border bg-surface shadow-2xl p-6 space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-text">Edit Plan: {editingPlan.name}</h3>
                <p className="text-xs text-text-muted">
                  Update default catalog terms, per-message rates, and approval floor limits.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="text-text-muted hover:text-text text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCatalog} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-text-muted">Monthly Base Fee (INR)</label>
                  <input
                    type="number"
                    value={editForm.baseFeeMonthly}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, baseFeeMonthly: Number(e.target.value) }))
                    }
                    className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-text text-xs focus:outline-none focus:border-[#7C7CFF]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-text-muted">Included Seats</label>
                  <input
                    type="number"
                    value={editForm.includedSeats}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, includedSeats: Number(e.target.value) }))
                    }
                    className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-text text-xs focus:outline-none focus:border-[#7C7CFF]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-text-muted">Throughput (MPS)</label>
                  <input
                    type="number"
                    value={editForm.throughputMps}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, throughputMps: Number(e.target.value) }))
                    }
                    className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-text text-xs focus:outline-none focus:border-[#7C7CFF]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-text-muted">Billing Model Eligibility</label>
                  <select
                    value={editForm.billingModel}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        billingModel: e.target.value as any,
                      }))
                    }
                    className="mt-1 w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-text text-xs focus:outline-none focus:border-[#7C7CFF]"
                  >
                    <option value="both">Both (Prepaid &amp; Postpaid)</option>
                    <option value="prepaid">Prepaid Only</option>
                    <option value="postpaid">Postpaid Only</option>
                  </select>
                </div>
              </div>

              {/* Rates & Floors */}
              <div className="rounded border border-border/80 bg-surface-2/40 p-3 space-y-3">
                <span className="text-[11px] uppercase font-semibold text-text tracking-wider">
                  Channel Rate Cards &amp; Price Floors (INR)
                </span>

                <div className="grid grid-cols-3 gap-3">
                  {/* SMS */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-[#7C7CFF]">SMS (DLT)</span>
                    <label className="block text-[9px] text-text-muted">Standard Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.smsRate}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, smsRate: Number(e.target.value) }))
                      }
                      className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-xs text-text"
                    />
                    <label className="block text-[9px] text-warning mt-1">Floor Threshold</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.smsFloor}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, smsFloor: Number(e.target.value) }))
                      }
                      className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-xs text-warning"
                    />
                  </div>

                  {/* RCS */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-success">RCS Rich</span>
                    <label className="block text-[9px] text-text-muted">Standard Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.rcsRate}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, rcsRate: Number(e.target.value) }))
                      }
                      className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-xs text-text"
                    />
                    <label className="block text-[9px] text-warning mt-1">Floor Threshold</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.rcsFloor}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, rcsFloor: Number(e.target.value) }))
                      }
                      className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-xs text-warning"
                    />
                  </div>

                  {/* WhatsApp */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-info">WhatsApp</span>
                    <label className="block text-[9px] text-text-muted">Standard Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.whatsappRate}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, whatsappRate: Number(e.target.value) }))
                      }
                      className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-xs text-text"
                    />
                    <label className="block text-[9px] text-warning mt-1">Floor Threshold</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.whatsappFloor}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, whatsappFloor: Number(e.target.value) }))
                      }
                      className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-xs text-warning"
                    />
                  </div>
                </div>
              </div>

              {/* Mandatory Reason */}
              <div>
                <label className="text-[11px] font-medium text-text">
                  Catalog Change Reason <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={2}
                  value={editForm.reason}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g., Annual telecom carrier tariff adjustment or product marketing revamps."
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2.5 text-xs text-text focus:outline-none focus:border-[#7C7CFF]"
                  required
                />
                <span className="text-[10px] text-text-muted">
                  Minimum 10 characters required for audit trail.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="rounded px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || editForm.reason.trim().length < 10}
                  className="rounded bg-[#7C7CFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6868F7] transition-colors disabled:opacity-40"
                >
                  {isSubmitting ? "Saving..." : "Save Catalog Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
