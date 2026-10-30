"use client";

import React from "react";
import Link from "next/link";
import {
  CodeBlock,
  Callout,
  DocVersionBanner,
  DocFeedback,
  DocMeta,
  DocPaginationNav,
} from "@/components/devhub";
import { ListOrdered, ArrowRight } from "lucide-react";

export default function PaginationGuidePage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <DocVersionBanner />

      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase bg-accent/15 border-accent/30 text-accent">
            API Design
          </span>
          <span className="text-xs font-mono text-text-muted">Cursor Traversal</span>
        </div>

        <h1 className="text-3xl font-extrabold text-text tracking-tight">
          Pagination & Cursor Traversal
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Relay APIs use cursor-based pagination instead of offset-based pagination to ensure consistent, race-condition-free traversal even as thousands of new messages and events stream in concurrently.
        </p>
      </div>

      <div className="space-y-3">
        <h2 id="parameters" className="text-lg font-bold text-text">
          Pagination Query Parameters
        </h2>
        <div className="p-4 rounded-xl border border-border bg-surface space-y-2 text-xs font-mono">
          <div>
            <code className="text-accent font-bold">limit</code>: Integer between 1 and 100 (Default: 20).
          </div>
          <div>
            <code className="text-accent font-bold">starting_after</code>: Object ID cursor (e.g. <code className="text-text">msg_01JB9X7V2T...</code>). Returns records created strictly after this item.
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 id="traversal-loop" className="text-lg font-bold text-text">
          Node.js Cursor Traversal Loop
        </h2>
        <CodeBlock
          snippets={{
            node: `async function fetchAllMessages() {
  let hasMore = true;
  let startingAfter = undefined;
  const allMessages = [];

  while (hasMore) {
    const url = new URL("https://api.relay.in/v1/messages");
    url.searchParams.set("limit", "100");
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const res = await fetch(url.toString(), {
      headers: { "Authorization": "Bearer rl_test_demo_acmepay_key_01" }
    });
    const page = await res.json();

    allMessages.push(...page.data);
    hasMore = page.has_more;

    if (page.data.length > 0) {
      startingAfter = page.data[page.data.length - 1].id;
    }
  }

  return allMessages;
}`,
          }}
        />
      </div>

      <DocFeedback />
      <DocMeta />
      <DocPaginationNav
        prev={{ title: "Idempotency & Replays", href: "/docs/guides/idempotency" }}
        next={{ title: "Rate Limits & Quotas", href: "/docs/limits" }}
      />
    </div>
  );
}
