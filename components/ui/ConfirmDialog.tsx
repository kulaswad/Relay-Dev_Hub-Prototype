"use client";

import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-surface p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start gap-3.5">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                variant === "danger"
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : "border-accent/30 bg-accent/10 text-accent"
              )}
            >
              <AlertTriangle className="h-4 w-4" />
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

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover hover:border-border/80 transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={async () => {
                await onConfirm();
                onOpenChange(false);
              }}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-xs font-medium transition-all disabled:opacity-50",
                variant === "danger"
                  ? "bg-danger text-white hover:bg-danger/90"
                  : "bg-accent text-white hover:bg-accent-hover shadow-accent-glow"
              )}
            >
              {isLoading ? "Processing..." : confirmLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
