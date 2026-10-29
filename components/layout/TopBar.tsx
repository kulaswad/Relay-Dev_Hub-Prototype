"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Search,
  ChevronDown,
  Shield,
  UserCheck,
  Check,
  Loader2,
  AlertTriangle,
  CreditCard,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  FileText,
} from "lucide-react";
import { useRole } from "./RoleContext";
import { INTERNAL_ROLES, InternalRole } from "@/lib/permissions/roles";
import { CommandPalette } from "./CommandPalette";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { resetDemoDataAction } from "@/app/actions/admin";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getNotificationsAction, markNotificationReadAction, markAllNotificationsReadAction } from "@/app/actions/notifications";

export function TopBar() {
  const {
    currentUser,
    currentRole,
    roleDefinition,
    allUsers,
    approvalsCount,
    isSwitching,
    switchActiveUser,
  } = useRole();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifFilter, setNotifFilter] = useState<"all" | "approval" | "sla" | "credit">("all");

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      const res = await resetDemoDataAction();
      if (res.success) {
        toast({
          title: "Demo Database Reset",
          description: "Database restored to fresh seeded demo baseline.",
        });
        setResetConfirmOpen(false);
        window.location.reload();
      } else {
        toast({
          title: "Reset Failed",
          description: res.error,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Reset Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const fetchNotifs = () => {
    getNotificationsAction().then((res) => {
      if (res.success && res.data) {
        setNotifications(res.data);
      }
    });
  };

  useEffect(() => {
    fetchNotifs();
  }, [bellOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    await markNotificationReadAction(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const displayedNotifs = notifications.filter((n) => {
    if (notifFilter === "all") return true;
    return n.category === notifFilter;
  });

  return (
    <>
      <header className="flex h-14 w-full items-center justify-between border-b border-border bg-surface px-4 z-10 shrink-0">
        {/* Global Search / Command Palette Trigger & Environment Pill */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text-muted hover:text-text hover:border-border/80 transition-all w-60 md:w-72 justify-between group"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-text-muted group-hover:text-text transition-colors" />
              <span className="truncate">Search accounts, workspaces, actions...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
              <span>⌘</span>K
            </kbd>
          </button>

          {/* Visible Environment Tag */}
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-[11px] font-medium text-warning select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
            <span>Demo - simulated billing and KYC services</span>
          </div>

          {/* Link to Product Notes (/about) */}
          <Link
            href="/about"
            className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-muted hover:text-text hover:border-accent/40 transition-colors"
            title="Product Architecture, Decision Log & Evaluator Guide"
          >
            <FileText className="h-3.5 w-3.5 text-accent" />
            <span>Product Notes</span>
          </Link>
        </div>

        {/* Right side controls: Reset Demo, Role switcher, Approvals Bell, User profile */}
        <div className="flex items-center gap-2.5">
          {/* Reset Demo Data Button (Admin Only) */}
          {currentRole === "admin" && (
            <button
              type="button"
              disabled={isResetting}
              onClick={() => setResetConfirmOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20 transition-colors disabled:opacity-50"
              title="Reset database to seed baseline state"
            >
              <RotateCcw className={cn("h-3.5 w-3.5", isResetting && "animate-spin")} />
              <span>{isResetting ? "Resetting..." : "Reset Demo Data"}</span>
            </button>
          )}
          {/* Role Switcher (Act As Dropdown) */}
          <div className="relative">
            <button
              type="button"
              disabled={isSwitching}
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text hover:bg-surface-hover hover:border-border/80 transition-colors"
            >
              {/* Colored Role Chip */}
              <div
                className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium border"
                style={{
                  backgroundColor: `${roleDefinition.badgeColor}18`,
                  borderColor: `${roleDefinition.badgeColor}40`,
                  color: roleDefinition.badgeColor,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: roleDefinition.badgeColor }}
                />
                <span className="font-semibold">{roleDefinition.label}</span>
              </div>

              {/* User Name */}
              <span className="hidden sm:inline text-xs text-text font-medium truncate max-w-[120px]">
                {currentUser.name}
              </span>

              {isSwitching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
              )}
            </button>

            {roleMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border border-border bg-surface p-2 shadow-2xl animate-in fade-in-0 zoom-in-95">
                <div className="px-2.5 py-2 border-b border-border mb-1.5 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-text uppercase tracking-wider">
                      Demo Auth: Act As Internal User
                    </div>
                    <div className="text-[10px] text-text-muted">
                      Select internal user to evaluate role permissions & maker-checker rules
                    </div>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                  {INTERNAL_ROLES.map((role) => {
                    const usersInRole = allUsers.filter((u) => u.role === role.id);
                    if (usersInRole.length === 0) return null;

                    return (
                      <div key={role.id} className="space-y-0.5">
                        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: role.badgeColor }}
                          />
                          <span>{role.label}</span>
                          <span className="text-[9px] text-text-muted/60 lowercase">
                            ({role.department})
                          </span>
                        </div>

                        {usersInRole.map((u) => {
                          const isCurrent = currentUser.id === u.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                switchActiveUser(u.id);
                                setRoleMenuOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors text-left group",
                                isCurrent
                                  ? "bg-surface-2 text-text font-medium border border-border"
                                  : "text-text hover:bg-surface-hover hover:text-text"
                              )}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-mono font-bold text-white"
                                  style={{ backgroundColor: u.avatarColor || role.badgeColor }}
                                >
                                  {u.name.charAt(0)}
                                </div>
                                <div className="flex flex-col truncate">
                                  <span className="text-xs truncate">{u.name}</span>
                                  <span className="text-[10px] text-text-muted font-mono truncate">
                                    {u.email}
                                  </span>
                                </div>
                              </div>

                              {isCurrent && (
                                <Check className="h-3.5 w-3.5 text-accent shrink-0 ml-1.5" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Notifications & Approvals Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setBellOpen(!bellOpen);
                setRoleMenuOpen(false);
              }}
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 transition-colors",
                bellOpen
                  ? "border-accent text-accent bg-accent/10"
                  : "text-text-muted hover:text-text hover:bg-surface-hover"
              )}
              title="Notifications & Alerts Center"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-white shadow-accent-glow animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-12 z-50 w-96 rounded-xl border border-border bg-surface p-3 shadow-2xl animate-in fade-in-0 zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-2.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-text uppercase tracking-wider">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-accent/20 px-1.5 py-0.2 font-mono text-[10px] font-bold text-accent">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-accent hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 mb-2.5 text-[11px] border-b border-border/50 pb-2">
                  {(["all", "approval", "sla", "credit"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setNotifFilter(tab)}
                      className={cn(
                        "rounded px-2 py-0.5 capitalize transition-colors font-medium",
                        notifFilter === tab
                          ? "bg-accent/20 text-accent font-semibold"
                          : "text-text-muted hover:text-text hover:bg-surface-2"
                      )}
                    >
                      {tab === "all" ? "All" : tab === "sla" ? "SLA Breaches" : tab}
                    </button>
                  ))}
                </div>

                {/* Notification Feed */}
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {displayedNotifs.length === 0 ? (
                    <div className="rounded border border-border/60 bg-surface-2/40 p-6 text-center text-xs text-text-muted italic">
                      No notifications matching this filter.
                    </div>
                  ) : (
                    displayedNotifs.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "group rounded-lg border p-2.5 text-xs transition-colors",
                          item.isRead
                            ? "border-border/60 bg-surface-2/30 opacity-75"
                            : "border-border bg-surface-2 shadow-sm"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            {item.severity === "critical" ? (
                              <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                            ) : item.category === "approval" ? (
                              <Shield className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <Link
                                href={item.link}
                                onClick={() => {
                                  handleMarkRead(item.id);
                                  setBellOpen(false);
                                }}
                                className="font-semibold text-text hover:text-accent transition-colors block truncate"
                              >
                                {item.title}
                              </Link>
                              <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5">
                                {item.message}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted/70">
                                <span>
                                  {new Date(item.createdAt).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <span>•</span>
                                <span className="capitalize">{item.category}</span>
                              </div>
                            </div>
                          </div>

                          {!item.isRead && (
                            <button
                              type="button"
                              onClick={() => handleMarkRead(item.id)}
                              title="Mark read"
                              className="h-2 w-2 rounded-full bg-accent shrink-0 mt-1.5 opacity-80 group-hover:opacity-100"
                            />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="mt-2.5 border-t border-border pt-2 flex items-center justify-between text-[11px]">
                  <Link
                    href="/approvals"
                    onClick={() => setBellOpen(false)}
                    className="text-accent hover:underline flex items-center gap-1 font-medium"
                  >
                    Approvals Queue ({approvalsCount}) <ArrowRight className="h-3 w-3" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setBellOpen(false)}
                    className="text-text-muted hover:text-text"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Reset Demo Data Confirmation Dialog */}
      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="Reset Demo Database?"
        description="This will restore all 42 organizations, 58 workspaces, and ledger balances to the fresh demo baseline. Any testing state modifications will be reset. This action is irreversible."
        confirmLabel="Reset Demo Data"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isResetting}
        onConfirm={handleResetDemo}
      />
    </>
  );
}
