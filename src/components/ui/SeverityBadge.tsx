import { type Severity } from "@/lib/seed";

const styles: Record<Severity, string> = {
  High: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]",
  Medium: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  Low: "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${styles[severity]}`}>
      {severity}
    </span>
  );
}
