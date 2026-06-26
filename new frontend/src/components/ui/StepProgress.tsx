"use client";
import { Check } from "lucide-react";

interface Step {
  id: number;
  label: string;
  description?: string;
}

interface StepProgressProps {
  steps: Step[];
  current: number;
}

export function StepProgress({ steps, current }: StepProgressProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = step.id < current;
        const active = step.id === current;
        const last = i === steps.length - 1;
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                done ? 'bg-pink border-pink text-white' :
                active ? 'bg-white border-pink text-pink' :
                'bg-white border-border text-muted'
              }`}>
                {done ? <Check size={14} /> : step.id}
              </div>
              <span className={`text-[10px] font-medium text-center whitespace-nowrap ${active ? 'text-pink' : done ? 'text-navy' : 'text-muted'}`}>
                {step.label}
              </span>
            </div>
            {!last && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${done ? 'bg-pink' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
