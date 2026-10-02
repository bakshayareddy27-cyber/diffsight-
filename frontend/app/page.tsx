"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle, FileDiff, Play, RefreshCw, ShieldAlert,
} from "lucide-react";
import AgentTimeline   from "@/components/AgentTimeline";
import DependencyGraph from "@/components/DependencyGraph";
import RiskViewer      from "@/components/RiskViewer";
import ScoreRing       from "@/components/ScoreRing";
import { SAMPLE_PR }   from "@/lib/sample";
import { useAnalysis } from "@/lib/useAnalysis";

// ── Custom SVG wordmark ───────────────────────────────────────────────────────
function DiffSightMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="flex-shrink-0">
      <rect width="28" height="28" rx="7" fill="#1a1b22" stroke="#2e2f3a" strokeWidth="1"/>
      <path d="M7 10h6M7 14h10M7 18h8" stroke="#f59e0b" strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M19 8l3 6-3 6" stroke="#10b981" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function Stat({ label, value, accent = false }: {
  label: string; value: string | number; accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl
                    border border-zinc-800 bg-[#13141a] min-w-[90px]">
      <span className={`text-lg font-bold tabular-nums ${accent ? "text-amber-400" : "text-zinc-100"}`}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">
        {label}
      </span>
    </div>
  );
}

// ── Idle hero ─────────────────────────────────────────────────────────────────
function IdleHero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center gap-6 py-20 text-center"
    >
      {/* Technical architecture illustration */}
      <svg width="140" height="110" viewBox="0 0 140 110" fill="none" className="opacity-60">
        {[0,28,56,84,112].map(x =>
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="110" stroke="#1a1b22" strokeWidth="1"/>
        )}
        {[0,22,44,66,88,110].map(y =>
          <line key={`h${y}`} x1="0" y1={y} x2="140" y2={y} stroke="#1a1b22" strokeWidth="1"/>
        )}
        {/* Source node */}
        <rect x="4" y="38" width="52" height="34" rx="6"
          fill="#13141a" stroke="#f59e0b" strokeWidth="1.5"/>
        <text x="12" y="57" fill="#a16207" fontSize="8" fontFamily="monospace" fontWeight="600">
          billing/
        </text>
        <text x="12" y="67" fill="#78716c" fontSize="7" fontFamily="monospace">
          pricing.py
        </text>
        {/* Top dep */}
        <rect x="88" y="12" width="48" height="34" rx="6"
          fill="#13141a" stroke="#3f3f46" strokeWidth="1"/>
        <text x="96" y="31" fill="#52525b" fontSize="7" fontFamily="monospace">api/</text>
        <text x="96" y="41" fill="#52525b" fontSize="7" fontFamily="monospace">orders.py</text>
        {/* Bottom dep */}
        <rect x="88" y="64" width="48" height="34" rx="6"
          fill="#13141a" stroke="#10b981" strokeWidth="1.5"/>
        <text x="96" y="83" fill="#065f46" fontSize="7" fontFamily="monospace">billing/</text>
        <text x="96" y="93" fill="#065f46" fontSize="7" fontFamily="monospace">checkout.py</text>
        {/* Edges */}
        <path d="M56 48 Q72 48 88 29" stroke="#f59e0b" strokeWidth="1.25"
          strokeDasharray="4 3" fill="none"/>
        <path d="M56 55 Q72 55 88 81" stroke="#10b981" strokeWidth="1.25" fill="none"/>
        {/* Score badge */}
        <circle cx="30" cy="14" r="10" fill="#1a1b22" stroke="#f59e0b" strokeWidth="1.25"/>
        <text x="24" y="19" fill="#f59e0b" fontSize="9" fontFamily="monospace" fontWeight="700">72</text>
      </svg>

      <div>
        <p className="text-sm font-semibold text-zinc-400">Ready to analyze</p>
        <p className="mt-1.5 max-w-sm text-xs text-zinc-600 leading-relaxed">
          Compare function contracts on the AST, trace every call site through
          the dependency graph, and score merge risk — in milliseconds.
        </p>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Page() {
  const { status, agents, report, error, analyze } = useAnalysis();
  const [selected, setSelected] = useState<string | null>(null);
  const busy = status === "connecting" || status === "running";

  const run = () => { setSelected(null); analyze(SAMPLE_PR); };

  return (
    <div className="min-h-screen flex flex-col bg-[#0e0f11]">

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#0e0f11]/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <DiffSightMark />
            <span className="text-sm font-bold tracking-tight text-zinc-100">DiffSight</span>
            <span className="hidden sm:block text-xs text-zinc-600 font-mono border border-zinc-800
                             bg-zinc-900 rounded px-1.5 py-0.5 truncate max-w-xs">
              {SAMPLE_PR.title}
            </span>
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }}
            onClick={run} disabled={busy}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800
                       px-4 py-2 text-xs font-semibold text-zinc-200
                       hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-300
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {busy ? (
              <>
                <motion.span animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </motion.span>
                Analyzing…
              </>
            ) : report ? (
              <><RefreshCw className="h-3.5 w-3.5" /> Re-run</>
            ) : (
              <><Play className="h-3.5 w-3.5" /> Analyze</>
            )}
          </motion.button>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-screen-xl flex-1 px-5 py-6 space-y-5">

        {/* Pipeline timeline */}
        <AnimatePresence>
          {status !== "idle" && (
            <motion.div key="timeline"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{    opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 26 }}>
              <AgentTimeline events={agents} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div key="error"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start gap-3 rounded-xl border border-rose-500/30
                         bg-rose-500/8 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-300">Analysis error</p>
                <p className="text-xs text-rose-400/80 mt-0.5">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Idle hero */}
        <AnimatePresence>
          {status === "idle" && !report && <IdleHero key="hero" />}
        </AnimatePresence>

        {/* Report */}
        <AnimatePresence>
          {report && (
            <motion.div key="report"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 24 }}
              className="space-y-5">

              {/* Score + stats */}
              <div className="ds-panel p-5 flex flex-wrap items-center gap-5">
                <ScoreRing score={report.score} level={report.level} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-300 leading-relaxed mb-3">
                    {report.verdict}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Stat label="Files"      value={report.stats.files} />
                    <Stat label="Symbols"    value={report.stats.symbols_compared} />
                    <Stat label="Breaking"   value={report.stats.breaking}
                      accent={report.stats.breaking > 0} />
                    <Stat label="Call sites" value={report.stats.broken_calls}
                      accent={report.stats.broken_calls > 0} />
                    {report.stats.vuln_hits > 0 && (
                      <Stat label="Vuln flags" value={report.stats.vuln_hits} accent />
                    )}
                    <Stat label="Duration" value={`${report.stats.duration_ms}ms`} />
                  </div>
                </div>
              </div>

              {/* Graph + viewer */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">
                <div className="ds-panel" style={{ height: 460 }}>
                  <DependencyGraph report={report} selected={selected} onSelect={setSelected} />
                </div>
                <div className="ds-panel flex flex-col" style={{ height: 460 }}>
                  <RiskViewer report={report} selected={selected}
                    onClear={() => setSelected(null)} />
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 py-3 text-center
                         text-[10px] text-zinc-700 font-mono">
        DiffSight · semantic AST risk analysis ·{" "}
        <a href="https://diffsight.onrender.com" target="_blank" rel="noreferrer"
          className="hover:text-zinc-500 transition-colors">
          diffsight.onrender.com
        </a>
      </footer>
    </div>
  );
}
