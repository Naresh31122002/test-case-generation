"use client";
import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface EmptyPageStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void; href?: string };
  secondaryAction?: { label: string; onClick: () => void; href?: string };
  tips?: string[];
  variant?: "default" | "search" | "filtered";
}

export function EmptyPageState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  tips,
  variant = "default",
}: EmptyPageStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center px-6 py-16 max-w-md mx-auto"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink/10 to-cyan/10 flex items-center justify-center mb-5 border border-border">
        <Icon size={28} className="text-pink" />
      </div>
      <h3 className="text-lg font-semibold text-navy mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed mb-6">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          {primaryAction && (
            primaryAction.href ? (
              <a href={primaryAction.href} className="inline-flex items-center justify-center h-10 px-6 rounded-btn bg-pink text-white text-sm font-semibold hover:bg-pink/90 transition-colors">
                {primaryAction.label}
              </a>
            ) : (
              <button onClick={primaryAction.onClick} className="inline-flex items-center justify-center h-10 px-6 rounded-btn bg-pink text-white text-sm font-semibold hover:bg-pink/90 transition-colors">
                {primaryAction.label}
              </button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <a href={secondaryAction.href} className="inline-flex items-center justify-center h-10 px-6 rounded-btn border border-border text-navy text-sm font-medium hover:bg-gray-50 transition-colors">
                {secondaryAction.label}
              </a>
            ) : (
              <button onClick={secondaryAction.onClick} className="inline-flex items-center justify-center h-10 px-6 rounded-btn border border-border text-navy text-sm font-medium hover:bg-gray-50 transition-colors">
                {secondaryAction.label}
              </button>
            )
          )}
        </div>
      )}
      {tips && tips.length > 0 && (
        <div className="mt-8 w-full">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-3">How it works</p>
          <div className="space-y-2">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5 text-left p-3 rounded-lg bg-gray-50 border border-border">
                <span className="w-5 h-5 rounded-full bg-pink/10 text-pink text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-xs text-navy leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
