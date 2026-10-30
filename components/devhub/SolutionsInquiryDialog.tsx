"use client";

import React, { useState } from "react";
import { CheckCircle2, Send, X, Building, Mail, User, Sparkles } from "lucide-react";

interface SolutionsInquiryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SolutionsInquiryDialog({ isOpen, onClose }: SolutionsInquiryDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [monthlyVolume, setMonthlyVolume] = useState("< 100k");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["sms", "whatsapp"]);
  const [useCase, setUseCase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedInquiryId, setSubmittedInquiryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/internal/solutions-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          monthlyVolume,
          channels: selectedChannels,
          useCase,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit inquiry");
      }

      setSubmittedInquiryId(data.inquiryId);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-[#0F0F12] p-6 shadow-2xl text-text">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {submittedInquiryId ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#3FB68B]/15 border border-[#3FB68B]/30 text-[#3FB68B] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-text">Inquiry Received</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              Thanks {name}! A solutions architect from our Bengaluru team will review your requirements for{" "}
              <strong className="text-text">{company}</strong> and reach out within 2 business hours.
            </p>
            <div className="p-3 rounded-lg bg-surface-2 border border-border inline-block font-mono text-xs text-accent">
              Ref ID: {submittedInquiryId}
            </div>
            <div className="pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-accent/10 text-accent border border-accent/20 mb-1.5">
                <Sparkles className="w-3 h-3" /> Solutions Architecture Team
              </div>
              <h2 className="text-lg font-bold text-text">Talk to a Solutions Engineer</h2>
              <p className="text-xs text-text-muted">
                Discuss custom throughput (up to 10k TPS), dedicated SMPP carrier binds, or DPDP Act architecture.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#E5534B]/10 border border-[#E5534B]/30 text-xs text-[#E5534B]">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-text-muted mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                  className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-text-muted mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aarav@company.in"
                  className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-text-muted mb-1">Company / Organization *</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme FinTech"
                  className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-text-muted mb-1">Estimated Monthly Volume *</label>
                <select
                  value={monthlyVolume}
                  onChange={(e) => setMonthlyVolume(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text focus:outline-none focus:border-accent"
                >
                  <option value="< 100k">&lt; 100,000 messages</option>
                  <option value="100k - 1M">100k - 1,000,000 messages</option>
                  <option value="1M - 10M">1M - 10,000,000 messages</option>
                  <option value="10M+">10,000,000+ messages (Enterprise)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-text-muted mb-1.5">Channels of Interest</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "sms", label: "Transactional SMS (TRAI DLT)" },
                  { id: "whatsapp", label: "WhatsApp Business API" },
                  { id: "rcs", label: "RCS Verified Business Messaging" },
                  { id: "cdp", label: "Customer Data Platform (CDP)" },
                ].map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleChannel(c.id)}
                    className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                      selectedChannels.includes(c.id)
                        ? "bg-accent/15 border-accent text-accent font-medium"
                        : "bg-surface-2 border-border text-text-muted hover:text-text"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-text-muted mb-1">Use Case & Architecture Notes</label>
              <textarea
                rows={2}
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="e.g. Critical banking OTPs + high-throughput promotional WhatsApp campaigns with carrier fallback"
                className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text focus:outline-none focus:border-accent resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[11px] text-text-muted">
                India HQ in Bengaluru • Data strictly in Mumbai
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? "Submitting..." : "Submit Inquiry"}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
