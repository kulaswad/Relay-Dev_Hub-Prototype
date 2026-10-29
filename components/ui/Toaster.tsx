"use client";

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans rounded-lg border border-border bg-surface text-text shadow-xl text-xs",
          description: "text-text-muted text-[11px]",
          actionButton: "bg-accent text-white font-medium text-xs rounded",
          cancelButton: "bg-surface-2 text-text text-xs rounded",
          error: "border-danger/40 text-danger",
          success: "border-success/40 text-success",
          warning: "border-warning/40 text-warning",
          info: "border-info/40 text-info",
        },
      }}
    />
  );
}

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function toast(
  messageOrProps: string | ToastOptions,
  options?: { description?: string }
) {
  if (typeof messageOrProps === "string") {
    return sonnerToast(messageOrProps, options);
  }

  const { title, description, variant } = messageOrProps;
  if (variant === "destructive") {
    return sonnerToast.error(title || "Error", { description });
  }
  return sonnerToast.success(title || "", { description });
}

toast.success = sonnerToast.success;
toast.error = sonnerToast.error;
toast.info = sonnerToast.info;
toast.warning = sonnerToast.warning;
toast.dismiss = sonnerToast.dismiss;
