"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { OUTCOME_LABEL } from "./evaluation";
import { computeReadiness, fmtDateTime, uid, type RescheduleMove } from "./logic";
import { emptyData, type AppData } from "./seed";
import type { AdvisorReport, Competition, Evaluation, Member, Milestone, Notice, Resource, Stage, Task, User, WhiteboardElement } from "./types";

const STORAGE_KEY = "cs-state-v4";

type Action =
  | { type: "login"; userId: string }
  | { type: "register"; user: User }
  | { type: "logout" }
  | { type: "complete"; taskId: string; proofUrl: string; at: string }
  | { type: "addPlan"; competition: Competition; stages: Stage[]; members: Member[]; milestones: Milestone[]; tasks: Task[] }
  | { type: "decideStage"; stageId: string; work: { milestones: Milestone[]; tasks: Task[] } | null }
  | { type: "addTasks"; tasks: Task[] }
  | { type: "setTeamRole"; competitionId: string; userId: string; teamRole: string }
  | { type: "removeMember"; competitionId: string; userId: string }
  | { type: "addTask"; task: Task }
  | { type: "updateTask"; id: string; patch: Partial<Task> }
  | { type: "deleteTask"; id: string }
  | { type: "addMilestone"; milestone: Milestone }
  | { type: "updateMilestone"; id: string; patch: Partial<Milestone> }
  | { type: "deleteMilestone"; id: string }
  | { type: "syncCalendar"; competitionId: string }
  | { type: "addStage"; stage: Stage; afterStageId: string | null }
  | { type: "finishCompetition"; evaluation: Evaluation; stageId?: string; stageResult?: "passed" | "eliminated" }
  | { type: "saveEvaluation"; evaluation: Evaluation }
  | { type: "join"; competitionId: string; userId: string; teamRole: string }
  | { type: "reschedule"; moves: RescheduleMove[] }
  | { type: "assign"; taskId: string; userId: string }
  | { type: "updateCompetition"; id: string; patch: Partial<Competition> }
  | { type: "addResource"; resource: Resource }
  | { type: "setAutoSend"; competitionId: string; on: boolean }
  | { type: "saveReport"; report: AdvisorReport }
  | { type: "wbAdd"; element: WhiteboardElement }
  | { type: "wbPatch"; id: string; patch: Partial<WhiteboardElement> }
  | { type: "wbRemove"; id: string }
  | { type: "wbVote"; id: string; userId: string }
  | { type: "noteToTask"; noteId: string; task: Task }
  | { type: "reset"; data: AppData };

function withNotice(state: AppData, text: string, tone: Notice["tone"] = "active"): AppData {
  const notice: Notice = { id: uid("n"), at: new Date().toISOString(), text, tone };
  return { ...state, notices: [notice, ...state.notices].slice(0, 40) };
}

