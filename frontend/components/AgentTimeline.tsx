"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { AgentEvent } from "@/lib/types";

const AGENTS = ["Parser", "Contract", "Dependency", "Impact", "Risk"] as const;

interface Props {
  events: AgentEvent[];
}

export default function AgentTimeline({ events }: Props) {
  return (
    <ol
      className="grid grid-cols-2 gap-3 sm:grid-cols-5"
      aria-label="Agent pipeline progress"
    >
      {AGENTS.map((name, index) => {
        const event = events.find((e) => e.agent === name);
        const state = !event ? "waiting" : event.status === "running" ? "running" : "done";

        const Icon =
          state === "waiting" ? Circle : state === "running" ? Loader2 : CheckCircle2;
        const iconClass =
          state === "waiting"
            ? "text-zinc-600"
            : state === "running"
              ? "text-violet-300"
              : "text-emerald-300";

        return (
          <motion.li
            key={name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 backdrop-blur"
            aria-label={`${name}: ${event?.message ?? "Waiting"}`}
          >
            <div className="flex items-center gap-2">
              <Icon
                className={`h-4 w-4 shrink-0 ${iconClass} ${state === "running" ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-zinc-100">{name}</span>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500" title={event?.message}>
              {event?.message ?? "Waiting"}
            </p>
          </motion.li>
        );
      })}
    </ol>
  );
}
