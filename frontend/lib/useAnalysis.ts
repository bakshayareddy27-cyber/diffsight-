"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, PullRequest, Report, ServerEvent } from "./types";

export type Status = "idle" | "connecting" | "running" | "done" | "error";

/**
 * Resolve the WebSocket URL.
 * Priority: NEXT_PUBLIC_WS_URL env var → wss://diffsight.onrender.com/ws/analyze
 */
function resolveWsUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (envUrl) return envUrl;
  return "wss://diffsight.onrender.com/ws/analyze";
}

export function useAnalysis() {
  const socketRef = useRef<WebSocket | null>(null);
  const [status,  setStatus]  = useState<Status>("idle");
  const [agents,  setAgents]  = useState<AgentEvent[]>([]);
  const [report,  setReport]  = useState<Report | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const analyze = useCallback((pr: PullRequest) => {
    socketRef.current?.close();
    setStatus("connecting");
    setAgents([]);
    setReport(null);
    setError(null);

    const wsUrl = resolveWsUrl();
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      setError(`Failed to open WebSocket to ${wsUrl}: ${err}`);
      setStatus("error");
      return;
    }
    socketRef.current = ws;
    const isCurrent = () => socketRef.current === ws;

    ws.onopen = () => {
      if (!isCurrent()) return;
      setStatus("running");
      ws.send(JSON.stringify(pr));
    };

    ws.onmessage = (msg: MessageEvent) => {
      if (!isCurrent()) return;
      let event: ServerEvent;
      try {
        event = JSON.parse(msg.data as string) as ServerEvent;
      } catch {
        setError("Received malformed data from server.");
        setStatus("error");
        ws.close();
        return;
      }
      if (event.type === "agent") {
        setAgents(prev =>
          prev.some(a => a.agent === event.agent)
            ? prev.map(a => (a.agent === event.agent ? event : a))
            : [...prev, event],
        );
      } else if (event.type === "report") {
        setReport(event.report);
        setStatus("done");
        ws.close();
      } else {
        setError(event.message);
        setStatus("error");
        ws.close();
      }
    };

    ws.onerror = () => {
      if (!isCurrent()) return;
      setError(`Cannot reach DiffSight backend at ${wsUrl}. Ensure it is running.`);
      setStatus("error");
    };

    ws.onclose = (ev: CloseEvent) => {
      if (!isCurrent()) return;
      if (ev.code !== 1000 && ev.code !== 1001) {
        setStatus(prev => (prev === "running" ? "error" : prev));
        if (!ev.wasClean) {
          setError(prev => prev ?? "Connection closed unexpectedly.");
        }
      }
    };
  }, []);

  useEffect(() => () => { socketRef.current?.close(1000, "unmount"); }, []);

  return { status, agents, report, error, analyze };
}