const calendars = (u?: User) => [u?.emailGoogle && "Google Calendar", u?.emailMicrosoft && "Outlook"].filter(Boolean).join(" & ") || "kalender";

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case "login":
      return { ...state, session: action.userId };
    case "register":
      return { ...state, users: [...state.users, action.user], session: action.user.id };
    case "logout":
      return { ...state, session: null };

    case "complete": {
      // Stop-on-Confirm: completing with proof deactivates the alarm and the linked calendar reminders.
      const task = state.tasks.find((t) => t.id === action.taskId);
      const next = {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, isCompleted: true, completedAt: action.at, proofUrl: action.proofUrl, alarmActive: false } : t,
        ),
      };
      return task
        ? withNotice(next, `"${task.title}" selesai. Alarm dihentikan dan pengingat ${calendars(state.users.find((u) => u.id === task.assignedTo))} dibatalkan.`, "safe")
        : next;
    }

    case "addPlan":
      return withNotice(
        {
          ...state,
          competitions: [...state.competitions, action.competition],
          stages: [...state.stages, ...action.stages],
          members: [...state.members, ...action.members],
          milestones: [...state.milestones, ...action.milestones],
          tasks: [...state.tasks, ...action.tasks],
        },
        `Lomba "${action.competition.title}" dibuat. Kode undangan: ${action.competition.inviteCode}. ${action.tasks.length} tugas dan ${action.milestones.length} milestone dijadwalkan.`,
        "safe",
      );

    case "join": {
      if (state.members.some((m) => m.competitionId === action.competitionId && m.userId === action.userId)) return state;
      const comp = state.competitions.find((c) => c.id === action.competitionId);
      const user = state.users.find((u) => u.id === action.userId);
      const next: AppData = {
        ...state,
        members: [...state.members, { competitionId: action.competitionId, userId: action.userId, role: "member", teamRole: action.teamRole }],
      };
      return withNotice(
        next,
        `${user?.fullName ?? "Anggota baru"} bergabung ke "${comp?.title}" sebagai ${action.teamRole}. Tenggat lomba disinkronkan ke ${calendars(user)}.`,
        "safe",
      );
    }

    case "reschedule": {
      const byId = new Map(action.moves.map((m) => [m.taskId, m]));
      const next: AppData = {
        ...state,
        tasks: state.tasks.map((t) => {
          const m = byId.get(t.id);
          return m ? { ...t, dueDate: m.to, rescheduledFrom: t.rescheduledFrom ?? m.from } : t;
        }),
      };
      return withNotice(next, `AI Rescheduler memindahkan ${action.moves.length} tugas. Event Google Calendar dan Outlook diperbarui.`, "safe");
    }

    case "assign": {
      const user = state.users.find((u) => u.id === action.userId);
      const next: AppData = {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? {
                ...t,
                assignedTo: action.userId,
                gcalEventId: user?.emailGoogle ? `gcal_${t.id}` : undefined,
                outlookEventId: user?.emailMicrosoft ? `outlook_${t.id}` : undefined,
              }
            : t,
        ),
      };
      const task = state.tasks.find((t) => t.id === action.taskId);
      return withNotice(next, `"${task?.title}" ditugaskan ke ${user?.fullName}. Event dipindahkan ke ${calendars(user)} miliknya.`);
    }

    case "addResource":
      return withNotice({ ...state, resources: [action.resource, ...state.resources] }, `Berkas "${action.resource.title}" ditambahkan ke Cloud Vault.`);

    case "setAutoSend":
      return withNotice(
        { ...state, competitions: state.competitions.map((c) => (c.id === action.competitionId ? { ...c, autoSendWeekly: action.on } : c)) },
        action.on ? "Pengiriman laporan otomatis setiap Minggu 19:00 WIB diaktifkan." : "Pengiriman laporan otomatis dimatikan.",
        action.on ? "safe" : "warn",
      );

    case "saveReport":
      return withNotice({ ...state, reports: [action.report, ...state.reports] }, action.report.kind === "final" ? `Laporan akhir lomba terkirim ke ${action.report.sentToEmail}.` : action.report.kind === "stage" ? `Email pembaruan babak terkirim ke ${action.report.sentToEmail}.` : `Laporan minggu ${action.report.weekNumber} terkirim ke ${action.report.sentToEmail}.`, "safe");

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
    case "noteToTask": {
      // The new task joins the to-do list immediately; readiness is derived from tasks so it recalculates automatically.
      const user = state.users.find((u) => u.id === action.task.assignedTo);
      return withNotice(
        {
          ...state,
          tasks: [...state.tasks, action.task],
          whiteboard: state.whiteboard.map((e) => (e.id === action.noteId ? { ...e, taskId: action.task.id } : e)),
        },
        `Catatan whiteboard jadi tugas "${action.task.title}" (${fmtDateTime(action.task.dueDate)}) untuk ${user?.fullName ?? "tim"}.`,
      );
    }
    case "decideStage": {
      const stage = state.stages.find((s) => s.id === action.stageId);
      if (!stage) return state;
      const ordered = state.stages.filter((s) => s.competitionId === stage.competitionId).sort((a, b) => a.orderIndex - b.orderIndex);
      const next = ordered[ordered.findIndex((s) => s.id === stage.id) + 1];
      const comp = state.competitions.find((c) => c.id === stage.competitionId);
      const advanced: AppData = {
        ...state,
        stages: state.stages.map((s) => (s.id === stage.id ? { ...s, status: "passed", decidedAt: new Date().toISOString() } : s.id === next?.id ? { ...s, status: "active" } : s)),
        milestones: [...state.milestones, ...(action.work?.milestones ?? [])],
        tasks: [...state.tasks, ...(action.work?.tasks ?? [])],
      };
      return withNotice(
        advanced,
        next
          ? `"${comp?.title}" lolos dari ${stage.name} ke ${next.name}. ${action.work?.tasks.length ?? 0} tugas baru dijadwalkan dan tenggatnya disinkronkan ke Google Calendar dan Outlook anggota. ${comp?.advisorEmail ? "Email pembaruan dikirim ke Pembina (simulasi)." : "Isi email Pembina agar pembaruan bisa dikirim."}`
          : `${stage.name} dinyatakan lolos.`,
        "safe",
      );
    }

    case "addTask": {
      const user = state.users.find((u) => u.id === action.task.assignedTo);
      const task: Task = {
        ...action.task,
        gcalEventId: user?.emailGoogle ? `gcal_${action.task.id}` : undefined,
        outlookEventId: user?.emailMicrosoft ? `outlook_${action.task.id}` : undefined,
      };
      return withNotice({ ...state, tasks: [...state.tasks, task] }, `Tugas "${task.title}" dibuat untuk ${user?.fullName ?? "tim"} (${fmtDateTime(task.dueDate)}). Event dijadwalkan di ${calendars(user)}.`, "safe");
    }

    case "updateTask": {
      const old = state.tasks.find((t) => t.id === action.id);
      if (!old) return state;
      const next: Task = { ...old, ...action.patch };
      const moved = action.patch.dueDate !== undefined && action.patch.dueDate !== old.dueDate;
      const reassigned = action.patch.assignedTo !== undefined && action.patch.assignedTo !== old.assignedTo;
      if (moved) next.rescheduledFrom = undefined; // a manual edit replaces the AI's note
      if (reassigned) {
        const u = state.users.find((x) => x.id === next.assignedTo);
        next.gcalEventId = u?.emailGoogle ? `gcal_${old.id}` : undefined;
        next.outlookEventId = u?.emailMicrosoft ? `outlook_${old.id}` : undefined;
      }
      const updated: AppData = { ...state, tasks: state.tasks.map((t) => (t.id === old.id ? next : t)) };
      return moved || reassigned ? withNotice(updated, `"${next.title}" diperbarui; event kalender mengikuti tenggat dan penanggung jawab baru.`) : updated;
    }

    case "deleteTask": {
      const old = state.tasks.find((t) => t.id === action.id);
      if (!old) return state;
      return withNotice(
        {
          ...state,
          tasks: state.tasks.filter((t) => t.id !== old.id),
          whiteboard: state.whiteboard.map((e) => (e.taskId === old.id ? { ...e, taskId: undefined } : e)),
        },
        `Tugas "${old.title}" dihapus. Event kalender dan penanda dihapus, skor kesiapan dihitung ulang.`,
        "warn",
      );
    }

    case "addMilestone":
      return withNotice({ ...state, milestones: [...state.milestones, action.milestone] }, `Milestone "${action.milestone.title}" ditambahkan.`, "safe");

    case "updateMilestone":
      return { ...state, milestones: state.milestones.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)) };

    case "deleteMilestone": {
      const old = state.milestones.find((m) => m.id === action.id);
      if (!old) return state;
      const gone = new Set(state.tasks.filter((t) => t.milestoneId === old.id).map((t) => t.id));
      return withNotice(
        {
          ...state,
          milestones: state.milestones
            .filter((m) => m.id !== old.id)
            .map((m) => (m.stageId === old.stageId && m.competitionId === old.competitionId && m.orderIndex > old.orderIndex ? { ...m, orderIndex: m.orderIndex - 1 } : m)),
          tasks: state.tasks.filter((t) => !gone.has(t.id)),
          whiteboard: state.whiteboard.map((e) => (e.taskId && gone.has(e.taskId) ? { ...e, taskId: undefined } : e)),
        },
        `Milestone "${old.title}" dihapus bersama ${gone.size} tugasnya.`,
        "warn",
      );
    }

    case "syncCalendar": {
      let n = 0;
      const tasks = state.tasks.map((t) => {
        if (t.competitionId !== action.competitionId || t.isCompleted) return t;
        const u = state.users.find((x) => x.id === t.assignedTo);
        n++;
        return { ...t, gcalEventId: u?.emailGoogle ? `gcal_${t.id}` : undefined, outlookEventId: u?.emailMicrosoft ? `outlook_${t.id}` : undefined };
      });
      return withNotice({ ...state, tasks }, `${n} penanda tugas disinkronkan ke Google Calendar dan Outlook anggota yang akunnya terhubung (simulasi, belum memakai akun sungguhan).`, "safe");
    }

    case "setTeamRole":
      return {
        ...state,
        members: state.members.map((m) => (m.competitionId === action.competitionId && m.userId === action.userId ? { ...m, teamRole: action.teamRole } : m)),
      };

    case "removeMember": {
      const member = state.members.find((m) => m.competitionId === action.competitionId && m.userId === action.userId);
      const leader = state.members.find((m) => m.competitionId === action.competitionId && m.role === "leader");
      if (!member || member.role === "leader" || !leader) return state;
      const gone = state.users.find((u) => u.id === action.userId);
      const heir = state.users.find((u) => u.id === leader.userId);
      let moved = 0;
      return withNotice(
        {
          ...state,
          members: state.members.filter((m) => m !== member),
          // Work of a removed member goes back to the leader so nothing is left without an owner.
          tasks: state.tasks.map((t) => {
            if (t.competitionId !== action.competitionId || t.assignedTo !== action.userId) return t;
            if (!t.isCompleted) moved++;
            return t.isCompleted
              ? t
              : { ...t, assignedTo: leader.userId, gcalEventId: heir?.emailGoogle ? `gcal_${t.id}` : undefined, outlookEventId: heir?.emailMicrosoft ? `outlook_${t.id}` : undefined };
          }),
        },
        `${gone?.fullName ?? "Anggota"} dikeluarkan dari tim. ${moved} tugas terbuka dialihkan ke Ketua.`,
        "warn",
      );
    }

    case "addTasks":
      return withNotice({ ...state, tasks: [...state.tasks, ...action.tasks] }, `${action.tasks.length} tugas dari guidebook ditambahkan ke babak yang sedang berjalan.`, "safe");

    case "addStage": {
      const siblings = state.stages.filter((s) => s.competitionId === action.stage.competitionId).sort((a, b) => a.orderIndex - b.orderIndex);
      const at = action.afterStageId ? siblings.findIndex((s) => s.id === action.afterStageId) + 1 : siblings.length;
      const merged = [...siblings.slice(0, at), action.stage, ...siblings.slice(at)].map((s, i) => ({ ...s, orderIndex: i }));
      const last = merged[merged.length - 1];
      return withNotice(
        {
          ...state,
          stages: [...state.stages.filter((s) => s.competitionId !== action.stage.competitionId), ...merged],
          competitions: state.competitions.map((c) => (c.id === action.stage.competitionId ? { ...c, submissionDeadline: last.deadline } : c)),
        },
        `Babak "${action.stage.name}" ditambahkan ke linimasa.`,
      );
    }

    case "finishCompetition": {
      const { evaluation, stageId, stageResult } = action;
      const comp = state.competitions.find((c) => c.id === evaluation.competitionId);
      const done: AppData = {
        ...state,
        competitions: state.competitions.map((c) => (c.id === evaluation.competitionId ? { ...c, status: "archived", autoSendWeekly: false } : c)),
        stages: state.stages.map((s) => (s.id === stageId && stageResult ? { ...s, status: stageResult, decidedAt: evaluation.completedAt } : s)),
        // Future reminders are cancelled: silence alarms and drop the calendar event links of every open task.
        tasks: state.tasks.map((t) =>
          t.competitionId === evaluation.competitionId && !t.isCompleted ? { ...t, alarmActive: false, gcalEventId: undefined, outlookEventId: undefined } : t,
        ),
        evaluations: [...state.evaluations.filter((e) => e.competitionId !== evaluation.competitionId), evaluation],
      };
      return withNotice(done, `"${comp?.title}" selesai: ${OUTCOME_LABEL[evaluation.outcome]}. Pengingat kalender yang tersisa dibatalkan dan evaluasi tersimpan di Riwayat.`, "safe");
    }

    case "saveEvaluation":
      return withNotice(
        { ...state, evaluations: [...state.evaluations.filter((e) => e.competitionId !== action.evaluation.competitionId), action.evaluation] },
        "Evaluasi lomba diperbarui.",
        "safe",
      );

    case "updateCompetition":
      return { ...state, competitions: state.competitions.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) };
    case "reset":
      return action.data;
  }
}

