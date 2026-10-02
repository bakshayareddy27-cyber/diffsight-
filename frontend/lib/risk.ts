import type { Severity } from "./types";

export const SEVERITY_STYLE: Record<
  Severity,
  { label: string; hex: string; text: string; bg: string; ring: string }
> = {
  critical: {
    label: "Critical",
    hex:   "#fb7185",
    text:  "text-rose-300",
    bg:    "bg-rose-500/10",
    ring:  "ring-rose-500/40",
  },
  high: {
    label: "High",
    hex:   "#f59e0b",   // amber — matches editorial theme
    text:  "text-amber-300",
    bg:    "bg-amber-500/10",
    ring:  "ring-amber-500/40",
  },
  medium: {
    label: "Medium",
    hex:   "#fbbf24",
    text:  "text-amber-200",
    bg:    "bg-amber-400/10",
    ring:  "ring-amber-400/30",
  },
  low: {
    label: "Low",
    hex:   "#34d399",
    text:  "text-emerald-300",
    bg:    "bg-emerald-500/10",
    ring:  "ring-emerald-500/40",
  },
  info: {
    label: "Info",
    hex:   "#71717a",   // neutral zinc — keeps matte feel
    text:  "text-zinc-400",
    bg:    "bg-zinc-500/10",
    ring:  "ring-zinc-500/30",
  },
};
