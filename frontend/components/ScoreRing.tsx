"use client";
import { motion } from "framer-motion";
import { SEVERITY_STYLE } from "@/lib/risk";
import type { Severity } from "@/lib/types";

const RADIUS       = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const RING_CLASS: Record<Severity, string> = {
  critical: "ds-ring-rose",
  high:     "ds-ring-amber",
  medium:   "ds-ring-amber",
  low:      "ds-ring-emerald",
  info:     "",
};

interface Props { score: number; level: Severity }

export default function ScoreRing({ score, level }: Props) {
  const style      = SEVERITY_STYLE[level];
  const clamped    = Math.max(0, Math.min(100, score));
  const dashOffset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className={`relative inline-flex items-center justify-center rounded-full p-1 ${RING_CLASS[level]}`}>
      <svg width="108" height="108" viewBox="0 0 108 108">
        {/* Track */}
        <circle cx="54" cy="54" r={RADIUS} fill="none"
          stroke="#1a1b22" strokeWidth="8" />
        {/* Animated progress arc */}
        <motion.circle
          cx="54" cy="54" r={RADIUS}
          fill="none"
          stroke={style.hex}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.1, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ transformOrigin: "54px 54px", transform: "rotate(-90deg)" }}
        />
      </svg>
      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 20 }}
          className={`text-2xl font-bold tabular-nums ${style.text}`}
        >
          {Math.round(clamped)}
        </motion.span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mt-0.5">
          {style.label}
        </span>
      </div>
    </div>
  );
}
