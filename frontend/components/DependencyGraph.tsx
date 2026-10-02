"use client";
import { useCallback, useMemo } from "react";
import {
  Background, BackgroundVariant, Controls, Handle,
  MarkerType, MiniMap, Position, ReactFlow,
  type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { FileCode2, ShieldAlert, TriangleAlert, Zap } from "lucide-react";
import { SEVERITY_STYLE } from "@/lib/risk";
import type { GraphNodeData, Report, Severity } from "@/lib/types";

const COLUMN_WIDTH = 300;
const ROW_HEIGHT   = 155;

type FileNodeFlowData = {
  name: string; dir: string; score: number;
  level: Severity; breaking: number; issues: number;
  active: boolean; vuln_flags: string[];
} & Record<string, unknown>;

type FileFlowNode = Node<FileNodeFlowData>;

function VulnBadge({ flag }: { flag: string }) {
  const icons: Record<string, React.FC<{ className?: string }>> = {
    security:     ({ className }) => <ShieldAlert   className={className} />,
    injection:    ({ className }) => <Zap           className={className} />,
    data_exposure:({ className }) => <TriangleAlert className={className} />,
  };
  const Icon = icons[flag] ?? ShieldAlert;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-500/30
                     bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold
                     uppercase tracking-wider text-amber-400">
      <Icon className="h-2.5 w-2.5" />
      {flag.replace("_", " ")}
    </span>
  );
}

function FileNodeView({ data }: NodeProps<FileFlowNode>) {
  const style   = SEVERITY_STYLE[data.level];
  const hasVuln = data.vuln_flags && data.vuln_flags.length > 0;

  return (
    <motion.div
      initial={{ scale: 0.88, opacity: 0 }}
      animate={{ scale: 1,    opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={[
        "relative w-[232px] rounded-xl border px-3.5 py-3 cursor-pointer",
        "transition-all duration-200 select-none",
        data.active
          ? "border-amber-500/60 bg-[#1a1b22] ds-ring-amber"
          : "border-zinc-700/50 bg-[#13141a] hover:border-zinc-600",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left}
        className="!bg-zinc-700 !border-zinc-600 !w-2 !h-2" />

      {/* File identity */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border ${style.bg}`}>
          <FileCode2 className={`h-3.5 w-3.5 ${style.text}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-100 leading-tight truncate">{data.name}</p>
          <p className="text-[10px] text-zinc-500 font-mono truncate">{data.dir || "."}</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-2 h-1 w-full rounded-full bg-zinc-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${data.score}%` }}
          transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full bg-current"
          style={{ color: style.hex }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[11px]">
        <span className={`font-mono font-bold text-base ${style.text}`}>
          {Math.round(data.score)}
        </span>
        <div className="flex gap-2">
          {data.breaking > 0 && (
            <span className="flex items-center gap-0.5 text-rose-400 font-medium">
              <TriangleAlert className="h-3 w-3" /> {data.breaking}
            </span>
          )}
          {data.issues > 0 && (
            <span className="text-orange-400 font-medium">{data.issues} calls</span>
          )}
        </div>
      </div>

      {/* Vulnerability flags */}
      {hasVuln && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.vuln_flags.map(flag => <VulnBadge key={flag} flag={flag} />)}
        </div>
      )}

      <Handle type="source" position={Position.Right}
        className="!bg-zinc-700 !border-zinc-600 !w-2 !h-2" />
    </motion.div>
  );
}

const nodeTypes = { file: FileNodeView };

interface Props {
  report: Report;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export default function DependencyGraph({ report, selected, onSelect }: Props) {
  const { nodes, edges } = useMemo(() => {
    const maxDepth = Math.max(0, ...report.nodes.map(n => n.depth));
    const columns  = new Map<number, typeof report.nodes>();
    for (const node of report.nodes)
      columns.set(node.depth, [...(columns.get(node.depth) ?? []), node]);

    const flowNodes: FileFlowNode[] = report.nodes.map(node => {
      const column = columns.get(node.depth) ?? [node];
      const slash  = node.id.lastIndexOf("/");
      return {
        id: node.id, type: "file",
        position: {
          x: (maxDepth - node.depth) * COLUMN_WIDTH,
          y: (column.indexOf(node) - (column.length - 1) / 2) * ROW_HEIGHT,
        },
        data: {
          name:       node.id.slice(slash + 1),
          dir:        slash >= 0 ? node.id.slice(0, slash) : "",
          score:      node.score,
          level:      node.level,
          breaking:   node.breaking,
          issues:     node.issues,
          active:     node.id === selected,
          vuln_flags: node.vuln_flags ?? [],
        },
      };
    });

    const flowEdges: Edge[] = report.edges.map(edge => {
      const target = report.nodes.find(n => n.id === edge.target);
      const color  = edge.risky && target ? SEVERITY_STYLE[target.level].hex : "#3f3f46";
      return {
        id: `${edge.source}->${edge.target}`,
        source: edge.source, target: edge.target,
        animated: edge.risky,
        label: edge.symbols.slice(0, 2).join(", "),
        labelStyle:   { fill: "#71717a", fontSize: 10, fontFamily: "var(--font-mono)" },
        labelBgStyle: { fill: "#0e0f11", rx: 4 },
        style: { stroke: color, strokeWidth: edge.risky ? 2 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [report, selected]);

  const onNodeClick = useCallback(
    (_: unknown, node: FileFlowNode) => onSelect(node.id === selected ? null : node.id),
    [selected, onSelect],
  );

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-zinc-800 bg-[#0e0f11]">
      <ReactFlow
        nodes={nodes} edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => onSelect(null)}
        fitView fitViewOptions={{ padding: 0.3 }}
        minZoom={0.25}
        nodesConnectable={false}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1f2028" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={n => SEVERITY_STYLE[(n.data as FileNodeFlowData).level]?.hex ?? "#3f3f46"}
          maskColor="rgba(14,15,17,0.85)"
        />
      </ReactFlow>
    </div>
  );
}
