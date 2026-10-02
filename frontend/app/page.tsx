"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  GitPullRequestArrow,
  Loader2,
  Network,
  Play,
  RefreshCw,
} from "lucide-react";
import AgentTimeline from "@/components/AgentTimeline";
import DependencyGraph from "@/components/DependencyGraph";
import RiskViewer from "@/components/RiskViewer";
import ScoreRing from "@/components/ScoreRing";
import { SAMPLE_PR } from "@/lib/sample";
import { useAnalysis } from "@/lib/useAnalysis";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3">
      <p className="font-mono text-xl font-semibold text-zinc-50">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

export default function Page() {
  const { status, agents, report, error, analyze } = useAnalysis();
  const [selected, setSelected] = useState<string | null>(null);
  const busy = status === "connecting" || status === "running";

  const run = () => {
    setSelected(null);
    analyze(SAMPLE_PR);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-glow"
            aria-hidden="true"
          >
            <GitPullRequestArrow className="h-5 w-5 text-zinc-950" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-50">DiffSight</h1>
            <p className="text-xs text-zinc-500">{SAMPLE_PR.title}</p>
          </div>
        </div>

        <button
          onClick={run}
          disabled={busy}
          aria-busy={busy}
          className="flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:bg-violet-400 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : report ? (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          {busy ? "Analyzing…" : report ? "Re-run analysis" : "Analyze pull request"}
        </button>
      </header>

      {/* Agent timeline */}
      <AnimatePresence>
        {status !== "idle" && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <AgentTimeline events={agents} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Analysis error</p>
              <p className="mt-0.5 text-rose-300/80">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle empty state */}
      {status === "idle" && !report && (
        <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-white/10 py-24 text-center">
          <div className="max-w-md space-y-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/30">
              <Network className="h-7 w-7 text-violet-300" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-medium text-zinc-200">Ready to analyze</h2>
              <p className="text-sm text-zinc-400">
                Compare function contracts on the syntax tree, trace every call site through the
                dependency graph, and score merge risk — in milliseconds.
              </p>
            </div>
            <button
              onClick={run}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-300 ring-1 ring-violet-500/40 transition hover:bg-violet-500/30 hover:text-violet-200"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Run sample analysis
            </button>
          </div>
        </div>
      )}

      {/* Report */}
      <AnimatePresence>
        {report && (
          <motion.section
            key="report"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
            aria-label="Analysis report"
          >
            {/* Score summary */}
            <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
              <ScoreRing score={report.score} level={report.level} />
              <div className="min-w-[16rem] flex-1 space-y-4">
                <p className="text-sm leading-relaxed text-zinc-300">{report.verdict}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Stat label="Files" value={report.stats.files} />
                  <Stat label="Symbols compared" value={report.stats.symbols_compared} />
                  <Stat label="Breaking changes" value={report.stats.breaking} />
                  <Stat label="Broken call sites" value={report.stats.broken_calls} />
                  <Stat label="Analysis time" value={`${report.stats.duration_ms} ms`} />
                </div>
              </div>
            </div>

            {/* Graph + risk viewer */}
            <div className="grid gap-6 lg:grid-cols-5">
              <div
                className="h-[560px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 lg:col-span-3"
                aria-label="Dependency graph"
              >
                <DependencyGraph report={report} selected={selected} onSelect={setSelected} />
              </div>
              <div
                className="h-[560px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 lg:col-span-2"
                aria-label="Risk viewer"
              >
                <RiskViewer report={report} selected={selected} onClear={() => setSelected(null)} />
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
