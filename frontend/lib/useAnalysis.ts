"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, PullRequest, Report, ServerEvent } from "./types";

export type Status = "idle" | "connecting" | "running" | "done" | "error";

/**
 * Resolve the WebSocket URL.
 * - In production (Render), set NEXT_PUBLIC_WS_URL as an env var.
 * - Falls back to replacing the current page's http(s) origin with ws(s).
 * - Final fallback: ws://localhost:8000/ws/analyze for local dev.
 */
function resolveWsUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (envUrl) return envUrl;

  // Browser-only: derive from current origin so the app works on any host
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = 8000;
    return `${proto}//${host}:${port}/ws/analyze`;
  }

  return "ws://localhost:8000/ws/analyze";
}

export function useAnalysis() {
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [agents, setAgents] = useState<AgentEvent[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback((pr: PullRequest) => {
    // Close any existing socket before starting a new one
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
      setError(`Failed to create WebSocket connection to ${wsUrl}: ${err}`);
      setStatus("error");
      return;
    }

    socketRef.current = ws;
    // Capture a stable reference so stale closures don't act on an old socket
    const isCurrent = () => socketRef.current === ws;

    ws.onopen = () => {
      if (!isCurrent()) return;
      setStatus("running");
      ws.send(JSON.stringify(pr));
    };

    ws.onmessage = (message: MessageEvent) => {
      if (!isCurrent()) return;
      let event: ServerEvent;
      try {
        event = JSON.parse(message.data as string) as ServerEvent;
      } catch {
        setError("Received malformed data from server.");
        setStatus("error");
        ws.close();
        return;
      }

      if (event.type === "agent") {
        setAgents((prev) =>
          prev.some((a) => a.agent === event.agent)
            ? prev.map((a) => (a.agent === event.agent ? event : a))
            : [...prev, event],
        );
      } else if (event.type === "report") {
        setReport(event.report);
        setStatus("done");
        ws.close();
      } else {
        // event.type === "error"
        setError(event.message);
        setStatus("error");
        ws.close();
      }
    };

    ws.onerror = () => {
      if (!isCurrent()) return;
      setError(
        `Cannot reach the DiffSight backend at ${wsUrl}. Make sure the backend is running.`,
      );
      setStatus("error");
    };

    ws.onclose = (ev: CloseEvent) => {
      if (!isCurrent()) return;
      // Only move to error if we closed unexpectedly while still running
      if (ev.code !== 1000 && ev.code !== 1001 && status !== "done") {
        setStatus((prev) => (prev === "running" ? "error" : prev));
        if (!ev.wasClean) {
          setError((prev) => prev ?? "Connection closed unexpectedly.");
        }
      }
    };
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.close(1000, "component unmounted");
    };
  }, []);

  return { status, agents, report, error, analyze };
}
