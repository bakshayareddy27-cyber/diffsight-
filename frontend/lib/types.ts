export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface FileVersion {
  path: string;
  base: string;
  head: string;
}

export interface PullRequest {
  title: string;
  files: FileVersion[];
}

export interface Change {
  id: string;
  file: string;
  symbol: string;
  kind: string;
  severity: Severity;
  breaking: boolean;
  message: string;
  base_sig: string | null;
  head_sig: string | null;
  line: number;
  // Vulnerability intelligence
  vuln_category: string | null;
  vuln_reason: string | null;
}

export interface CallIssue {
  id: string;
  change_id: string;
  file: string;
  line: number;
  symbol: string;
  problem: string;
  snippet: string;
}

export interface GraphNodeData {
  id: string;
  depth: number;
  score: number;
  level: Severity;
  breaking: number;
  issues: number;
  vuln_flags: string[];
}

export interface GraphEdgeData {
  source: string;
  target: string;
  symbols: string[];
  risky: boolean;
}

export interface Stats {
  files: number;
  symbols_compared: number;
  breaking: number;
  broken_calls: number;
  duration_ms: number;
  vuln_hits: number;
}

export interface Report {
  title: string;
  score: number;
  level: Severity;
  verdict: string;
  changes: Change[];
  issues: CallIssue[];
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  stats: Stats;
}

export interface AgentEvent {
  type: "agent";
  agent: string;
  status: "running" | "done";
  message: string;
  progress: number;  // 0-100
  ts: number;        // Unix timestamp
}

export type ServerEvent =
  | AgentEvent
  | { type: "report"; report: Report }
  | { type: "error"; message: string; code?: string };
