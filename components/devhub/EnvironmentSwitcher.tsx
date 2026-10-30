"use client";

import React, { useState } from "react";
import { useDevHub } from "@/components/providers/DevHubContext";
import { StatusPill } from "./StatusPill";
import { ChevronDown, AlertTriangle, ShieldCheck, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function EnvironmentSwitcher() {
  const { environment, setEnvironment, workspace } = useDevHub();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1 rounded-full border bg-surface transition-all text-xs font-medium",
          environment === "test"
            ? "border-[#E0A93B]/40 hover:border-[#E0A93B]"
            : "border-[#3FB68B]/40 hover:border-[#3FB68B]"
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            environment === "test" ? "bg-[#E0A93B]" : "bg-[#3FB68B]"
          )}
        />
        <span className="font-mono text-text">
          {environment === "test" ? "Test Sandbox" : "Live Production"}
        </span>
        <ChevronDown className="w-3 h-3 text-text-muted" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 rounded-lg border border-border bg-surface shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2 py-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              API Environment
            </div>

            {/* Test Option */}
            <button
              onClick={() => {
                setEnvironment("test");
                setIsOpen(false);
              }}
              className={cn(
                "w-full text-left p-2.5 rounded-md text-xs transition-colors flex items-start gap-3",
                environment === "test"
                  ? "bg-surface-2 text-text"
                  : "hover:bg-surface-2/60 text-text-muted"
              )}
            >
              <span className="mt-1 w-2 h-2 rounded-full bg-[#E0A93B] shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between font-medium text-text">
                  <span>Test Sandbox</span>
                  {environment === "test" && <Check className="w-3.5 h-3.5 text-accent" />}
                </div>
                <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                  Mock delivery, zero charge, no KYC required. Ideal for testing integrations.
                </p>
                <span className="inline-block mt-1 font-mono text-[10px] text-[#E0A93B] bg-[#E0A93B]/10 px-1.5 py-0.5 rounded">
                  rk_test_...
                </span>
              </div>
            </button>

            {/* Live Option */}
            <button
              onClick={() => {
                setEnvironment("live");
                setIsOpen(false);
              }}
              className={cn(
                "w-full text-left p-2.5 rounded-md text-xs transition-colors flex items-start gap-3 mt-1",
                environment === "live"
                  ? "bg-surface-2 text-text"
                  : "hover:bg-surface-2/60 text-text-muted"
              )}
            >
              <span className="mt-1 w-2 h-2 rounded-full bg-[#3FB68B] shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between font-medium text-text">
                  <span>Live Production</span>
                  {environment === "live" && <Check className="w-3.5 h-3.5 text-accent" />}
                </div>
                <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                  Sends real carrier messages across India (DLT templates & KYC required).
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block font-mono text-[10px] text-[#3FB68B] bg-[#3FB68B]/10 px-1.5 py-0.5 rounded">
                    rk_live_...
                  </span>
                  {workspace.kycStatus === "active" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#3FB68B]">
                      <ShieldCheck className="w-3 h-3" /> KYC Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#E0A93B]">
                      <AlertTriangle className="w-3 h-3" /> KYC Needed
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
