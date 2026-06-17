"use client";

import { motion } from "framer-motion";
import { Upload, Sparkles, Zap, CheckCircle2, type LucideIcon } from "lucide-react";
import { type Story } from "@/lib/seed";
import { staggerContainer, fadeInUp } from "@/lib/motion";

interface TimelineEvent {
  label: string;
  detail: string;
  icon: LucideIcon;
  done: boolean;
  color: string;
}

/** Derive the version timeline from existing story state. */
function buildTimeline(story: Story): TimelineEvent[] {
  return [
    {
      label: "Story Uploaded",
      detail: `${story.version} · ${story.lastUpdated}`,
      icon: Upload,
      done: true,
      color: "#06B6D4",
    },
    {
      label: "Tests Generated",
      detail:
        story.testCount > 0
          ? `${story.testCount} tests created`
          : "Not yet generated",
      icon: Sparkles,
      done: story.testCount > 0,
      color: "#10B981",
    },
    {
      label: "Impact Detected",
      detail:
        story.impactCount > 0
          ? `${story.impactCount} tests impacted`
          : "No impact detected",
      icon: Zap,
      done: story.impactCount > 0,
      color: "#FF0A78",
    },
    {
      label: "Changes Approved",
      detail:
        story.status === "Ready"
          ? "All changes approved"
          : "Pending review",
      icon: CheckCircle2,
      done: story.status === "Ready",
      color: "#10B981",
    },
  ];
}

export function VersionTimeline({ story }: { story: Story }) {
  const events = buildTimeline(story);

  return (
    <motion.div
      variants={fadeInUp}
      className="bg-white border border-border rounded-card p-5"
    >
      <h3 className="text-[15px] font-semibold text-navy mb-4">Version Timeline</h3>
      <motion.ol
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="relative"
      >
        {events.map((ev, i) => {
          const Icon = ev.icon;
          const isLast = i === events.length - 1;
          return (
            <motion.li
              key={ev.label}
              variants={fadeInUp}
              className="relative flex items-start gap-3 pb-5 last:pb-0"
            >
              {/* Connector line */}
              {!isLast && (
                <span
                  className="absolute left-[15px] top-8 bottom-0 w-px"
                  style={{ backgroundColor: ev.done ? ev.color + "40" : "#E2E8F0" }}
                />
              )}
              {/* Node */}
              <span
                className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2"
                style={{
                  backgroundColor: ev.done ? ev.color + "1A" : "#F8FAFC",
                  borderColor: ev.done ? ev.color : "#E2E8F0",
                  color: ev.done ? ev.color : "#94A3B8",
                }}
              >
                <Icon size={15} />
              </span>
              {/* Text */}
              <div className="flex-1 pt-1">
                <p
                  className={`text-sm font-medium ${
                    ev.done ? "text-navy" : "text-muted"
                  }`}
                >
                  {ev.label}
                </p>
                <p className="text-xs text-muted mt-0.5">{ev.detail}</p>
              </div>
              {ev.done && (
                <span className="text-[10px] font-semibold text-success mt-1.5">
                  Done
                </span>
              )}
            </motion.li>
          );
        })}
      </motion.ol>
    </motion.div>
  );
}
