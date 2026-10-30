"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { useDevHub } from "@/components/providers/DevHubContext";
import { ThumbsUp, ThumbsDown, Check, MessageSquare, Send } from "lucide-react";

export function DocFeedback({ className }: { className?: string }) {
  const pathname = usePathname();
  const { apiVersion } = useDevHub();
  const [submitted, setSubmitted] = useState<boolean | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleVote = async (helpful: boolean) => {
    setSubmitted(helpful);
    setCommentOpen(true);
    try {
      await fetch("/api/internal/docs/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePath: pathname,
          helpful,
          version: apiVersion,
        }),
      });
    } catch {}
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/internal/docs/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePath: pathname,
          helpful: submitted ?? true,
          comment: comment.trim(),
          version: apiVersion,
        }),
      });
      setCommentOpen(false);
    } catch {} finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`p-4 rounded-xl border border-border bg-surface space-y-3 ${className || ""}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <span className="text-text font-medium">Was this documentation page helpful?</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleVote(true)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              submitted === true
                ? "bg-[#3FB68B]/15 border-[#3FB68B]/40 text-[#3FB68B]"
                : "bg-surface-2 hover:bg-surface border-border text-text-muted hover:text-text"
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Yes</span>
          </button>
          <button
            onClick={() => handleVote(false)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              submitted === false
                ? "bg-[#E5534B]/15 border-[#E5534B]/40 text-[#E5534B]"
                : "bg-surface-2 hover:bg-surface border-border text-text-muted hover:text-text"
            }`}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>No</span>
          </button>
        </div>
      </div>

      {commentOpen && (
        <form onSubmit={handleSubmitComment} className="pt-2 border-t border-border space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <MessageSquare className="w-3.5 h-3.5 text-accent" />
            <span>How can we improve this guide? (Optional)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what was missing, unclear, or out of date..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#09090B] border border-border focus:border-accent text-xs font-mono text-text outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 rounded-lg bg-accent text-white font-medium text-xs hover:bg-accent/90 transition-colors flex items-center gap-1 shrink-0"
            >
              <Send className="w-3 h-3" />
              <span>{submitting ? "Sending..." : "Send"}</span>
            </button>
          </div>
        </form>
      )}

      {submitted !== null && !commentOpen && (
        <div className="flex items-center gap-1.5 text-xs text-[#3FB68B]">
          <Check className="w-4 h-4" />
          <span>Thank you for your feedback!</span>
        </div>
      )}
    </div>
  );
}