interface Store {
  data: AppData;
  now: number;
  /** Signed-in user id ("" on the login screen). */
  me: string;
  /** Competitions the signed-in user belongs to. */
  myCompetitions: Competition[];
  /** Competitions still running (not archived); the dashboard, alarms and collision radar only look at these. */
  liveCompetitions: Competition[];
  dispatch: (a: Action) => void;
  readiness: (competitionId: string) => number;
}

const Ctx = createContext<Store | null>(null);

/** Fills fields added after a save was written: older competitions get one stage and their tasks join it. */
function migrate(d: AppData): AppData {
  const stages = [...(d.stages ?? [])];
  const stageOf = new Map<string, string>();
  for (const c of d.competitions) {
    const existing = stages.find((s) => s.competitionId === c.id);
    if (existing) continue;
    const s: Stage = { id: uid("s"), competitionId: c.id, name: "Babak Utama", orderIndex: 0, status: c.status === "archived" ? "passed" : "active", deadline: c.submissionDeadline };
    stages.push(s);
    stageOf.set(c.id, s.id);
  }
  return {
    ...d,
    stages,
    evaluations: d.evaluations ?? [],
    milestones: d.milestones.map((m) => (m.stageId ? m : { ...m, stageId: stageOf.get(m.competitionId) })),
    tasks: d.tasks.map((t) => (t.stageId ? t : { ...t, stageId: stageOf.get(t.competitionId) })),
  };
}

