"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Layers,
  Sliders,
  UserCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Plus,
  Trash2,
  ShieldAlert,
  Info,
} from "lucide-react";
import { ActiveUser } from "@/components/layout/RoleContext";
import { createAndOnboardAccountAction } from "@/app/actions/lifecycle";
import { validateGSTIN, INDIAN_STATE_GST_CODES } from "@/lib/validation/gstin";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

export interface OnboardingWizardProps {
  currentUser: ActiveUser;
  availablePlans: Array<{
    id: string;
    name: string;
    billingModel: string;
    baseFeeMonthly: number;
    includedSeats: number;
    throughputMps: number;
  }>;
}

export function OnboardingWizard({ currentUser, availablePlans }: OnboardingWizardProps) {
  const router = useRouter();

  // Wizard Step (1 to 5)
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Org Details
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [industry, setIndustry] = useState<string>("BFSI");
  const [city, setCity] = useState("Mumbai");
  const [billingModel, setBillingModel] = useState<"prepaid" | "postpaid">("postpaid");

  // Step 2: Workspaces
  const [workspacesList, setWorkspacesList] = useState<
    Array<{ name: string; gstin: string; billingState: string }>
  >([
    {
      name: "Primary Operations",
      gstin: "27AABCM1234F1Z5",
      billingState: "Maharashtra",
    },
  ]);

  // Step 3: Plan & Pricing
  const [planId, setPlanId] = useState<string>(availablePlans[0]?.id || "plan_growth");
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>("");

  // Step 4: Owner User
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  const selectedPlan = availablePlans.find((p) => p.id === planId) || availablePlans[0];

  // Workspace manipulation
  const handleAddWorkspace = () => {
    setWorkspacesList([
      ...workspacesList,
      {
        name: `Workspace ${workspacesList.length + 1}`,
        gstin: "29AABCP9999K1Z4",
        billingState: "Karnataka",
      },
    ]);
  };

  const handleRemoveWorkspace = (idx: number) => {
    if (workspacesList.length <= 1) return;
    setWorkspacesList(workspacesList.filter((_, i) => i !== idx));
  };

  const handleUpdateWorkspace = (idx: number, field: string, val: string) => {
    const updated = [...workspacesList];
    (updated[idx] as any)[field] = val;
    setWorkspacesList(updated);
  };

  // Step 1 Validation
  const validateStep1 = () => {
    if (!name.trim()) return "Organization Name is required.";
    if (!legalName.trim()) return "Legal Name is required.";
    if (!city.trim()) return "City is required.";
    return null;
  };

  // Step 2 Validation (GSTIN Format & State-Code Match)
  const validateStep2 = () => {
    for (let i = 0; i < workspacesList.length; i++) {
      const ws = workspacesList[i];
      if (!ws.name.trim()) return `Workspace #${i + 1} name is required.`;
      const res = validateGSTIN(ws.gstin, ws.billingState);
      if (!res.valid) {
        return `Workspace #${i + 1} (${ws.name}): ${res.error}`;
      }
    }
    return null;
  };

  // Step 3 Validation
  const validateStep3 = () => {
    if (discountPct > 0 && !discountReason.trim()) {
      return "An audit justification is mandatory when applying a discount.";
    }
    return null;
  };

  // Step 4 Validation
  const validateStep4 = () => {
    if (!ownerName.trim()) return "Owner full name is required.";
    if (!ownerEmail.trim() || !ownerEmail.includes("@")) return "A valid owner email address is required.";
    return null;
  };

  const handleNext = () => {
    setErrorMsg(null);
    let err: string | null = null;
    if (step === 1) err = validateStep1();
    else if (step === 2) err = validateStep2();
    else if (step === 3) err = validateStep3();
    else if (step === 4) err = validateStep4();

    if (err) {
      setErrorMsg(err);
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const handleBack = () => {
    setErrorMsg(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const res = await createAndOnboardAccountAction({
        name,
        legalName,
        industry: industry as any,
        city,
        billingModel,
        workspacesList,
        planId,
        discountPct: discountPct > 0 ? discountPct : undefined,
        discountReason: discountReason || undefined,
        ownerName,
        ownerEmail,
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: "Account Created Successfully",
        description: `${name} onboarded in 'onboarding' status with ${workspacesList.length} workspace(s).`,
        variant: "default",
      });

      router.push(`/accounts/${res.orgId}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create organization");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Wizard Steps Stepper */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: "Organization", icon: Building2 },
            { num: 2, label: "Workspaces", icon: Layers },
            { num: 3, label: "Plan & Pricing", icon: Sliders },
            { num: 4, label: "Owner Invite", icon: UserCheck },
            { num: 5, label: "Review", icon: CheckCircle2 },
          ].map((s, idx) => {
            const Icon = s.icon;
            const isDone = step > s.num;
            const isCurrent = step === s.num;
            return (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-mono font-bold transition-all",
                      isDone
                        ? "bg-success text-white"
                        : isCurrent
                        ? "bg-accent text-white shadow-accent-glow"
                        : "bg-surface-2 text-text-muted border border-border"
                    )}
                  >
                    {isDone ? "✓" : s.num}
                  </div>
                  <span
                    className={cn(
                      "hidden sm:inline text-xs font-medium",
                      isCurrent ? "text-text font-bold" : "text-text-muted"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < 4 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-2",
                      step > s.num ? "bg-success" : "bg-border"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Alert Box */}
      {errorMsg && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: ORGANIZATION DETAILS */}
      {step === 1 && (
        <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-sm font-semibold text-text">Step 1: Organization Details</h2>
            <p className="text-xs text-text-muted">
              Define the corporate entity and default billing framework.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-text font-medium">Organization Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Apex Health Tech"
                className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-text font-medium">Legal Registered Entity Name (MCA)</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value.toUpperCase())}
                placeholder="e.g. APEX HEALTH TECHNOLOGIES INDIA PRIVATE LIMITED"
                className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text font-mono focus:border-accent focus:outline-none uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-text font-medium">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none"
              >
                {["BFSI", "Insurance", "D2C", "Edtech", "Fintech", "Healthcare", "Travel", "Logistics"].map(
                  (ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-text font-medium">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bengaluru"
                className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-text font-medium">Billing Model</label>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setBillingModel("postpaid")}
                  className={cn(
                    "rounded-md border p-3 text-left transition-colors",
                    billingModel === "postpaid"
                      ? "border-accent bg-accent/10 text-text"
                      : "border-border bg-surface-2 text-text-muted hover:text-text"
                  )}
                >
                  <div className="font-semibold text-xs">Postpaid (Credit Limit)</div>
                  <div className="text-[11px] text-text-muted mt-1">
                    Monthly consolidated GST tax invoice with designated credit lines.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingModel("prepaid")}
                  className={cn(
                    "rounded-md border p-3 text-left transition-colors",
                    billingModel === "prepaid"
                      ? "border-accent bg-accent/10 text-text"
                      : "border-border bg-surface-2 text-text-muted hover:text-text"
                  )}
                >
                  <div className="font-semibold text-xs">Prepaid (Wallet Top-Up)</div>
                  <div className="text-[11px] text-text-muted mt-1">
                    Upfront balance deduction per successful message dispatch.
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: WORKSPACES */}
      {step === 2 && (
        <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-text">Step 2: Workspace Provisioning</h2>
              <p className="text-xs text-text-muted">
                Each workspace represents a distinct GST registered entity or operational division.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddWorkspace}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs text-text hover:bg-surface-2/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-accent" />
              <span>Add Workspace</span>
            </button>
          </div>

          <div className="space-y-4">
            {workspacesList.map((ws, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border bg-surface-2 p-4 space-y-3 relative text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text">Workspace #{idx + 1}</span>
                  {workspacesList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveWorkspace(idx)}
                      className="text-danger hover:text-danger/80"
                      title="Remove workspace"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-text-muted">Workspace Name</label>
                    <input
                      type="text"
                      value={ws.name}
                      onChange={(e) => handleUpdateWorkspace(idx, "name", e.target.value)}
                      placeholder="e.g. Retail Lending Hub"
                      className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-text-muted">Billing State</label>
                    <select
                      value={ws.billingState}
                      onChange={(e) => {
                        const newState = e.target.value;
                        const expectedPrefix = INDIAN_STATE_GST_CODES[newState] || "27";
                        const updatedGstin = expectedPrefix + ws.gstin.substring(2);
                        const updated = [...workspacesList];
                        updated[idx].billingState = newState;
                        updated[idx].gstin = updatedGstin;
                        setWorkspacesList(updated);
                      }}
                      className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-accent focus:outline-none"
                    >
                      {Object.keys(INDIAN_STATE_GST_CODES).map((state) => (
                        <option key={state} value={state}>
                          {state} ({INDIAN_STATE_GST_CODES[state]})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-text-muted">Indian GSTIN (15 Alphanumeric)</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={ws.gstin}
                      onChange={(e) => handleUpdateWorkspace(idx, "gstin", e.target.value.toUpperCase())}
                      placeholder="e.g. 27AABCM1234F1Z5"
                      className="w-full rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-text focus:border-accent focus:outline-none uppercase"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: PLAN SELECTION & PRICING */}
      {step === 3 && (
        <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-sm font-semibold text-text">Step 3: Plan Selection & Pricing</h2>
            <p className="text-xs text-text-muted">
              Select the base commercial tier and configure optional contractual discounts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {availablePlans.map((p) => {
              const isSelected = planId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setPlanId(p.id)}
                  className={cn(
                    "cursor-pointer rounded-lg border p-4 transition-all space-y-2",
                    isSelected
                      ? "border-accent bg-accent/10 shadow-sm"
                      : "border-border bg-surface-2 hover:border-border/80"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text text-sm">{p.name}</span>
                    <span className="font-mono font-bold text-accent">
                      ₹{p.baseFeeMonthly.toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {p.includedSeats} included seats • {p.throughputMps} MPS gateway throughput
                  </div>
                </div>
              );
            })}
          </div>

          {/* Discount Section */}
          <div className="rounded-lg border border-border bg-surface-2 p-4 space-y-3 text-xs">
            <span className="font-semibold text-text">Contract Discount (Optional)</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-text-muted">Discount Percentage (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number(e.target.value))}
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-text focus:border-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-text-muted">Discount Justification</label>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="e.g. Annual upfront commitment discount"
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-text focus:border-accent focus:outline-none"
                />
              </div>
            </div>
            {discountPct > 15 && (
              <p className="text-[11px] text-warning flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Discounts &gt; 15% will route through Sales Ops / Admin approval before execution.</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: OWNER INVITE */}
      {step === 4 && (
        <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-sm font-semibold text-text">Step 4: Customer Administrator Invite</h2>
            <p className="text-xs text-text-muted">
              Provision the primary customer organization owner account.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="text-text font-medium">Owner Full Name</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Rajesh Khurana"
                className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-text font-medium">Owner Corporate Email</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="e.g. rajesh@apexhealth.in"
                className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text font-mono focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: REVIEW AND CREATE */}
      {step === 5 && (
        <div className="rounded-lg border border-border bg-surface p-6 space-y-5">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-sm font-semibold text-text">Step 5: Review & Onboard</h2>
            <p className="text-xs text-text-muted">
              Verify account specifications prior to persisting to SQLite database.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="rounded border border-border bg-surface-2 p-3 space-y-1.5">
              <span className="font-semibold text-text uppercase text-[10px] text-text-muted">
                Organization
              </span>
              <div className="text-sm font-bold text-text">{name}</div>
              <div className="font-mono text-[11px] text-text-muted">{legalName}</div>
              <div className="text-text-muted">
                {industry} • {city} • Model: <span className="uppercase font-mono text-accent">{billingModel}</span>
              </div>
            </div>

            <div className="rounded border border-border bg-surface-2 p-3 space-y-1.5">
              <span className="font-semibold text-text uppercase text-[10px] text-text-muted">
                Commercial Plan
              </span>
              <div className="text-sm font-bold text-text">{selectedPlan.name} Plan</div>
              <div className="font-mono text-[11px] text-accent">
                ₹{selectedPlan.baseFeeMonthly.toLocaleString("en-IN")}/month
              </div>
              <div className="text-text-muted">
                {selectedPlan.includedSeats} included seats • {selectedPlan.throughputMps} MPS
                {discountPct > 0 && ` • ${discountPct}% Discount`}
              </div>
            </div>

            <div className="rounded border border-border bg-surface-2 p-3 space-y-1.5 sm:col-span-2">
              <span className="font-semibold text-text uppercase text-[10px] text-text-muted">
                Workspaces ({workspacesList.length})
              </span>
              <div className="space-y-1.5 pt-1">
                {workspacesList.map((ws, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] border-b border-border/40 pb-1">
                    <span className="font-medium text-text">{ws.name}</span>
                    <span className="font-mono text-text-muted">{ws.gstin} ({ws.billingState})</span>
                    <span className="rounded bg-warning/15 px-1.5 py-0.2 font-mono text-[10px] text-warning">
                      kyc_pending
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-border bg-surface-2 p-3 space-y-1 sm:col-span-2">
              <span className="font-semibold text-text uppercase text-[10px] text-text-muted">
                Primary Account Owner
              </span>
              <div className="font-medium text-text">{ownerName} ({ownerEmail})</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-xs font-medium text-text hover:bg-surface-2 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
        ) : (
          <Link
            href="/accounts"
            className="rounded-md border border-border bg-surface px-4 py-2 text-xs font-medium text-text-muted hover:text-text transition-colors"
          >
            Cancel
          </Link>
        )}

        {step < 5 ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent/90 transition-colors shadow-accent-glow"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-success px-5 py-2 text-xs font-bold text-white hover:bg-success/90 transition-colors disabled:opacity-50"
          >
            <span>{isSubmitting ? "Onboarding..." : "Confirm & Onboard"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
