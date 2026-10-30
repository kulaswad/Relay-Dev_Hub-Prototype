"use client";

import React, { useState, useEffect } from "react";
import { useDevHub, CodeLanguage } from "@/components/providers/DevHubContext";
import { Check, Copy, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CodeSnippets {
  curl?: string;
  node?: string;
  python?: string;
  go?: string;
  json?: string;
  [key: string]: string | undefined;
}

interface CodeBlockProps {
  snippets?: CodeSnippets;
  code?: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  className?: string;
}

const languageLabels: Record<string, string> = {
  curl: "cURL",
  node: "Node.js",
  python: "Python",
  php: "PHP",
  java: "Java",
  go: "Go",
  json: "JSON",
  bash: "Bash",
  ts: "TypeScript",
  js: "JavaScript",
};

export function CodeBlock({
  snippets,
  code: directCode,
  language: directLang,
  filename,
  showLineNumbers = false,
  highlightLines = [],
  className,
}: CodeBlockProps) {
  const { activeLanguage, setActiveLanguage } = useDevHub();
  const [copied, setCopied] = useState(false);

  // If snippets provided, determine available languages
  const availableLangs = snippets ? Object.keys(snippets).filter((k) => !!snippets[k]) : [];
  const isMultiLang = snippets && availableLangs.length > 1;

  // Selected language
  const selectedLang = isMultiLang
    ? (availableLangs.includes(activeLanguage) ? activeLanguage : availableLangs[0])
    : directLang || (availableLangs[0] ?? "bash");

  // Code to display
  const displayCode = (snippets ? snippets[selectedLang] : directCode) || "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const lines = displayCode.split("\n");

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface overflow-hidden my-4 group shadow-sm",
        className
      )}
    >
      {/* Top Header / Language Tabs */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-[#0C0C0F] text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {filename && (
            <div className="flex items-center gap-1.5 px-2 py-1 text-text-muted font-mono text-[11px] border-r border-border/80 mr-1.5">
              <Terminal className="w-3.5 h-3.5 text-accent" />
              <span>{filename}</span>
            </div>
          )}

          {isMultiLang ? (
            availableLangs.map((lang) => {
              const isActive = lang === selectedLang;
              return (
                <button
                  key={lang}
                  onClick={() => setActiveLanguage(lang as CodeLanguage)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-mono font-medium transition-all select-none",
                    isActive
                      ? "bg-surface-2 text-text border border-border/90 shadow-sm"
                      : "text-text-muted hover:text-text hover:bg-surface-2/40"
                  )}
                >
                  {languageLabels[lang] || lang}
                </button>
              );
            })
          ) : (
            <span className="text-text-muted font-mono text-[11px] uppercase tracking-wider px-1">
              {languageLabels[selectedLang] || selectedLang}
            </span>
          )}
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono text-text-muted hover:text-text hover:bg-surface-2 transition-colors shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Area */}
      <div className="relative p-3.5 overflow-x-auto text-xs font-mono leading-relaxed bg-[#0A0A0D]">
        <pre className="text-text">
          <code>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = highlightLines.includes(lineNum);
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex min-w-full hover:bg-surface-2/40 px-1 -mx-1 rounded-sm",
                    isHighlighted && "bg-accent/15 border-l-2 border-accent pl-1"
                  )}
                >
                  {showLineNumbers && (
                    <span className="w-8 shrink-0 select-none text-text-muted/40 text-right pr-3 font-mono text-[11px]">
                      {lineNum}
                    </span>
                  )}
                  <span className="flex-1 whitespace-pre">{line || " "}</span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
