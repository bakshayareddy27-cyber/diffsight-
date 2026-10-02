"use client";

import { motion } from "framer-motion";
import { SEVERITY_STYLE } from "@/lib/risk";
import type { Severity } from "@/lib/types";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  score: number;
  level: Severity;
}

export default function ScoreRing({ score, level }: Props) {
  const style = SEVERITY_STYLE[level];
  const clampedScore = Math.max(0, Math.min(100, score));
  const dashOffset = CIRCUMFERENCE * (1 - clampedScore / 100);

  return (
    <div
      className="relative h-28 w-28 shrink-0"
      role="img"
      aria-label={`Risk score: ${Math.round(clampedScore)} (${style.label})`}
    >
      <svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden="true">
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke="#27272a"
          strokeWidth="8"
        />
        {/* Progress */}
        <motion.circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={style.hex}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="font-mono text-2xl font-semibold tabular-nums text-zinc-50">
          {Math.round(clampedScore)}
        </span>
        <span className={`text-[10px] uppercase tracking-widest ${style.text}`}>
          {style.label}
        </span>
      </div>
    </div>
  );
}
