import React from "react";
import { ConsoleSidebar } from "@/components/devhub/ConsoleSidebar";
import { ConsoleHeader } from "@/components/devhub/ConsoleHeader";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-background text-text">
      <ConsoleSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <ConsoleHeader />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
