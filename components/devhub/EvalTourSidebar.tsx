"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Send,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  Lock,
  ChevronRight,
  Server,
  FileCheck2,
  Clock,
  Coins,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { SolutionsInquiryDialog } from "./SolutionsInquiryDialog";

interface EvalTourSidebarProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
  className?: string;
}

export function EvalTourSidebar({
  currentStep,
  onSelectStep,
  className = "",
}: EvalTourSidebarProps) {
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"tour" | "compare" | "numbers" | "compliance" | "pricing">("tour");

  const tourSteps = [
    {
      id: 1,
      title: "Step 1: Send an SMS / OTP",
      endpoint: "POST /api/v1/messages",
      description: "Dispatch transactional OTP via telecom routing engine with DLT template validation.",
      recipeKey: "send_otp",
    },
    {
      id: 2,
      title: "Step 2: Ingest a CDP Event",
      endpoint: "POST /api/v1/events",
      description: "Ingest client or backend events (e.g. order_completed, cart_abandoned) into customer timeline.",
      recipeKey: "track_purchase",
    },
    {
      id: 3,
      title: "Step 3: Read Customer Profile",
      endpoint: "GET /api/v1/customers/:id",
      description: "Query unified identity graph and computed traits to verify profile enrichment.",
      recipeKey: "fetch_profile",
    },
  ];

  const testNumbers = [
    { number: "+919999900001", outcome: "Always Delivered (DLR 200)", badge: "Success" },
    { number: "+919999900002", outcome: "Handset Unreachable (Timeout)", badge: "Error" },
    { number: "+919999900003", outcome: "DND National Scrub Filtered", badge: "Filtered" },
    { number: "+919999900004", outcome: "Carrier Spam Classifier Block", badge: "Blocked" },
    { number: "+919999900005", outcome: "Invalid Telecom Series Range", badge: "Invalid" },
    { number: "+919999900006", outcome: "Delayed Delivery Latency (5s)", badge: "Delayed" },
  ];

  return (
    <>
      <div className={`rounded-xl border border-border bg-[#0C0C0F] p-4 flex flex-col space-y-4 ${className}`}>
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-border pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("tour")}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              activeTab === "tour"
                ? "bg-surface-2 text-text font-semibold border border-border"
                : "text-text-muted hover:text-text"
            }`}
          >
            3-Step Tour
          </button>
          <button
            onClick={() => setActiveTab("compare")}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              activeTab === "compare"
                ? "bg-surface-2 text-text font-semibold border border-border"
                : "text-text-muted hover:text-text"
            }`}
          >
            Capabilities
          </button>
          <button
            onClick={() => setActiveTab("numbers")}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              activeTab === "numbers"
                ? "bg-surface-2 text-text font-semibold border border-border"
                : "text-text-muted hover:text-text"
            }`}
          >
            Test Numbers
          </button>
          <button
            onClick={() => setActiveTab("compliance")}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              activeTab === "compliance"
                ? "bg-surface-2 text-text font-semibold border border-border"
                : "text-text-muted hover:text-text"
            }`}
          >
            Security & DPDP
          </button>
          <button
            onClick={() => setActiveTab("pricing")}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              activeTab === "pricing"
                ? "bg-surface-2 text-text font-semibold border border-border"
                : "text-text-muted hover:text-text"
            }`}
          >
            Pricing
          </button>
        </div>

        {/* Tab 1: Guided 3-Step Tour */}
        {activeTab === "tour" && (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold text-text flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-accent" />
                <span>Guided 60-Second Evaluation Tour</span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                Test the complete Relay integration loop using your instant evaluation sandbox key.
              </p>
            </div>

            <div className="space-y-2">
              {tourSteps.map((step, idx) => {
                const isActive = currentStep === idx;
                const isCompleted = currentStep > idx;

                return (
                  <div
                    key={step.id}
                    onClick={() => onSelectStep(idx)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      isActive
                        ? "bg-accent/10 border-accent/60 shadow-sm"
                        : isCompleted
                        ? "bg-surface-2/40 border-border opacity-85"
                        : "bg-surface-2/20 border-border/70 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                        {isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#3FB68B]" />
                        ) : (
                          <span
                            className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono ${
                              isActive ? "bg-accent text-white" : "bg-surface border border-border text-text-muted"
                            }`}
                          >
                            {step.id}
                          </span>
                        )}
                        <span>{step.title}</span>
                      </span>
                      <span className="font-mono text-[10px] text-accent">
                        {isActive ? "ACTIVE" : isCompleted ? "DONE" : ""}
                      </span>
                    </div>

                    <div className="font-mono text-[10px] text-[#5B9DFF] mb-1">
                      {step.endpoint}
                    </div>

                    <p className="text-[11px] text-text-muted leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Capabilities & Comparison */}
        {activeTab === "compare" && (
          <div className="space-y-3 text-xs">
            <h4 className="font-semibold text-text">How Relay Compares</h4>
            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-surface-2 border border-border space-y-1">
                <span className="font-mono text-[11px] text-accent font-semibold">Throughput Scale</span>
                <p className="text-[11px] text-text-muted">
                  5,000 TPS burst capacity on Indian tier-1 carrier binds (Airtel, Jio, Vi) with automated retry routing.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-2 border border-border space-y-1">
                <span className="font-mono text-[11px] text-[#3FB68B] font-semibold">Native Customer Data Platform (CDP)</span>
                <p className="text-[11px] text-text-muted">
                  Unlike pure telecom aggregators, Relay combines multi-channel delivery with an event ingestion stream and unified identity profiles.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-2 border border-border space-y-1">
                <span className="font-mono text-[11px] text-[#E0A93B] font-semibold">Sandbox Fidelity</span>
                <p className="text-[11px] text-text-muted">
                  Every test number simulates real carrier behaviors (DND scrubbing, DLR delivery latency, handset offline timeout).
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-2 border border-border space-y-1">
                <span className="font-mono text-[11px] text-text font-semibold">Rate Limits by Tier</span>
                <div className="text-[11px] font-mono text-text-muted grid grid-cols-3 gap-1 pt-1">
                  <div>Sandbox: 60/m</div>
                  <div>Growth: 600/m</div>
                  <div>Enterprise: 5k/s</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Deterministic Test Numbers */}
        {activeTab === "numbers" && (
          <div className="space-y-3 text-xs">
            <div>
              <h4 className="font-semibold text-text">Deterministic Test Numbers</h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                Use these test mobile numbers in sandbox mode to trigger deterministic carrier states:
              </p>
            </div>

            <div className="divide-y divide-border/60 border border-border rounded-lg overflow-hidden bg-surface-2">
              {testNumbers.map((t) => (
                <div key={t.number} className="p-2.5 text-xs flex items-center justify-between">
                  <div>
                    <code className="font-mono text-accent font-semibold">{t.number}</code>
                    <div className="text-[11px] text-text-muted">{t.outcome}</div>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                    {t.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Security, Compliance & DPDP Act Statements */}
        {activeTab === "compliance" && (
          <div className="space-y-3 text-xs">
            <div>
              <h4 className="font-semibold text-text flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#3FB68B]" />
                <span>Security & India Compliance</span>
              </h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                Plain-language statements to review with your InfoSec and Legal teams:
              </p>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-surface-2 border border-border space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#3FB68B]">
                  <Server className="w-3.5 h-3.5" /> 100% Indian Data Sovereignty
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  All customer event ingestion, message logs, and database records remain strictly within Mumbai (AWS ap-south-1 / GCP asia-south1). Zero overseas data transit.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-2 border border-border space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-accent">
                  <FileCheck2 className="w-3.5 h-3.5" /> DPDP Act 2023 Readiness
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Supports customer consent capture primitives (`consent.sms = false`), purpose limitations, and automated profile erasure APIs required under the Digital Personal Data Protection Act.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-2 border border-border space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#E0A93B]">
                  <Lock className="w-3.5 h-3.5" /> TRAI TCCCPR 2018 DLT Guardrails
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Built-in DLT header registry prevents carrier drops by pre-validating 6-character sender IDs and approved template schemas prior to transmission.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Pricing Model Summary */}
        {activeTab === "pricing" && (
          <div className="space-y-3 text-xs">
            <div>
              <h4 className="font-semibold text-text flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[#E0A93B]" />
                <span>Pricing Model Summary</span>
              </h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                Flexible billing models for startups and high-volume enterprises:
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
                <div className="font-mono text-[10px] text-text-muted uppercase">Transactional SMS</div>
                <div className="text-base font-bold text-text mt-1">₹0.12</div>
                <div className="text-[10px] text-text-muted">per 160-char part</div>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
                <div className="font-mono text-[10px] text-text-muted uppercase">Verified RCS</div>
                <div className="text-base font-bold text-text mt-1">₹0.20</div>
                <div className="text-[10px] text-text-muted">rich interactive card</div>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
                <div className="font-mono text-[10px] text-text-muted uppercase">WhatsApp Auth</div>
                <div className="text-base font-bold text-text mt-1">₹0.35</div>
                <div className="text-[10px] text-text-muted">Meta conversation rate</div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-2 border border-border space-y-1 text-[11px] text-text-muted">
              <div>• <strong>Prepaid Wallet</strong>: Top up via UPI/Netbanking with zero minimum commit.</div>
              <div>• <strong>Postpaid Invoicing</strong>: Net-30 credit terms available for Growth & Enterprise.</div>
              <div>• <strong>CDP Ingestion</strong>: Free for up to 100,000 monthly active customer profiles.</div>
            </div>
          </div>
        )}

        {/* Talk to a solutions engineer CTA */}
        <div className="pt-2 border-t border-border">
          <button
            onClick={() => setInquiryOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-surface border border-accent/40 hover:border-accent text-accent text-xs font-semibold transition-all shadow-sm group"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Talk to a Solutions Engineer</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      <SolutionsInquiryDialog
        isOpen={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
      />
    </>
  );
}
