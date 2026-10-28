"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { computeReadiness } from "./logic";
import { buildSeed, CURRENT_USER_ID, type AppData } from "./seed";
import type { AdvisorReport, Competition, Member, Milestone, Task, WhiteboardElement } from "./types";

type Action =
  | { type: "complete"; taskId: string; proofUrl: string; at: string }
  | { type: "addPlan"; competition: Competition; members: Member[]; milestones: Milestone[]; tasks: Task[] }
  | { type: "saveReport"; report: AdvisorReport }
  | { type: "wbAdd"; element: WhiteboardElement }
  | { type: "wbPatch"; id: string; patch: Partial<WhiteboardElement> }
  | { type: "wbRemove"; id: string }
  | { type: "wbVote"; id: string; userId: string }
  | { type: "noteToTask"; noteId: string; task: Task }
  | { type: "reset"; data: AppData };

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case "complete":
      // Stop-on-Confirm: completing with proof deactivates the alarm and the linked calendar reminders.
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? { ...t, isCompleted: true, completedAt: action.at, proofUrl: action.proofUrl, alarmActive: false }
            : t,
        ),
      };
    case "addPlan":
      return {
        ...state,
        competitions: [...state.competitions, action.competition],
        members: [...state.members, ...action.members],
        milestones: [...state.milestones, ...action.milestones],
        tasks: [...state.tasks, ...action.tasks],
      };
    case "saveReport":
      return { ...state, reports: [action.report, ...state.reports] };
    case "wbAdd":
      return { ...state, whiteboard: [...state.whiteboard, action.element] };
    case "wbPatch":
      return {
        ...state,
        whiteboard: state.whiteboard.map((e) => (e.id === action.id ? { ...e, ...action.patch, updatedAt: new Date().toISOString() } : e)),
      };
    case "wbRemove":
      return { ...state, whiteboard: state.whiteboard.filter((e) => e.id !== action.id) };
    case "wbVote":
      return {
        ...state,
        whiteboard: state.whiteboard.map((e) =>
          e.id === action.id ? { ...e, votes: e.votes.includes(action.userId) ? e.votes.filter((v) => v !== action.userId) : [...e.votes, action.userId] } : e,
        ),
      };
    case "noteToTask":
      // The new task joins the to-do list immediately; readiness is derived from tasks so it recalculates automatically.
      return {
        ...state,
        tasks: [...state.tasks, action.task],
        whiteboard: state.whiteboard.map((e) => (e.id === action.noteId ? { ...e, taskId: action.task.id } : e)),
      };
    case "reset":
      return action.data;
  }
}

interface Store {
  data: AppData;
  now: number;
  me: string;
  dispatch: (a: Action) => void;
  readiness: (competitionId: string) => number;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<{ data: AppData; now: number } | null>(null);
  useEffect(() => {
    const now = Date.now();
    setBoot({ data: buildSeed(now), now });
  }, []);
  if (!boot) {
    return <div className="grid min-h-screen place-items-center text-sm text-white/50">Memuat CompeteSync…</div>;
  }
  return <Inner initial={boot.data}>{children}</Inner>;
}

function Inner({ initial, children }: { initial: AppData; children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, initial);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<Store>(
    () => ({
      data,
      now,
      me: CURRENT_USER_ID,
      dispatch,
      readiness: (id) => computeReadiness(data.tasks.filter((t) => t.competitionId === id)),
    }),
    [data, now],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
