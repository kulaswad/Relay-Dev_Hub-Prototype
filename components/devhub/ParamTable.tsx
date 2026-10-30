"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ParamItem {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  example?: string;
  defaultValue?: string;
  default?: string;
  enum?: string[];
  children?: ParamItem[];
}

export interface ParamTableProps {
  title?: string;
  params?: ParamItem[];
  parameters?: ParamItem[];
  className?: string;
}

export function ParamTable({ title, params, parameters, className }: ParamTableProps) {
  const list = parameters || params || [];

  return (
    <div className={cn("my-6 rounded-lg border border-border bg-surface overflow-hidden", className)}>
      {title && (
        <div className="px-4 py-2.5 bg-[#0C0C0F] border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-text uppercase tracking-wider font-mono">
            {title}
          </span>
          <span className="text-[11px] text-text-muted font-mono">
            {list.length} {list.length === 1 ? "field" : "fields"}
          </span>
        </div>
      )}

      <div className="divide-y divide-border/60">
        {list.map((param) => {
          const defaultVal = param.defaultValue || param.default;
          return (
            <div key={param.name} className="p-4 hover:bg-surface-2/30 transition-colors">
              <div className="flex flex-wrap items-baseline gap-2.5 mb-1.5">
                <span className="font-mono text-xs font-bold text-text bg-surface-2 px-1.5 py-0.5 rounded border border-border/80">
                  {param.name}
                </span>
                <span className="font-mono text-[11px] text-[#7C7CFF]">
                  {param.type}
                </span>
                {param.required ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#E5534B]/15 text-[#E5534B] border border-[#E5534B]/30">
                    required
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 text-text-muted border border-border">
                    optional
                  </span>
                )}
                {defaultVal !== undefined && (
                  <span className="text-[11px] text-text-muted font-mono">
                    default: <code className="text-text">{typeof defaultVal === "object" ? JSON.stringify(defaultVal) : String(defaultVal)}</code>
                  </span>
                )}
              </div>

              <p className="text-xs text-text-muted leading-relaxed">
                {param.description}
              </p>

              {param.enum && param.enum.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-text-muted font-mono">Allowed values:</span>
                  {param.enum.map((val) => (
                    <code key={val} className="text-[10px] font-mono text-[#ECECEF] bg-[#16161A] px-1.5 py-0.5 rounded border border-border">
                      {val}
                    </code>
                  ))}
                </div>
              )}

              {param.example !== undefined && (
                <div className="mt-2 text-[11px] font-mono text-text-muted flex items-center gap-1.5">
                  <span className="text-text-muted/60">Example:</span>
                  <span className="text-[#ECECEF] bg-[#16161A] px-1.5 py-0.5 rounded border border-border/80">
                    {typeof param.example === "object" ? JSON.stringify(param.example) : String(param.example)}
                  </span>
                </div>
              )}

              {/* Nested parameters if any */}
              {param.children && param.children.length > 0 && (
                <div className="mt-3 pl-4 border-l-2 border-border/70 space-y-3">
                  <div className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
                    Properties of {param.name}:
                  </div>
                  {param.children.map((child) => (
                    <div key={child.name} className="text-xs">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] font-semibold text-text">
                          {child.name}
                        </span>
                        <span className="font-mono text-[10px] text-[#7C7CFF]">
                          {child.type}
                        </span>
                        {child.required && (
                          <span className="text-[9px] font-mono text-[#E5534B]">
                            required
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {child.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
