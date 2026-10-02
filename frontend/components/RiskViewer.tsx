"use client";
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileDiff, MapPin, Minus, Plus, ShieldAlert, TriangleAlert, X, Zap } from "lucide-react";
import { SEVERITY_STYLE } from "@/lib/risk";
import type { CallIssue, Change, Report } from "@/lib/types";

function SigLine({ sig, added }: { sig: string; added: boolean }) {
  const Icon = added ? Plus : Minus;
  const tone = added
    ? "bg-emerald-500/10 border-l-2 border-emerald-500/60 text-emerald-200"
    : "bg-rose-500/10    border-l-2 border-rose-500/60    text-rose-200";
  return (
    <div className={`flex items-start gap-2 rounded-r-md px-3 py-1.5 text-xs font-mono ${tone}`}>
      <Icon className="mt-0.5 h-3 w-3 flex-shrink-0" />
      <code className="whitespace-pre-wrap break-all">{sig}</code>
    </div>
  );
}

function VulnBadge({ category }: { category: string }) {
  const icons: Record<string, React.FC<{ className?: string }>> = {
    security:     ({ className }) => <ShieldAlert   className={className} />,
    injection:    ({ className }) => <Zap           className={className} />,
    data_exposure:({ className }) => <FileDiff      className={className} />,
  };
  const Icon = icons[category] ?? ShieldAlert;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30
                     bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold
                     uppercase tracking-wider text-amber-400">
      <Icon className="h-2.5 w-2.5" />
      {category.replace("_", " ")}
    </span>
  );
}

function ChangeCard({ change, issues }: { change: Change; issues: CallIssue[] }) {
  const style = SEVERITY_STYLE[change.severity];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1,  y: 0 }}
      exit={{    opacity: 0,  y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="rounded-xl border border-zinc-800 bg-[#13141a] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-zinc-800/60">
        <span className={`mt-0.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${style.text} ${style.bg} border-current/20`}>
          {style.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100 font-mono">
              {change.symbol || "—"}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              {change.kind.replace(/_/g, " ")}
            </span>
            {change.breaking && (
              <span className="rounded-md bg-rose-500/10 border border-rose-500/30
                               px-1.5 py-0.5 text-[9px] font-semibold uppercase
                               tracking-wider text-rose-400">
                Breaking
              </span>
            )}
            {change.vuln_category && <VulnBadge category={change.vuln_category} />}
          </div>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{change.message}</p>
        </div>
      </div>

      {/* Diff visualiser */}
      {(change.base_sig || change.head_sig) && (
        <div className="px-4 py-2.5 space-y-1 bg-[#0e0f11]">
          {change.base_sig && <SigLine sig={change.base_sig} added={false} />}
          {change.head_sig && <SigLine sig={change.head_sig} added={true}  />}
        </div>
      )}

      {/* Location */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-t border-zinc-800/40">
        <MapPin className="h-3 w-3 text-zinc-600 flex-shrink-0" />
        <span className="text-[10px] font-mono text-zinc-500">
          {change.file}:{change.line}
        </span>
      </div>

      {/* Broken call sites */}
      {issues.length > 0 && (
        <div className="border-t border-zinc-800/40 bg-rose-500/5 px-4 py-2.5 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-400">
            {issues.length} broken call site{issues.length > 1 ? "s" : ""}
          </p>
          {issues.map(issue => (
            <div key={issue.id}
              className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
              <div className="text-[10px] font-mono text-zinc-500 mb-1">
                {issue.file}:{issue.line}
              </div>
              {issue.snippet && (
                <code className="block text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all mb-1">
                  {issue.snippet}
                </code>
              )}
              <p className="text-[10px] text-rose-400">{issue.problem}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

interface Props { report: Report; selected: string | null; onClear: () => void }

export default function RiskViewer({ report, selected, onClear }: Props) {
  const byChange = useMemo(() => {
    const map = new Map<string, CallIssue[]>();
    for (const issue of report.issues)
      map.set(issue.change_id, [...(map.get(issue.change_id) ?? []), issue]);
    return map;
  }, [report.issues]);

  const visible = useMemo(
    () => report.changes.filter(c =>
      !selected || c.file === selected ||
      (byChange.get(c.id) ?? []).some(i => i.file === selected),
    ),
    [report.changes, byChange, selected],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileDiff className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Contract Changes
          </span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
            {visible.length}
          </span>
        </div>
        {selected && (
          <button onClick={onClear}
            className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/50
                       px-2.5 py-1 text-[10px] text-zinc-400 hover:text-zinc-100
                       hover:border-zinc-600 transition-colors">
            <X className="h-3 w-3" /> {selected.split("/").pop()}
          </button>
        )}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {visible.map(change => (
            <ChangeCard key={change.id} change={change}
              issues={byChange.get(change.id) ?? []} />
          ))}
          {visible.length === 0 && (
            <motion.p key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center text-sm text-zinc-600 py-8">
              No contract changes in this selection.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
