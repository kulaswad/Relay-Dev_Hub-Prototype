"use client";

import React from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { RoleProvider, ActiveUser } from "./RoleContext";
import { Toaster } from "@/components/ui/Toaster";

export interface AppShellProps {
  children: React.ReactNode;
  initialUser: ActiveUser;
  allUsers: ActiveUser[];
  initialApprovalsCount?: number;
}

export function AppShell({
  children,
  initialUser,
  allUsers,
  initialApprovalsCount = 0,
}: AppShellProps) {
  return (
    <RoleProvider
      initialUser={initialUser}
      allUsers={allUsers}
      initialApprovalsCount={initialApprovalsCount}
    >
      <div className="flex h-screen w-screen overflow-hidden bg-background text-text antialiased">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Bar */}
          <TopBar />

          {/* Scrollable Main Content */}
          <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
      <Toaster />
    </RoleProvider>
  );
}
