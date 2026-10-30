"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, AlertCircle, KeyRound, Sparkles } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed");
      }

      router.push("/console");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setEmail("demo@acmepay.in");
    setPassword("demo1234");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "demo@acmepay.in", password: "demo1234" }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Demo authentication failed");
      }

      router.push("/console");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Could not sign in with demo account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-md space-y-6">
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
            Sign In to Developer Console
          </h1>
          <p className="text-xs text-text-muted">
            Access your API keys, webhook test bench, and usage quotas.
          </p>
        </div>

        {/* Demo Account Quick Access Card */}
        <div className="p-4 rounded-xl border border-border bg-[#0C0C0F] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-accent" />
              <span>Seed Demo Account</span>
            </span>
            <span className="text-[10px] font-mono text-accent bg-accent/15 px-1.5 py-0.5 rounded border border-accent/20">
              AcmePay
            </span>
          </div>
          <div className="text-[11px] font-mono text-text-muted space-y-0.5">
            <div>Email: <strong className="text-text">demo@acmepay.in</strong></div>
            <div>Password: <strong className="text-text">demo1234</strong></div>
          </div>
          <button
            type="button"
            onClick={handleDemoSignIn}
            disabled={loading}
            className="w-full py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-surface border border-border text-xs font-medium text-text flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <span>One-Click Sign In as Demo User</span>
            <ArrowRight className="w-3.5 h-3.5 text-accent" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[#E5534B]/10 border border-[#E5534B]/30 text-[#E5534B] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text">Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@company.in"
              className="w-full bg-[#0A0A0D] border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#0A0A0D] border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all shadow-accent-glow disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            <span>{loading ? "Signing in..." : "Sign In to Console"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="text-center text-xs text-text-muted space-y-2">
          <div>
            Don't have an account?{" "}
            <Link href="/sign-up" className="text-accent hover:underline font-medium">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
