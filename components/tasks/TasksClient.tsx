"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDateTimeIST } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";
import { toast } from "@/components/ui/Toaster";
import { updateTaskStatusAction, createOperationalTaskAction } from "@/app/actions/tasks";
import { TaskItem } from "@/lib/services/tasks";
import {
  CheckSquare,
  Clock,
  Sparkles,
  User,
  Building2,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  Play,
  XCircle,
  Calendar,
  X,
  ExternalLink,
} from "lucide-react";

interface TasksClientProps {
  initialTasks: TaskItem[];
  allOrganizations: Array<{ id: string; name: string }>;
  allUsers: Array<{ id: string; name: string; role: string }>;
}

export function TasksClient({
  initialTasks,
  allOrganizations,
  allUsers,
}: TasksClientProps) {
  const { currentUser, currentRole, roleDefinition } = useRole();
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);

  // Filters
  const [viewScope, setViewScope] = useState<"me" | "all">("me");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOrgId, setNewOrgId] = useState(allOrganizations[0]?.id || "");
  const [newAssignedTo, setNewAssignedTo] = useState(currentUser.id);
  const [newDueDays, setNewDueDays] = useState("2");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (viewScope === "me" && t.assignedTo !== currentUser.id) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
    return true;
  });

  const handleStatusChange = async (
    taskId: string,
    newStatus: "pending" | "in_progress" | "completed" | "dismissed"
  ) => {
    try {
      const res = await updateTaskStatusAction(taskId, newStatus);
      if (!res.success) throw new Error(res.error);

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );

      toast({
        title: "Task Updated",
        description: `Task status marked as ${newStatus.replace("_", " ")}.`,
      });
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim().length < 5) {
      toast({
        title: "Title Required",
        description: "Task title must be at least 5 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const due = new Date(Date.now() + Number(newDueDays) * 86400 * 1000);
      const res = await createOperationalTaskAction({
        orgId: newOrgId,
        assignedTo: newAssignedTo,
        title: newTitle.trim(),
        dueAt: due,
        source: "manual",
      });

      if (!res.success) throw new Error(res.error);

      const org = allOrganizations.find((o) => o.id === newOrgId);
      const user = allUsers.find((u) => u.id === newAssignedTo);

      const created: TaskItem = {
        id: res.data?.taskId || `task_${Date.now()}`,
        orgId: newOrgId,
        orgName: org?.name || newOrgId,
        assignedTo: newAssignedTo,
        assignedToName: user?.name || newAssignedTo,
        assignedToRole: user?.role || "internal",
        title: newTitle.trim(),
        source: "manual",
        status: "pending",
        dueAt: due,
      };

      setTasks([created, ...tasks]);
      setShowCreateModal(false);
      setNewTitle("");

      toast({
        title: "Task Created",
        description: `Assigned to ${user?.name || newAssignedTo}.`,
      });
    } catch (err: any) {
      toast({
        title: "Creation Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Due status helper
  const getDueBadge = (dueAt: Date | null | undefined) => {
    if (!dueAt) return <span className="text-text-muted">No deadline</span>;
    const now = Date.now();
    const dueMs = new Date(dueAt).getTime();
    const diffHours = Math.round((dueMs - now) / 3600000);

    if (diffHours < 0) {
      return (
        <span className="rounded bg-danger/20 border border-danger/40 px-1.5 py-0.5 text-[10px] font-bold text-danger font-mono">
          Overdue by {Math.abs(Math.round(diffHours / 24))}d
        </span>
      );
    }
    if (diffHours <= 24) {
      return (
        <span className="rounded bg-warning/20 border border-warning/40 px-1.5 py-0.5 text-[10px] font-bold text-warning font-mono">
          Due in {diffHours}h
        </span>
      );
    }
    return (
      <span className="rounded bg-surface-2 border border-border px-1.5 py-0.5 text-[10px] text-text-muted font-mono">
        Due {new Date(dueAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text">Operational Tasks</h1>
            <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-mono text-accent">
              {filteredTasks.length} Assigned
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Track, prioritize, and resolve action items generated manually or flagged proactively by AI analytics.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent/80 transition-colors self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border">
        {/* Scope Tabs */}
        <div className="flex items-center rounded-md border border-border bg-surface-2 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setViewScope("me")}
            className={`rounded px-3 py-1 transition-colors ${
              viewScope === "me" ? "bg-surface text-text font-semibold shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            Assigned to Me ({tasks.filter((t) => t.assignedTo === currentUser.id).length})
          </button>
          <button
            type="button"
            onClick={() => setViewScope("all")}
            className={`rounded px-3 py-1 transition-colors ${
              viewScope === "all" ? "bg-surface text-text font-semibold shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            All Team Tasks ({tasks.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-border bg-surface-2 px-2.5 py-1 text-xs text-text focus:outline-none focus:border-accent"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="dismissed">Dismissed</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded border border-border bg-surface-2 px-2.5 py-1 text-xs text-text focus:outline-none focus:border-accent"
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual</option>
            <option value="ai_recommendation">AI Recommended</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-12 text-center text-xs text-text-muted italic">
            No operational tasks found for the selected view.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === "completed";
            const isDismissed = task.status === "dismissed";

            return (
              <div
                key={task.id}
                className={`rounded-lg border p-4 transition-all ${
                  isCompleted || isDismissed
                    ? "border-border/60 bg-surface-2/30 opacity-70"
                    : "border-border bg-surface shadow-sm hover:border-border/80"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text text-sm">
                        {task.title}
                      </span>
                      {task.source === "ai_recommendation" && (
                        <span className="flex items-center gap-1 rounded bg-[#7C7CFF]/15 border border-[#7C7CFF]/30 px-1.5 py-0.2 text-[10px] font-bold text-[#7C7CFF]">
                          <Sparkles className="h-2.5 w-2.5" />
                          AI Recommendation
                        </span>
                      )}
                      {getDueBadge(task.dueAt)}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      <Link
                        href={`/accounts/${task.orgId}`}
                        className="flex items-center gap-1 text-text hover:text-accent font-medium transition-colors"
                      >
                        <Building2 className="h-3 w-3 text-text-muted" />
                        <span>{task.orgName}</span>
                      </Link>
                      <span>•</span>
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <User className="h-3 w-3 text-text-muted" />
                        <span>Assigned: {task.assignedToName} ({task.assignedToRole})</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status Dropdown */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {task.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(task.id, "in_progress")}
                        className="flex items-center gap-1 rounded bg-surface-2 border border-border px-2.5 py-1 text-xs text-text hover:bg-surface-hover hover:border-accent transition-colors"
                      >
                        <Play className="h-3 w-3 text-accent" />
                        <span>Start</span>
                      </button>
                    )}

                    {task.status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(task.id, "completed")}
                        className="flex items-center gap-1 rounded bg-success/15 border border-success/30 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/25 transition-colors"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Complete</span>
                      </button>
                    )}

                    {task.status !== "dismissed" && task.status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(task.id, "dismissed")}
                        className="rounded bg-surface-2 border border-border p-1 text-text-muted hover:text-text transition-colors"
                        title="Dismiss task"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold capitalize border ${
                        task.status === "completed"
                          ? "bg-success/15 border-success/30 text-success"
                          : task.status === "in_progress"
                          ? "bg-accent/15 border-accent/30 text-accent"
                          : task.status === "dismissed"
                          ? "bg-surface-2 border-border text-text-muted"
                          : "bg-warning/15 border-warning/30 text-warning"
                      }`}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in-0">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                Create Operational Task
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase mb-1">
                  Target Organization
                </label>
                <select
                  value={newOrgId}
                  onChange={(e) => setNewOrgId(e.target.value)}
                  className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:outline-none focus:border-accent"
                >
                  {allOrganizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase mb-1">
                  Task Title & Action Item
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Call CFO regarding overdue September invoice..."
                  className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted uppercase mb-1">
                    Assignee
                  </label>
                  <select
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:outline-none focus:border-accent"
                  >
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-muted uppercase mb-1">
                    Due Horizon
                  </label>
                  <select
                    value={newDueDays}
                    onChange={(e) => setNewDueDays(e.target.value)}
                    className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text focus:outline-none focus:border-accent"
                  >
                    <option value="1">1 Day (Urgent)</option>
                    <option value="2">2 Days (Standard)</option>
                    <option value="5">5 Days</option>
                    <option value="7">1 Week</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded border border-border bg-surface-2 px-3 py-1.5 font-medium text-text hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded bg-accent px-4 py-1.5 font-semibold text-white hover:bg-accent/80 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
