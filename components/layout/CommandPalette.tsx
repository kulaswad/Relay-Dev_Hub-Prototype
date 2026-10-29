"use client";

import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import {
  Building2,
  FolderGit2,
  CreditCard,
  FileCheck2,
  ClipboardList,
  LayoutDashboard,
  Search,
  Sparkles,
  ShieldCheck,
  CheckSquare,
  Sliders,
  FileText,
  Plus,
  Play,
  ArrowRight,
} from "lucide-react";
import { searchGlobalEntitiesAction } from "@/app/actions/search";
import { formatINR } from "@/lib/utils";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    orgs: any[];
    workspaces: any[];
    invoices: any[];
  }>({ orgs: [], workspaces: [], invoices: [] });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }

        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSearchResults({ orgs: [], workspaces: [], invoices: [] });
      return;
    }

    const timer = setTimeout(() => {
      searchGlobalEntitiesAction(query).then((res) => {
        if (res.success) {
          setSearchResults({
            orgs: res.orgs || [],
            workspaces: res.workspaces || [],
            invoices: res.invoices || [],
          });
        }
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (callback: () => void) => {
    onOpenChange(false);
    callback();
  };

  const hasSearchResults =
    searchResults.orgs.length > 0 ||
    searchResults.workspaces.length > 0 ||
    searchResults.invoices.length > 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[30%] z-50 w-full max-w-xl translate-x-[-50%] translate-y-[-50%] rounded-xl border border-border bg-surface shadow-2xl overflow-hidden duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <Command className="w-full bg-surface" shouldFilter={false}>
            <div className="flex items-center border-b border-border px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search organizations, workspaces, GSTINs, invoices, or jump to..."
                className="flex h-12 w-full bg-transparent text-xs text-text placeholder:text-text-muted/60 focus:outline-none"
              />
              <span className="text-[10px] font-mono text-text-muted border border-border rounded px-1.5 py-0.5">
                ESC
              </span>
            </div>

            <Command.List className="max-h-96 overflow-y-auto p-2">
              {/* Dynamic Live Search Results */}
              {query.trim().length >= 2 && !hasSearchResults && (
                <div className="py-6 text-center text-xs text-text-muted">
                  No matching organizations, workspaces, GSTINs, or invoices found for "{query}".
                </div>
              )}

              {/* Matched Organizations */}
              {searchResults.orgs.length > 0 && (
                <Command.Group
                  heading="Matching Organizations"
                  className="text-[10px] font-semibold text-text-muted px-2 py-1 uppercase tracking-wider"
                >
                  {searchResults.orgs.map((org) => (
                    <div
                      key={org.id}
                      onClick={() => handleSelect(() => router.push(`/accounts/${org.id}`))}
                      className="flex items-center justify-between rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="h-4 w-4 text-accent shrink-0" />
                        <div className="truncate">
                          <span className="font-semibold text-text">{org.name}</span>
                          <span className="text-[11px] text-text-muted font-mono ml-2">
                            {org.legalName}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted shrink-0 capitalize">
                        {org.industry} • {org.billingModel}
                      </span>
                    </div>
                  ))}
                </Command.Group>
              )}

              {/* Matched Workspaces & GSTINs */}
              {searchResults.workspaces.length > 0 && (
                <Command.Group
                  heading="Matching Workspaces & GSTINs"
                  className="mt-2 text-[10px] font-semibold text-text-muted px-2 py-1 uppercase tracking-wider"
                >
                  {searchResults.workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      onClick={() => handleSelect(() => router.push(`/accounts/${ws.orgId}`))}
                      className="flex items-center justify-between rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FolderGit2 className="h-4 w-4 text-success shrink-0" />
                        <div className="truncate">
                          <span className="font-semibold text-text">{ws.name}</span>
                          <span className="text-[11px] text-text-muted font-mono ml-2">
                            GSTIN: {ws.gstin || "Pending"}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted shrink-0">
                        {ws.billingState}
                      </span>
                    </div>
                  ))}
                </Command.Group>
              )}

              {/* Matched Invoices */}
              {searchResults.invoices.length > 0 && (
                <Command.Group
                  heading="Matching Invoices"
                  className="mt-2 text-[10px] font-semibold text-text-muted px-2 py-1 uppercase tracking-wider"
                >
                  {searchResults.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => handleSelect(() => router.push("/finance"))}
                      className="flex items-center justify-between rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-warning shrink-0" />
                        <span className="font-mono font-bold text-text">#{inv.id}</span>
                        <span className="text-[11px] text-text-muted font-sans">
                          ({inv.period})
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-text font-bold">
                        {formatINR(inv.amount + inv.gstAmount)}
                      </span>
                    </div>
                  ))}
                </Command.Group>
              )}

              {/* Quick Actions */}
              <Command.Group
                heading="Quick Actions"
                className="mt-2 text-[10px] font-semibold text-text-muted px-2 py-1 uppercase tracking-wider"
              >
                <div
                  onClick={() => handleSelect(() => router.push("/approvals"))}
                  className="flex items-center justify-between rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-accent" />
                    <span>Open Pending Approvals Queue</span>
                  </div>
                  <span className="text-[10px] font-mono text-accent">Maker-Checker</span>
                </div>

                <div
                  onClick={() => handleSelect(() => router.push("/finance"))}
                  className="flex items-center justify-between rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-warning" />
                    <span>Open Finance &amp; Credit Hub</span>
                  </div>
                  <span className="text-[10px] font-mono text-warning">Watchlist</span>
                </div>

                <div
                  onClick={() => handleSelect(() => router.push("/accounts/new"))}
                  className="flex items-center justify-between rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-success" />
                    <span>Launch New Account Onboarding Wizard</span>
                  </div>
                  <span className="text-[10px] font-mono text-text-muted">Sales Ops</span>
                </div>

                <div
                  onClick={() => handleSelect(() => router.push("/audit"))}
                  className="flex items-center justify-between rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-accent" />
                    <span>View Cryptographic Audit Trail</span>
                  </div>
                  <span className="text-[10px] font-mono text-success">SHA-256</span>
                </div>
              </Command.Group>

              {/* Navigation Pages */}
              <Command.Group
                heading="Jump To Page"
                className="mt-2 text-[10px] font-semibold text-text-muted px-2 py-1 uppercase tracking-wider"
              >
                <div
                  onClick={() => handleSelect(() => router.push("/"))}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4 text-text-muted" />
                  <span>Dashboard (Mission Control)</span>
                </div>

                <div
                  onClick={() => handleSelect(() => router.push("/accounts"))}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <Building2 className="h-4 w-4 text-text-muted" />
                  <span>Customer Accounts Portfolio</span>
                </div>

                <div
                  onClick={() => handleSelect(() => router.push("/tasks"))}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <CheckSquare className="h-4 w-4 text-text-muted" />
                  <span>Operational Tasks</span>
                </div>

                <div
                  onClick={() => handleSelect(() => router.push("/compliance"))}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <ShieldCheck className="h-4 w-4 text-text-muted" />
                  <span>KYC &amp; DLT Compliance Hub</span>
                </div>

                <div
                  onClick={() => handleSelect(() => router.push("/plans"))}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <Sliders className="h-4 w-4 text-text-muted" />
                  <span>Plans &amp; Add-ons Catalog</span>
                </div>

                <div
                  onClick={() => handleSelect(() => router.push("/admin/permissions"))}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-text hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <ShieldCheck className="h-4 w-4 text-text-muted" />
                  <span>Roles &amp; Permission Matrix</span>
                </div>
              </Command.Group>
            </Command.List>

            <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[11px] text-text-muted">
              <span>Quick jump &amp; global search</span>
              <div className="flex items-center gap-2">
                <span>Select</span>
                <kbd className="font-mono bg-surface-2 px-1.5 rounded border border-border">↵</kbd>
                <span>Close</span>
                <kbd className="font-mono bg-surface-2 px-1.5 rounded border border-border">ESC</kbd>
              </div>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
