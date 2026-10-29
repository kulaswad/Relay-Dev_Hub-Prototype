"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  FolderGit2,
  CreditCard,
  FileCheck2,
  ShieldCheck,
  ClipboardList,
  Sliders,
  Lock,
  Bot,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
} from "lucide-react";
import { useRole } from "./RoleContext";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  adminOnly?: boolean;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { currentRole, approvalsCount } = useRole();

  const navItems: NavItem[] = [
    {
      title: "Overview",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Accounts",
      href: "/accounts",
      icon: Building2,
    },
    {
      title: "Tasks",
      href: "/tasks",
      icon: CheckSquare,
    },
    {
      title: "Plans & Pricing",
      href: "/plans",
      icon: Sliders,
    },
    {
      title: "Approvals Queue",
      href: "/approvals",
      icon: FileCheck2,
      badge: approvalsCount > 0 ? approvalsCount : undefined,
    },
    {
      title: "Credit & Billing",
      href: "/finance",
      icon: CreditCard,
    },
    {
      title: "KYC & Sender IDs",
      href: "/compliance",
      icon: ShieldCheck,
    },
    {
      title: "Audit Trail",
      href: "/audit",
      icon: ClipboardList,
    },
    {
      title: "Product Notes",
      href: "/about",
      icon: BookOpen,
    },
  ];

  const adminNavItems: NavItem[] = [
    {
      title: "Roles & Matrix",
      href: "/admin/permissions",
      icon: Lock,
      adminOnly: true,
    },
    {
      title: "Approval Policies",
      href: "/admin/policies",
      icon: Sliders,
      adminOnly: true,
    },
    {
      title: "AI Activity",
      href: "/admin/ai",
      icon: Bot,
      adminOnly: true,
    },
  ];

  const isAdmin = currentRole === "admin";

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-surface select-none transition-all duration-200 z-20 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-3.5">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/15 border border-accent/40 text-accent font-mono font-bold text-sm shadow-accent-glow">
            R
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-xs tracking-tight text-text">
                Relay BMP
              </span>
              <span className="rounded bg-surface-2 px-1.5 py-0.2 font-mono text-[9px] uppercase tracking-wider text-text-muted border border-border">
                Internal
              </span>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-6 w-6 items-center justify-center rounded border border-border text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-4 p-2 overflow-y-auto">
        <div className="space-y-1">
          <div className="mb-1 px-2 py-0.5">
            {!collapsed && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/70">
                Operations
              </span>
            )}
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-surface-2 text-text border border-border"
                    : "text-text-muted hover:bg-surface-2/60 hover:text-text"
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-accent" : "text-text-muted group-hover:text-text"
                  )}
                />
                {!collapsed && <span className="truncate flex-1">{item.title}</span>}

                {!collapsed && item.badge !== undefined && (
                  <span className="rounded-full bg-accent/20 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-accent border border-accent/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Governance & Admin Section */}
        <div className="space-y-1 pt-2 border-t border-border/50">
          <div className="mb-1 px-2 py-0.5 flex items-center justify-between">
            {!collapsed && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/70">
                Governance
              </span>
            )}
          </div>

          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (!isAdmin) {
              return (
                <div
                  key={item.href}
                  className="group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-text-muted/40 cursor-not-allowed select-none"
                  title="Requires Admin role (switch via top-bar to access)"
                >
                  <Icon className="h-4 w-4 shrink-0 text-text-muted/40" />
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1">{item.title}</span>
                      <span className="rounded bg-surface-2 px-1 text-[9px] font-mono text-text-muted/60 border border-border/50">
                        Admin
                      </span>
                    </>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-surface-2 text-text border border-border"
                    : "text-text-muted hover:bg-surface-2/60 hover:text-text"
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-accent" : "text-text-muted group-hover:text-text"
                  )}
                />
                {!collapsed && <span className="truncate flex-1">{item.title}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* System Status Footer */}
      <div className="border-t border-border p-3">
        <div
          className={cn(
            "flex items-center gap-2 rounded-md bg-surface-2/50 border border-border/60 px-2.5 py-2",
            collapsed && "justify-center px-1"
          )}
        >
          <div className="h-2 w-2 rounded-full bg-success shrink-0 animate-pulse" />
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="text-[11px] font-medium text-text">
                Security Active
              </span>
              <span className="text-[10px] font-mono text-text-muted truncate">
                Maker-Checker Enforced
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
