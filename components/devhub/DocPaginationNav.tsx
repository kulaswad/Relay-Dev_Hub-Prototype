"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DocPaginationNavProps {
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
}

export function DocPaginationNav({ prev, next }: DocPaginationNavProps) {
  if (!prev && !next) return null;

  return (
    <div className="pt-8 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
      {prev ? (
        <Link
          href={prev.href}
          className="p-4 rounded-xl border border-border bg-surface hover:border-text-muted/60 transition-colors flex items-center gap-3 group"
        >
          <ChevronLeft className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors shrink-0" />
          <div className="min-w-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted block">
              Previous
            </span>
            <span className="text-sm font-semibold text-text truncate block group-hover:text-accent transition-colors">
              {prev.title}
            </span>
          </div>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          href={next.href}
          className="p-4 rounded-xl border border-border bg-surface hover:border-text-muted/60 transition-colors flex items-center justify-between gap-3 group text-right sm:ml-auto w-full"
        >
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted block">
              Next
            </span>
            <span className="text-sm font-semibold text-text truncate block group-hover:text-accent transition-colors">
              {next.title}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors shrink-0" />
        </Link>
      ) : null}
    </div>
  );
}
