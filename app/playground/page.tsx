"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Clock,
  Key,
  Layers,
  Activity,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { PlaygroundView } from "@/components/devhub/PlaygroundView";
import { EvalTourSidebar } from "@/components/devhub/EvalTourSidebar";

export default function EvalPlaygroundPage() {
  const [tourStep, setTourStep] = useState(0);
  const [evalWorkspace, setEvalWorkspace] = useState<any>(null);
  const [loadingEval, setLoadingEval] = useState(true);

  // Auto-initialize anonymous evaluation workspace if no session
  useEffect(() => {
    async function initEval() {
      try {
        const sessionRes = await fetch("/api/internal/session");
        const sessionData = await sessionRes.json();

        if (sessionData.workspace) {
          setEvalWorkspace(sessionData.workspace);
          setLoadingEval(false);
        } else {
          // Initialize 24h anonymous evaluation session
          const evalRes = await fetch("/api/auth/evaluation", { method: "POST" });
          const evalData = await evalRes.json();
          if (evalData.workspace) {
            setEvalWorkspace(evalData.workspace);
          }
          setLoadingEval(false);
        }
      } catch (err) {
        setLoadingEval(false);
      }
    }
    initEval();
  }, []);

  const tourStepRecipes = ["send_otp", "track_purchase", "fetch_profile"];

  return (
    <div className="min-h-screen bg-[#09090B] text-text flex flex-col">
      {/* Eval Navigation Topbar */}
      <header className="border-b border-border bg-[#0C0C0F]/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7C7CFF] to-[#3FB68B] flex items-center justify-center font-bold text-xs text-white">
              R
            </div>
            <span className="font-bold text-sm tracking-tight text-text">Relay</span>
            <span className="text-xs font-mono text-text-muted">/</span>
            <span className="text-xs font-mono text-text-muted">sandbox-eval</span>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#3FB68B]/10 text-[#3FB68B] border border-[#3FB68B]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3FB68B] animate-pulse" />
            24h Evaluation Key Active
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/docs"
            className="text-xs text-text-muted hover:text-text transition-colors px-2 py-1"
          >
            Documentation
          </Link>
          <Link
            href="/sign-in"
            className="text-xs text-text-muted hover:text-text transition-colors px-2 py-1"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all shadow-sm"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner with 60-Second Guided Tour progress */}
        <div className="p-4 rounded-xl border border-border bg-gradient-to-r from-[#111118] via-[#0E0E14] to-[#0A0A0E] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h1 className="text-sm sm:text-base font-bold text-text">
                60-Second Evaluation Sandbox
              </h1>
            </div>
            <p className="text-xs text-text-muted max-w-2xl">
              Execute live calls against the real Relay gateway without signing up. Test multi-channel message dispatch, stream events into the CDP, and query identity profiles.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-text-muted">Tour Progress:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((step, idx) => (
                <div
                  key={step}
                  onClick={() => setTourStep(idx)}
                  className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
                    tourStep === idx
                      ? "bg-accent text-white font-bold"
                      : tourStep > idx
                      ? "bg-[#3FB68B]/20 text-[#3FB68B] border border-[#3FB68B]/40"
                      : "bg-surface-2 border border-border text-text-muted"
                  }`}
                >
                  {tourStep > idx ? "✓" : step}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2-Column Main Section: Playground & Eval Tour Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Main Playground Pane (8 or 9 cols) */}
          <div className="xl:col-span-8">
            <PlaygroundView
              key={tourStepRecipes[tourStep]}
              initialRecipe={tourStepRecipes[tourStep]}
              isEvalMode={true}
              onTourStepComplete={(step) => {
                if (step === tourStep && tourStep < 2) {
                  setTourStep(tourStep + 1);
                }
              }}
            />
          </div>

          {/* Right Sidebar: Guided Tour, Comparisons, Numbers & Solutions Engineer CTA (4 cols) */}
          <div className="xl:col-span-4 sticky top-20">
            <EvalTourSidebar
              currentStep={tourStep}
              onSelectStep={(step) => setTourStep(step)}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-[#0C0C0F] py-6 px-4 sm:px-6 text-center text-xs text-text-muted">
        <p>Relay Developer Hub • Enterprise Telecom & CDP Engine for India • Port 3001</p>
      </footer>
    </div>
  );
}
