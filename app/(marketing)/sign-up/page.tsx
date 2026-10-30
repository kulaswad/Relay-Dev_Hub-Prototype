"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";
import { StatusPill } from "@/components/devhub";

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [anonLoading, setAnonLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    role: "Backend dev",
    intent: "Evaluating Relay",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create account");
      }

      router.push("/console");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleTryWithoutSignup = async () => {
    setAnonLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/evaluation", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start evaluation");
      }

      router.push("/console");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create anonymous workspace");
    } finally {
      setAnonLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-8 h-8 rounded bg-accent/20 border border-accent/40 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-colors">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <span className="font-bold text-base tracking-tight text-text">
              Relay Developer Hub
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-text tracking-tight">
            Create Developer Account
          </h1>
          <p className="text-xs text-text-muted">
            Go from zero to your first sandbox API call in under 15 minutes.
          </p>
        </div>

        {/* Anonymous 24h Try Without Signup Option */}
        <div className="p-4 rounded-xl border border-accent/30 bg-accent/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Evaluating & short on time?</span>
            </span>
            <span className="text-[10px] font-mono text-accent bg-accent/15 px-1.5 py-0.5 rounded border border-accent/20">
              Instant
            </span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Generate an anonymous, time-limited (24h) evaluation sandbox with a ready-to-call API key. No password required.
          </p>
          <button
            type="button"
            onClick={handleTryWithoutSignup}
            disabled={anonLoading}
            className="w-full py-2 px-3 rounded-lg bg-surface border border-accent/40 hover:border-accent text-xs font-medium text-text flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <span>{anonLoading ? "Spinning up sandbox..." : "Try Without Signing Up (24h Sandbox)"}</span>
            <ArrowRight className="w-3.5 h-3.5 text-accent" />
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-border w-full" />
          <span className="bg-background px-3 text-[11px] font-mono text-text-muted uppercase tracking-wider shrink-0">
            Or register account
          </span>
          <div className="border-t border-border w-full" />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[#E5534B]/10 border border-[#E5534B]/30 text-[#E5534B] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Sign Up Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Priya Sharma"
              className="w-full bg-[#0A0A0D] border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text">Work Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="priya@acmepay.in"
              className="w-full bg-[#0A0A0D] border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••••••"
              className="w-full bg-[#0A0A0D] border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text">Company / Organization</label>
            <input
              type="text"
              required
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="AcmePay Technologies"
              className="w-full bg-[#0A0A0D] border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full bg-[#0A0A0D] border border-border rounded-lg px-2.5 py-2 text-xs text-text focus:outline-none focus:border-accent"
              >
                <option value="Backend dev">Backend dev</option>
                <option value="Mobile dev">Mobile dev</option>
                <option value="Data/CDP">Data / CDP</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text">I am:</label>
              <select
                value={formData.intent}
                onChange={(e) => setFormData({ ...formData, intent: e.target.value as any })}
                className="w-full bg-[#0A0A0D] border border-border rounded-lg px-2.5 py-2 text-xs text-text focus:outline-none focus:border-accent"
              >
                <option value="Evaluating Relay">Evaluating Relay</option>
                <option value="Already a Relay customer">Already a Relay customer</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all shadow-accent-glow disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            <span>{loading ? "Creating workspace..." : "Create Account & Start Integrating"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="text-center text-xs text-text-muted">
          Already registered?{" "}
          <Link href="/sign-in" className="text-accent hover:underline font-medium">
            Sign in to Console
          </Link>
        </div>
      </div>
    </div>
  );
}
