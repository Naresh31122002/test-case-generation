import { type StoryStatus } from "@/lib/seed";

interface StatusChipProps {
  status: StoryStatus;
}

const statusStyles: Record<StoryStatus, string> = {
  Draft: "bg-[#F8FAFC] text-[#64748B] border-[#CBD5E1]",
  Analyzing: "bg-[#EFF6FF] text-[#1E40AF] border-[#93C5FD]",
  Ready: "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]",
  "Impact Detected": "bg-brand-primary-light text-brand-primary border-brand-primary",
};

export function StatusChip({ status }: StatusChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyles[status]}`}
    >
      {status === "Analyzing" && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#1E40AF] animate-pulse" />
      )}
      {status}
    </span>
  );
}
