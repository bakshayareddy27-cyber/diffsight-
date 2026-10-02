"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileDiff, MapPin, Minus, Plus, X } from "lucide-react";
import { SEVERITY_STYLE } from "@/lib/risk";
import type { CallIssue, Change, Report } from "@/lib/types";

function SigLine({ sig, added }: { sig: string; added: boolean }) {
  const Icon = added ? Plus : Minus;
  const tone = added ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200";
  return (
    <div className={`flex items-start gap-2 rounded-md px-3 py-2 font-mono text-xs ${tone}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <code className="whitespace-pre-wrap break-all">{sig}</code>
    </div>
  );
}

function ChangeCard({ change, issues }: { change: Change; issues: CallIssue[] }) {
  const style = SEVERITY_STYLE[change.severity];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="space-y-3 rounded-xl border border-white/10 bg-zinc-900/60 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${style.text} ${style.bg} ${style.ring}`}>
          {style.label}
        </span>
        <span className="font-mono text-sm text-zinc-100">{change.symbol}</span>
        <span className="text-xs capitalize text-zinc-500">{change.kind.replace(/_/g, " ")}</span>
        {change.breaking && <span className="ml-auto text-[11px] font-medium uppercase tracking-wide text-rose-300">Breaking</span>}
      </div>
      <p className="text-sm text-zinc-400">{change.message}</p>
      <div className="space-y-1.5">
        {change.base_sig && <SigLine sig={change.base_sig} added={false} />}
        {change.head_sig && <SigLine sig={change.head_sig} added />}
      </div>
      <p className="flex items-center gap-1 font-mono text-[11px] text-zinc-500">
        <MapPin className="h-3 w-3" />
        {change.file}:{change.line}
      </p>
      {issues.length > 0 && (
        <ul className="space-y-2 border-t border-white/10 pt-3">
          {issues.map((issue) => (
            <li key={issue.id} className="rounded-lg bg-zinc-950/70 p-3">
              <p className="flex items-center gap-1 font-mono text-[11px] text-zinc-500">
                <MapPin className="h-3 w-3" />
                {issue.file}:{issue.line}
              </p>
              <code className="mt-1 block break-all font-mono text-xs text-zinc-200">{issue.snippet}</code>
              <p className="mt-1 text-xs text-rose-300">{issue.problem}</p>
            </li>
          ))}
        </ul>
      )}
    </motion.article>
  );
}

interface Props {
  report: Report;
  selected: string | null;
  onClear: () => void;
}

export default function RiskViewer({ report, selected, onClear }: Props) {
  const byChange = useMemo(() => {
    const map = new Map<string, CallIssue[]>();
    for (const issue of report.issues) map.set(issue.change_id, [...(map.get(issue.change_id) ?? []), issue]);
    return map;
  }, [report.issues]);

  const visible = useMemo(
    () =>
      report.changes.filter(
        (c) => !selected || c.file === selected || (byChange.get(c.id) ?? []).some((i) => i.file === selected),
      ),
    [report.changes, byChange, selected],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
          <FileDiff className="h-4 w-4 text-violet-300" />
          Smart diff risk
          <span className="font-mono text-xs text-zinc-500">{visible.length}</span>
        </h2>
        {selected && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 font-mono text-[11px] text-zinc-300 hover:bg-zinc-700"
          >
            {selected}
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <AnimatePresence mode="popLayout">
          {visible.map((change) => (
            <ChangeCard key={change.id} change={change} issues={byChange.get(change.id) ?? []} />
          ))}
        </AnimatePresence>
        {visible.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">No contract changes in this selection.</p>}
      </div>
    </div>
  );
}
