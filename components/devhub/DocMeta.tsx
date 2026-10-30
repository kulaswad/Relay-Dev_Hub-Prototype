"use client";

import React from "react";
import { Clock, ExternalLink, GitBranch } from "lucide-react";

interface DocMetaProps {
  lastUpdated?: string;
  editUrl?: string;
  className?: string;
}

export function DocMeta({
  lastUpdated = "October 2026",
  editUrl = "https://github.com/relay-telecom/developer-hub/issues/new",
  className,
}: DocMetaProps) {
  return (
    <div
      className={`pt-6 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-text-muted ${
        className || ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-accent" />
        <span>Last updated: {lastUpdated}</span>
      </div>

      <a
        href={editUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-text-muted hover:text-text transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        <span>Edit or report an issue on this page</span>
      </a>
    </div>
  );
}
