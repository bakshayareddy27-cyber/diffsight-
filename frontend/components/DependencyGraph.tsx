"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { FileCode2, ShieldAlert, TriangleAlert } from "lucide-react";
import { SEVERITY_STYLE } from "@/lib/risk";
import type { GraphNodeData, Report, Severity } from "@/lib/types";

const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 140;

type FileNodeData = {
  name: string;
  dir: string;
  score: number;
  level: Severity;
  breaking: number;
  issues: number;
  active: boolean;
} & Record<string, unknown>;
type FileFlowNode = Node<FileNodeData, "file">;

function FileNodeView({ data }: NodeProps<FileFlowNode>) {
  const style = SEVERITY_STYLE[data.level];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`w-60 cursor-pointer rounded-xl border bg-zinc-900/90 p-3 backdrop-blur ${
        data.active ? "border-violet-400/70 shadow-glow" : "border-white/10"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-zinc-500" />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="h-4 w-4 shrink-0 text-zinc-400" />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm text-zinc-100">{data.name}</p>
            <p className="truncate font-mono text-[11px] text-zinc-500">{data.dir || "."}</p>
          </div>
        </div>
        <span className={`rounded-md px-1.5 py-0.5 font-mono text-xs ring-1 ${style.text} ${style.bg} ${style.ring}`}>
          {Math.round(data.score)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1">
          <TriangleAlert className="h-3 w-3" />
          {data.breaking} breaking
        </span>
        <span className="flex items-center gap-1">
          <ShieldAlert className="h-3 w-3" />
          {data.issues} broken calls
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-zinc-500" />
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
    const maxDepth = Math.max(0, ...report.nodes.map((n) => n.depth));
    const columns = new Map<number, GraphNodeData[]>();
    for (const node of report.nodes) columns.set(node.depth, [...(columns.get(node.depth) ?? []), node]);

    const flowNodes: FileFlowNode[] = report.nodes.map((node) => {
      const column = columns.get(node.depth) ?? [node];
      const slash = node.id.lastIndexOf("/");
      return {
        id: node.id,
        type: "file",
        position: {
          x: (maxDepth - node.depth) * COLUMN_WIDTH,
          y: (column.indexOf(node) - (column.length - 1) / 2) * ROW_HEIGHT,
        },
        data: {
          name: node.id.slice(slash + 1),
          dir: slash >= 0 ? node.id.slice(0, slash) : "",
          score: node.score,
          level: node.level,
          breaking: node.breaking,
          issues: node.issues,
          active: node.id === selected,
        },
      };
    });

    const flowEdges: Edge[] = report.edges.map((edge) => {
      const target = report.nodes.find((n) => n.id === edge.target);
      const color = edge.risky && target ? SEVERITY_STYLE[target.level].hex : "#52525b";
      return {
        id: `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        animated: edge.risky,
        label: edge.symbols.slice(0, 2).join(", "),
        labelStyle: { fill: "#a1a1aa", fontSize: 11, fontFamily: "var(--font-mono)" },
        labelBgStyle: { fill: "#09090b" },
        style: { stroke: color, strokeWidth: edge.risky ? 2 : 1.25 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });
    return { nodes: flowNodes, edges: flowEdges };
  }, [report, selected]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id === selected ? null : node.id)}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.3}
      nodesConnectable={false}
      colorMode="dark"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#27272a" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
