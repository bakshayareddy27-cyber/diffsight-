"use client";
import { AnimatePresence, motion, useSpring, useTransform } from "framer-motion";
import { CheckCircle2, ChevronRight, Clock, ShieldAlert } from "lucide-react";
import type { AgentEvent } from "@/lib/types";

// ── SVG icons per agent stage ─────────────────────────────────────────────────
function ParserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 7h6M7 10h4M7 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function ContractIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M5 10h10M5 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function DependencyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="5" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="15" cy="5"  r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="15" cy="15" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7.5 10H10M10 10V5M10 10v5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  );
}
function ImpactIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
function RiskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 3L3 16h14L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 8v4M10 13.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const AGENT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Parser:     ParserIcon,
  Contract:   ContractIcon,
  Dependency: DependencyIcon,
  Impact:     ImpactIcon,
  Risk:       RiskIcon,
};

const AGENTS = ["Parser", "Contract", "Dependency", "Impact", "Risk"] as const;
type AgentName = typeof AGENTS[number];

interface Props { events: AgentEvent[] }

function AnimatedBar({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 120, damping: 20 });
  const width  = useTransform(spring, v => `${v}%`);
  return (
    <div className="h-[2px] w-full rounded-full bg-zinc-800 overflow-hidden">
      <motion.div className="h-full bg-amber-400 rounded-full" style={{ width }} />
    </div>
  );
}

function AgentRow({ name, event, index }: { name: AgentName; event?: AgentEvent; index: number }) {
  const Icon      = AGENT_ICONS[name] ?? RiskIcon;
  const isDone    = event?.status === "done";
  const isRunning = event?.status === "running";
  const isPending = !event;
  const progress  = event?.progress ?? 0;

  const ts = event?.ts
    ? new Date(event.ts * 1000).toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1,  x: 0 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 260, damping: 24 }}
      className={[
        "relative flex items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-300",
        isDone    ? "border-zinc-700/60 bg-[#13141a]" : "",
        isRunning ? "border-amber-500/30 bg-amber-500/5 ds-ring-amber" : "",
        isPending ? "border-zinc-800/50 bg-[#0e0f11] opacity-40" : "",
      ].join(" ")}
    >
      {/* Stage icon */}
      <div className={[
        "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border text-sm",
        isDone    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "",
        isRunning ? "border-amber-500/30  bg-amber-500/10  text-amber-400"    : "",
        isPending ? "border-zinc-800      bg-zinc-900       text-zinc-600"    : "",
      ].join(" ")}>
        {isRunning ? (
          <motion.div animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}>
            <Icon className="h-4 w-4" />
          </motion.div>
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold tracking-wide ${
              isDone ? "text-zinc-200" : isRunning ? "text-amber-300" : "text-zinc-600"
            }`}>{name}</span>
            {isDone    && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
            {isRunning && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400/80 uppercase tracking-widest">
                <span className="ds-pulse h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
                live
              </span>
            )}
          </div>
          {ts && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-600 flex-shrink-0">
              <Clock className="h-2.5 w-2.5" /> {ts}
            </span>
          )}
        </div>

        {event?.message && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-1 text-xs text-zinc-400 leading-relaxed"
          >
            {event.message}
          </motion.p>
        )}

        {isRunning && (
          <div className="mt-2">
            <AnimatedBar value={progress} />
          </div>
        )}
      </div>

      {/* Connector line */}
      {index < AGENTS.length - 1 && (
        <div className="absolute left-[2rem] top-full z-10 h-3 w-px bg-zinc-800" />
      )}
    </motion.div>
  );
}

export default function AgentTimeline({ events }: Props) {
  const byAgent = Object.fromEntries(events.map(e => [e.agent, e]));
  return (
    <div className="ds-panel p-4 space-y-1">
      <div className="flex items-center gap-2 mb-3 px-1">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Analysis Pipeline
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
        <span className="text-xs text-zinc-600">{events.length} / {AGENTS.length} stages</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {AGENTS.map((name, i) => (
            <AgentRow key={name} name={name} event={byAgent[name]} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
