"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { BarChart3, Activity } from "lucide-react";

export interface DailyUsageRecord {
  date: string; // YYYY-MM-DD
  sms: number;
  rcs: number;
  whatsapp: number;
  totalMessages: number;
  cost: number;
}

export interface WorkspaceUsageRecord {
  date: string;
  wsId: string;
  sms: number;
  rcs: number;
  whatsapp: number;
  cost: number;
}

export interface UsageChartProps {
  dailyTotals: DailyUsageRecord[];
  workspaceUsage: WorkspaceUsageRecord[];
  workspaces: Array<{ id: string; name: string }>;
}

export function UsageChart({
  dailyTotals,
  workspaceUsage,
  workspaces,
}: UsageChartProps) {
  const [timeframe, setTimeframe] = useState<7 | 30 | 90>(30);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("all");

  const filteredData = useMemo(() => {
    let sourceData: DailyUsageRecord[] = [];

    if (selectedWorkspace === "all") {
      sourceData = dailyTotals;
    } else {
      // Filter by workspace and group
      const wsRows = workspaceUsage.filter((w) => w.wsId === selectedWorkspace);
      sourceData = wsRows.map((r) => ({
        date: r.date,
        sms: r.sms,
        rcs: r.rcs,
        whatsapp: r.whatsapp,
        totalMessages: r.sms + r.rcs + r.whatsapp,
        cost: r.cost,
      }));
    }

    // Sort chronologically and take slice
    const sorted = [...sourceData].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-timeframe);
  }, [dailyTotals, workspaceUsage, selectedWorkspace, timeframe]);

  const summary = useMemo(() => {
    let totalSms = 0;
    let totalRcs = 0;
    let totalWa = 0;
    let totalCost = 0;

    for (const d of filteredData) {
      totalSms += d.sms;
      totalRcs += d.rcs;
      totalWa += d.whatsapp;
      totalCost += d.cost;
    }

    const totalMsgs = totalSms + totalRcs + totalWa;
    return {
      totalMsgs,
      totalSms,
      totalRcs,
      totalWa,
      totalCost,
      dailyAverage: filteredData.length > 0 ? Math.round(totalMsgs / filteredData.length) : 0,
    };
  }, [filteredData]);

  if (filteredData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-12 text-center">
        <Activity className="h-8 w-8 text-text-muted/40 mb-2" />
        <p className="text-sm font-medium text-text">No Traffic Logged</p>
        <p className="text-xs text-text-muted mt-1 max-w-sm">
          This account is either newly onboarded or has not yet dispatched messages across SMS, RCS, or WhatsApp gateways.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 border border-accent/30 text-accent">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text">Omnichannel Message Delivery</h3>
            <p className="text-[11px] text-text-muted">
              Stacked volume across SMS, RCS, and WhatsApp channels
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Workspace Filter Dropdown */}
          {workspaces.length > 1 && (
            <select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs text-text focus:border-accent focus:outline-none"
            >
              <option value="all">All Workspaces ({workspaces.length})</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          )}

          {/* Timeframe Toggles (7d, 30d, 90d) */}
          <div className="flex items-center rounded-md border border-border bg-surface-2 p-0.5">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setTimeframe(days as any)}
                className={cn(
                  "rounded px-2.5 py-0.5 text-xs font-medium transition-colors font-mono",
                  timeframe === days
                    ? "bg-accent/20 text-accent font-semibold"
                    : "text-text-muted hover:text-text"
                )}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded border border-border bg-surface-2 p-2.5">
          <span className="text-[10px] uppercase font-semibold text-text-muted">Total Volume</span>
          <div className="font-mono text-sm font-semibold text-text mt-0.5">
            {summary.totalMsgs.toLocaleString("en-IN")} msgs
          </div>
        </div>
        <div className="rounded border border-border bg-surface-2 p-2.5">
          <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-text-muted">
            <span>WhatsApp</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#5B9DFF]" />
          </div>
          <div className="font-mono text-sm font-semibold text-[#5B9DFF] mt-0.5">
            {summary.totalWa.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded border border-border bg-surface-2 p-2.5">
          <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-text-muted">
            <span>RCS</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#3FB68B]" />
          </div>
          <div className="font-mono text-sm font-semibold text-[#3FB68B] mt-0.5">
            {summary.totalRcs.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded border border-border bg-surface-2 p-2.5">
          <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-text-muted">
            <span>SMS</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#7C7CFF]" />
          </div>
          <div className="font-mono text-sm font-semibold text-[#7C7CFF] mt-0.5">
            {summary.totalSms.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Recharts Stacked Bar Chart */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#232328" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#8B8B93"
              fontSize={10}
              tickLine={false}
              tickFormatter={(d) => {
                const parts = d.split("-");
                return `${parts[2]}/${parts[1]}`;
              }}
            />
            <YAxis
              stroke="#8B8B93"
              fontSize={10}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as DailyUsageRecord;
                return (
                  <div className="rounded-lg border border-border bg-surface p-3 text-xs shadow-xl space-y-1.5 font-mono">
                    <div className="font-semibold text-text border-b border-border/60 pb-1">
                      {label}
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[#5B9DFF]">
                      <span>WhatsApp:</span>
                      <span className="font-bold">{d.whatsapp.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[#3FB68B]">
                      <span>RCS:</span>
                      <span className="font-bold">{d.rcs.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[#7C7CFF]">
                      <span>SMS:</span>
                      <span className="font-bold">{d.sms.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="border-t border-border/60 pt-1 flex items-center justify-between gap-4 text-text font-bold">
                      <span>Total Spend:</span>
                      <span>{formatINR(d.cost)}</span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="whatsapp" name="WhatsApp" stackId="a" fill="#5B9DFF" radius={[0, 0, 0, 0]} />
            <Bar dataKey="rcs" name="RCS" stackId="a" fill="#3FB68B" radius={[0, 0, 0, 0]} />
            <Bar dataKey="sms" name="SMS" stackId="a" fill="#7C7CFF" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
