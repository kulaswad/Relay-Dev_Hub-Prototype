"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepItem {
  id: string | number;
  title: string;
  description?: string;
  duration?: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepperProps) {
  return (
    <div className={cn("w-full py-4", className)}>
      <div className="flex items-center justify-between relative">
        {/* Background track line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-border -z-0" />

        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent = idx === currentStep;
          const isClickable = !!onStepClick;

          return (
            <div
              key={step.id}
              onClick={() => isClickable && onStepClick(idx)}
              className={cn(
                "relative z-10 flex flex-col items-center group",
                isClickable && "cursor-pointer"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all border",
                  isCompleted
                    ? "bg-[#3FB68B] border-[#3FB68B] text-black"
                    : isCurrent
                    ? "bg-accent border-accent text-white shadow-accent-glow"
                    : "bg-surface border-border text-text-muted group-hover:border-text-muted"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
              </div>

              <div className="mt-2 text-center select-none">
                <span
                  className={cn(
                    "text-xs font-medium block whitespace-nowrap",
                    isCurrent ? "text-text font-semibold" : "text-text-muted"
                  )}
                >
                  {step.title}
                </span>
                {step.duration && (
                  <span className="text-[10px] font-mono text-text-muted/70 block">
                    {step.duration}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
