import React from "react";
import { PublicNavbar } from "@/components/devhub/PublicNavbar";
import { DocsSidebar } from "@/components/devhub/DocsSidebar";
import { DocTOC } from "@/components/devhub/DocTOC";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-text">
      <PublicNavbar />
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        <DocsSidebar />
        <div className="flex-1 flex justify-between p-6 md:p-10 min-w-0 gap-8">
          <main className="flex-1 max-w-3xl min-w-0 space-y-8">
            {children}
          </main>
          <DocTOC />
        </div>
      </div>
    </div>
  );
}
