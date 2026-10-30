"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyFieldProps {
  value: string;
  label?: string;
  isSecret?: boolean;
  prefix?: string;
  className?: string;
}

export function CopyField({
  value,
  label,
  isSecret = true,
  prefix,
  className,
}: CopyFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const getMaskedDisplay = () => {
    if (!isSecret || revealed) return value;
    if (value.length <= 10) return "••••••••••••";
    const start = prefix || value.slice(0, 8);
    const end = value.slice(-4);
    return `${start}${"•".repeat(16)}${end}`;
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-xs font-medium text-text-muted font-sans">
          {label}
        </label>
      )}

      <div className="flex items-center gap-1.5 bg-[#0C0C0F] border border-border rounded-lg p-1.5 focus-within:border-accent transition-colors">
        <div className="flex-1 font-mono text-xs px-2.5 py-1 text-text select-all truncate">
          {getMaskedDisplay()}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isSecret && (
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              aria-label={revealed ? "Hide secret" : "Reveal secret"}
              className="p-1.5 rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              title={revealed ? "Hide" : "Reveal"}
            >
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy to clipboard"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono text-text-muted hover:text-text hover:bg-surface-2 transition-colors border border-transparent hover:border-border"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-success" />
                <span className="text-success text-[11px]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
