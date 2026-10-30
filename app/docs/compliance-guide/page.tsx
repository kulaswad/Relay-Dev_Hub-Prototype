"use client";

import React from "react";
import { Callout, Stepper, StatusPill } from "@/components/devhub";
import { ShieldCheck, FileCheck, CheckCircle2 } from "lucide-react";

export default function ComplianceGuideDocPage() {
  const complianceSteps = [
    { id: 1, title: "1. Entity KYC", duration: "1-2 days" },
    { id: 2, title: "2. Sender Header", duration: "24 hrs" },
    { id: 3, title: "3. DLT Template", duration: "24 hrs" },
    { id: 4, title: "4. Go Live", duration: "Instant" },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          TRAI DLT & Indian KYC Guide
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          The regulatory framework required by the Telecom Regulatory Authority of India (TRAI) and Ministry of Corporate Affairs (MCA) before sending live messages.
        </p>
      </div>

      <Callout type="note" title="Remember: Sandbox Is Fully Open">
        You can build, integrate, and test all Relay APIs using your test key (<code className="text-[#E0A93B]">rk_test_...</code>) without completing KYC. This guide is only required when you are ready to switch from Test to Live.
      </Callout>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-text">Compliance Approval Journey</h2>
        <div className="p-4 rounded-xl border border-border bg-surface">
          <Stepper steps={complianceSteps} currentStep={1} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-text">Required KYC Documents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border bg-surface space-y-2">
            <div className="flex items-center gap-2 text-text font-semibold text-xs">
              <FileCheck className="w-4 h-4 text-[#3FB68B]" />
              <span>Certificate of Incorporation (MCA)</span>
            </div>
            <p className="text-xs text-text-muted">
              Issued by the Registrar of Companies (ROC) containing CIN and registered business address.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-border bg-surface space-y-2">
            <div className="flex items-center gap-2 text-text font-semibold text-xs">
              <FileCheck className="w-4 h-4 text-[#3FB68B]" />
              <span>GSTIN Registration Certificate</span>
            </div>
            <p className="text-xs text-text-muted">
              Valid 15-character Indian State GST certificate required for invoicing and telco entity matching.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-text">Sender Header (DLT Header) Rules</h2>
        <ul className="space-y-2 text-xs text-text-muted">
          <li>• Exactly 6 uppercase alphabetic characters (e.g. <code className="text-text font-mono">RELAYI</code>, <code className="text-text font-mono">ZOMATO</code>).</li>
          <li>• Must match or logically represent your registered entity brand name.</li>
          <li>• Headers are registered on telecom portals (Jio DLT, Airtel DLT, Vilpower) and synced to Relay.</li>
        </ul>
      </section>
    </div>
  );
}
