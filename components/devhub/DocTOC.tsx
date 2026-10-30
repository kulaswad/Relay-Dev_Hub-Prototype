"use client";

import React, { useEffect, useState } from "react";
import { AlignLeft, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  title: string;
  level: number;
}

export function DocTOC({ items }: { items?: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const [autoItems, setAutoItems] = useState<TocItem[]>(items || []);

  useEffect(() => {
    if (!items || items.length === 0) {
      // Auto-discover headings in page content
      const headings = Array.from(document.querySelectorAll("main h2, main h3"));
      const discovered = headings
        .map((h) => {
          if (!h.id) {
            h.id = (h.textContent || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          }
          return {
            id: h.id,
            title: h.textContent || "",
            level: h.tagName.toLowerCase() === "h2" ? 2 : 3,
          };
        })
        .filter((item) => !!item.id && !!item.title);
      setAutoItems(discovered);
    }
  }, [items]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0% 0% -60% 0%" }
    );

    autoItems.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [autoItems]);

  if (autoItems.length === 0) return null;

  return (
    <aside className="w-56 shrink-0 hidden xl:block sticky top-20 select-none max-h-[calc(100vh-6rem)] overflow-y-auto pl-6">
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-text-muted font-semibold">
          <AlignLeft className="w-3.5 h-3.5 text-accent" />
          <span>On this page</span>
        </div>
        <ul className="space-y-1.5 text-xs font-mono">
          {autoItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li key={item.id} className={item.level === 3 ? "pl-3" : ""}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                    window.history.pushState(null, "", `#${item.id}`);
                  }}
                  className={cn(
                    "block truncate transition-colors",
                    isActive
                      ? "text-accent font-bold"
                      : "text-text-muted hover:text-text"
                  )}
                >
                  {item.title}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
