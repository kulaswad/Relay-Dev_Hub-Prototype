"use client";

import React from "react";
import { PlaygroundView } from "@/components/devhub/PlaygroundView";
import { Terminal } from "lucide-react";

export default function ConsolePlaygroundPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-bold text-text">API Request Playground</h1>
        </div>
        <p className="text-xs text-text-muted mt-1">
          Postman-lite interactive request builder against the real Relay sandbox. Select endpoints, customize headers and JSON body, and inspect real-time responses.
        </p>
      </div>

      <PlaygroundView initialRecipe="send_otp" isEvalMode={false} />
    </div>
  );
}
