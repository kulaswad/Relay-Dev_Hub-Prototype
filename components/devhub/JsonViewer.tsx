"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface JsonViewerProps {
  data: any;
  initialExpandedDepth?: number;
  className?: string;
  maxHeight?: string;
}

export function JsonViewer({
  data,
  initialExpandedDepth = 2,
  className,
  maxHeight = "400px",
}: JsonViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className={cn("rounded-lg border border-border bg-[#0C0C0F] text-xs font-mono overflow-hidden", className)}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface text-[11px] text-text-muted">
        <span className="font-semibold uppercase tracking-wider">Payload Inspector</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-text px-2 py-0.5 rounded hover:bg-surface-2 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div
        className="p-3 overflow-auto"
        style={{ maxHeight }}
      >
        <JsonNode
          value={data}
          depth={0}
          initialExpandedDepth={initialExpandedDepth}
        />
      </div>
    </div>
  );
}

function JsonNode({
  keyName,
  value,
  depth,
  initialExpandedDepth,
}: {
  keyName?: string;
  value: any;
  depth: number;
  initialExpandedDepth: number;
}) {
  const [isExpanded, setIsExpanded] = useState(depth < initialExpandedDepth);

  const isObject = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);

  if (!isObject) {
    return (
      <div className="flex items-baseline gap-1 py-0.5" style={{ paddingLeft: `${depth * 16}px` }}>
        {keyName && <span className="text-text-muted">{keyName}: </span>}
        <RenderPrimitive value={value} />
      </div>
    );
  }

  const keys = Object.keys(value);
  const count = keys.length;
  const bracketOpen = isArray ? "[" : "{";
  const bracketClose = isArray ? "]" : "}";

  return (
    <div className="py-0.5" style={{ paddingLeft: `${depth * 16}px` }}>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-1 cursor-pointer hover:bg-surface-2/60 px-1 -ml-1 rounded select-none group"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted group-hover:text-text" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text" />
        )}

        {keyName && <span className="text-text-muted">{keyName}: </span>}
        <span className="text-[#8A8A94] font-semibold">{bracketOpen}</span>

        {!isExpanded && (
          <span className="text-text-muted/60 text-[10px] bg-surface-2 px-1 rounded ml-1">
            {count} {count === 1 ? "item" : "items"} ... {bracketClose}
          </span>
        )}
      </div>

      {isExpanded && (
        <div>
          {keys.map((k) => (
            <JsonNode
              key={k}
              keyName={isArray ? undefined : k}
              value={value[k]}
              depth={depth + 1}
              initialExpandedDepth={initialExpandedDepth}
            />
          ))}
          <div style={{ paddingLeft: `16px` }} className="text-[#8A8A94] font-semibold">
            {bracketClose}
          </div>
        </div>
      )}
    </div>
  );
}

function RenderPrimitive({ value }: { value: any }) {
  if (value === null) {
    return <span className="text-[#8A8A94] italic">null</span>;
  }
  if (typeof value === "undefined") {
    return <span className="text-[#8A8A94] italic">undefined</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-[#7C7CFF] font-semibold">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-[#E0A93B] tabular-nums">{value}</span>;
  }
  if (typeof value === "string") {
    return <span className="text-[#3FB68B]">"{value}"</span>;
  }
  return <span className="text-text">{String(value)}</span>;
}