function loadSaved(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<AppData>;
    const ok = Array.isArray(d.users) && Array.isArray(d.competitions) && Array.isArray(d.members) && Array.isArray(d.tasks) && Array.isArray(d.notices) && "session" in d;
    return ok ? migrate(d as AppData) : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<AppData | null>(null);
  useEffect(() => {
    setBoot(loadSaved() ?? emptyData());
  }, []);
  if (!boot) {
    return <div className="grid min-h-screen place-items-center text-sm text-white/50">Memuat CompeteSync…</div>;
  }
  return <Inner initial={boot}>{children}</Inner>;
}

function Inner({ initial, children }: { initial: AppData; children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, initial);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // Persist every change so sessions, joins, tasks and drawings survive a refresh.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable or full: the app keeps working in memory */
    }
  }, [data]);

  const value = useMemo<Store>(() => {
    const me = data.session ?? "";
    const mine = new Set(data.members.filter((m) => m.userId === me).map((m) => m.competitionId));
    return {
      data,
      now,
      me,
      myCompetitions: data.competitions.filter((c) => mine.has(c.id)),
      liveCompetitions: data.competitions.filter((c) => mine.has(c.id) && c.status !== "archived"),
      dispatch,
      readiness: (id) => computeReadiness(data.tasks.filter((t) => t.competitionId === id)),
    };
  }, [data, now]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

export { emptyData };
