"use client";

import React, { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { ShieldAlert, X } from "lucide-react";

export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel?: string;
  placeholder?: string;
  minReasonLength?: number;
  isLoading?: boolean;
  onSubmit: (reason: string) => void | Promise<void>;
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = "Submit with Reason",
  placeholder = "Provide a detailed justification for this audit-logged action (min 10 characters)...",
  minReasonLength = 10,
  isLoading = false,
  onSubmit,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < minReasonLength) {
      setError(`Please provide at least ${minReasonLength} characters for audit compliance.`);
      return;
    }

    setError(null);
    await onSubmit(reason.trim());
    setReason("");
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-surface p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <form onSubmit={handleSubmit}>
            <div className="flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
                <ShieldAlert className="h-4 w-4" />
              </div>

              <div className="flex-1 space-y-1">
                <DialogPrimitive.Title className="text-sm font-semibold tracking-tight text-text">
                  {title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-text-muted leading-relaxed">
                  {description}
                </DialogPrimitive.Description>
              </div>

              <DialogPrimitive.Close className="rounded-md p-1 text-text-muted hover:text-text hover:bg-surface-2 transition-colors">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            <div className="mt-4 space-y-2">
              <label
                htmlFor="reason-textarea"
                className="text-[11px] font-medium text-text-muted uppercase tracking-wider"
              >
                Audit Log Justification <span className="text-danger">*</span>
              </label>
              <textarea
                id="reason-textarea"
                required
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                rows={3}
                placeholder={placeholder}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              />
              {error && (
                <p className="text-[11px] text-danger">{error}</p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <span className="text-[11px] text-text-muted">
                Action recorded to internal audit trail
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setReason("");
                    setError(null);
                    onOpenChange(false);
                  }}
                  className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-md bg-accent px-3.5 py-1.5 text-xs font-medium text-white hover:bg-accent-hover shadow-accent-glow transition-all disabled:opacity-50"
                >
                  {isLoading ? "Saving..." : actionLabel}
                </button>
              </div>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
