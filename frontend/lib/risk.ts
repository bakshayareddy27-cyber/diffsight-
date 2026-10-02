import type { Severity } from "./types";

export const SEVERITY_STYLE: Record<
  Severity,
  { label: string; hex: string; text: string; bg: string; ring: string }
> = {
  critical: { label: "Critical", hex: "#fb7185", text: "text-rose-300", bg: "bg-rose-500/10", ring: "ring-rose-500/40" },
  high: { label: "High", hex: "#fb923c", text: "text-orange-300", bg: "bg-orange-500/10", ring: "ring-orange-500/40" },
  medium: { label: "Medium", hex: "#fbbf24", text: "text-amber-300", bg: "bg-amber-500/10", ring: "ring-amber-500/40" },
  low: { label: "Low", hex: "#34d399", text: "text-emerald-300", bg: "bg-emerald-500/10", ring: "ring-emerald-500/40" },
  info: { label: "Info", hex: "#38bdf8", text: "text-sky-300", bg: "bg-sky-500/10", ring: "ring-sky-500/40" },
};
