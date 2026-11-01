"use client";

import { motion } from "framer-motion";
import { BellRing, Calendar, CalendarDays, CheckCircle2, ChevronRight, ExternalLink, FilterX, Flag, KeyRound, Lock, Mail, Pencil, PlayCircle, Plus, Send, Trash2, Volume2, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { OUTCOME_LABEL, STAGE_STATUS_LABEL } from "@/lib/evaluation";
import { buildStageWork } from "@/lib/generator";
import { generateStageUpdate } from "@/lib/report";
import { DAY, dayKey, fmtLong, uid, dueState, fmtDate, fmtDateTime, PRIORITY_LABEL, relative, scoreTone } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Stage, Task } from "@/lib/types";
import type { EvalContext } from "./modals/EvaluationModal";
import CalendarPanel from "./CalendarPanel";
import { useConfirm } from "./ConfirmDialog";
import TeamPanel from "./TeamPanel";
import CloudVault from "./CloudVault";
import MilestoneFormModal, { type MilestoneFormCtx } from "./modals/MilestoneFormModal";
import TaskFormModal, { type TaskFormCtx } from "./modals/TaskFormModal";
import { Avatar, Badge, Gauge, PRIORITY_TONE, TONE } from "./ui";
import Whiteboard from "./Whiteboard";

const PASTEL_VARS = ["var(--tile-lav)", "var(--tile-sky)", "var(--tile-mint)", "var(--tile-cream)", "var(--tile-peach)"] as const;

export default function Workspace({
  competitionId,
  onComplete,
  onTestAlarm,
  onReport,
  onEdit,
  onEvaluate,
  onAddStage,
}: {
  competitionId: string;
  onComplete: (taskId: string) => void;
  onTestAlarm: (taskId: string) => void;
  onReport: () => void;
  onEdit: () => void;
  onEvaluate: (ctx: EvalContext) => void;
  onAddStage: () => void;
}) {
  const { data, now, me, readiness, dispatch } = useStore();
  const confirm = useConfirm();
  const [assignee, setAssignee] = useState<string>("all");
  const [showDone, setShowDone] = useState(true);
  const [tab, setTabState] = useState<"tasks" | "board" | "vault">(() => {
    if (typeof window === "undefined") return "tasks";
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      if (t === "tasks" || t === "board" || t === "vault") return t;
      const saved = localStorage.getItem(`cs-tab-${competitionId}`);
      if (saved === "tasks" || saved === "board" || saved === "vault") return saved;
    } catch {
      /* ignore */
    }
    return "tasks";
  });

  const setTab = (next: "tasks" | "board" | "vault") => {
    setTabState(next);
    try {
      localStorage.setItem(`cs-tab-${competitionId}`, next);
      const url = new URL(window.location.href);
      if (next === "tasks") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", next);
      }
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  };
  const [copied, setCopied] = useState(false);
  const [stageSel, setStageSel] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null); // "YYYY-MM-DD" picked on the calendar
  const [showCal, setShowCal] = useState(true);
  const [taskForm, setTaskForm] = useState<TaskFormCtx | null>(null);
  const [msForm, setMsForm] = useState<MilestoneFormCtx | null>(null);

  const comp = data.competitions.find((c) => c.id === competitionId)!;
  const team = data.members.filter((m) => m.competitionId === competitionId);
  const tasks = data.tasks.filter((t) => t.competitionId === competitionId);
  const stages = data.stages.filter((s) => s.competitionId === competitionId).sort((a, b) => a.orderIndex - b.orderIndex);
  const activeStage = stages.find((s) => s.status === "active");
  // The countdown that matters is the running round, not the final deadline weeks later.
  const stageDays = activeStage ? Math.ceil((new Date(activeStage.deadline).getTime() - now) / DAY) : null;
  const sel: Stage | undefined = stages.find((s) => s.id === stageSel) ?? activeStage ?? stages[stages.length - 1];
  const finished = comp.status === "archived";
  const evaluation = data.evaluations.find((e) => e.competitionId === competitionId);
  const milestones = data.milestones.filter((m) => m.competitionId === competitionId && m.stageId === sel?.id).sort((a, b) => a.orderIndex - b.orderIndex);
  const selTasks = tasks.filter((t) => t.stageId === sel?.id);
  const nextStage = activeStage ? stages[stages.indexOf(activeStage) + 1] : undefined;
  const stageDone = !!activeStage && tasks.filter((t) => t.stageId === activeStage.id).length > 0 && tasks.filter((t) => t.stageId === activeStage.id).every((t) => t.isCompleted);
  const userOf = (id: string | null) => data.users.find((u) => u.id === id);
  const score = readiness(competitionId);
  const done = tasks.filter((t) => t.isCompleted).length;
  const proofs = tasks.filter((t) => t.proofUrl).length;
  const daysLeft = Math.ceil((new Date(comp.submissionDeadline).getTime() - now) / DAY);
  const myMember = team.find((m) => m.userId === me);
  const myRole = myMember?.role;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(comp.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the code stays visible to copy by hand */
    }
  }

  async function advance() {
    if (!activeStage || !nextStage) return;
    const ok = await confirm({
      title: `Lolos ke ${nextStage.name}?`,
      item: `${activeStage.name} → ${nextStage.name}`,
      message: `Babak berikutnya dibuka dan tugas barunya dijadwalkan otomatis.${comp.advisorEmail ? " Pembina mendapat email pembaruan." : ""}`,
      confirmLabel: "🎉 Ya, Lolos",
      tone: "safe",
      icon: "check",
    });
    if (!ok) return;
    const work = buildStageWork({
      competitionId,
      stage: nextStage,
      category: comp.category,
      assignees: team.filter((m) => m.role !== "advisor").map((m) => m.userId),
      start: now,
      isFinal: nextStage.orderIndex === stages.length - 1,
    });
    dispatch({ type: "decideStage", stageId: activeStage.id, work });
    if (comp.advisorEmail) {
      const mail = generateStageUpdate(comp, activeStage.name, nextStage.name, work.tasks.length, now);
      dispatch({ type: "saveReport", report: { id: uid("rep"), competitionId, weekNumber: 0, html: mail.html, sentToEmail: comp.advisorEmail, sentAt: new Date().toISOString(), status: "sent", kind: "stage" } });
    }
    setStageSel(nextStage.id);
  }

  async function eliminate() {
    if (!activeStage) return;
    const ok = await confirm({
      title: "Tandai tim gugur?",
      item: activeStage.name,
      message: "Pengingat yang tersisa dibatalkan dan form evaluasi dibuka. Tetap semangat untuk lomba berikutnya!",
      confirmLabel: "Ya, Gugur",
      tone: "danger",
      icon: "warn",
    });
    if (!ok) return;
    onEvaluate({ competitionId, stageId: activeStage.id, stageResult: "eliminated" });
  }

  const visible = (t: Task) => (assignee === "all" || t.assignedTo === assignee) && (showDone || !t.isCompleted) && (!dateFilter || dayKey(t.dueDate) === dateFilter);
  const canStructure = myRole === "leader" && !finished; // only the leader adds, moves or removes work (mirrors the database policies)

  /** New task from the calendar: goes to the shown stage and to the milestone due on or after that day. */
  function addTaskOn(day: string) {
    const stage = sel && sel.status !== "upcoming" ? sel : activeStage;
    if (!stage) return;
    const ms = data.milestones.filter((m) => m.stageId === stage.id).sort((a, b) => a.orderIndex - b.orderIndex);
    const target = ms.find((m) => dayKey(m.targetDate) >= day) ?? ms[ms.length - 1];
    setTaskForm({ competitionId, stageId: stage.id, milestoneId: target?.id ?? null, defaultDue: new Date(`${day}T23:59:00`).toISOString() });
  }

  return (
    <div className="space-y-6">
      {/* Header / Overview Card */}
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Gauge value={score} size={116} color={TONE[scoreTone(score)].hex} label="Kesiapan" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="active">{comp.category}</Badge>
                {comp.status === "archived" ? (
                  <Badge tone="neutral">Lomba selesai</Badge>
                ) : activeStage && stageDays !== null ? (
                  <>
                    <Badge tone={stageDays <= 3 ? "danger" : stageDays <= 7 ? "warn" : "safe"}>
                      {stageDays <= 0 ? "Tenggat" : `${stageDays} hari menuju`} {activeStage.name}
                    </Badge>
                    {stages.length > 1 && <Badge tone="neutral">Final {daysLeft} hari lagi</Badge>}
                  </>
                ) : (
                  <Badge tone={daysLeft <= 3 ? "danger" : daysLeft <= 7 ? "warn" : "safe"}>{daysLeft} hari menuju deadline</Badge>
                )}
                {myRole && (
                  <Badge tone="neutral">
                    Peran Anda: {myRole === "leader" ? "Ketua" : "Anggota"}
                    {myMember?.teamRole ? ` · ${myMember.teamRole}` : ""}
                  </Badge>
                )}
              </div>

              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{comp.title}</h1>
              <p className="mt-1 text-sm text-white/55">{comp.theme || "Tema belum diisi"}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#e4e2dc] bg-[#f6f5f0] px-3.5 py-1.5 text-white/70 dark:border-[#2e2e34] dark:bg-[#222226]">
                  <KeyRound size={13} className="text-white/50" />
                  <span>Kode undangan:</span>
                  <button
                    onClick={copyCode}
                    className="rounded-full bg-[#141416] px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-[#ffffff] transition hover:opacity-85 dark:bg-[#f4f4f6] dark:text-[#141416]"
                    title="Salin kode undangan"
                  >
                    {comp.inviteCode}
                  </button>
                  <span className="text-white/50">· {copied ? "Tersalin!" : `${team.length}/5 anggota`}</span>
                </div>

                <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[#e4e2dc] bg-[#faf9f6] px-3.5 py-1.5 text-white/60 dark:border-[#2e2e34] dark:bg-[#202024]">
                  <span>Deadline final: <strong className="font-semibold text-white/85">{fmtDateTime(comp.submissionDeadline)}</strong></span>
                  <span>·</span>
                  <span>{done}/{tasks.length} tugas selesai</span>
                  <span>·</span>
                  <span>{proofs} bukti terunggah</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 xl:shrink-0">
            {myRole === "leader" && (
              <button className="btn-ghost" onClick={onEdit}>
                <Pencil size={15} /> Ubah Detail
              </button>
            )}
            {myRole === "leader" && !finished && (
              <button className="btn-ghost" onClick={() => onEvaluate({ competitionId })}>
                <Flag size={15} /> Selesaikan Lomba
              </button>
            )}
            {finished && (
              <button className="btn-ghost" onClick={() => onEvaluate({ competitionId })}>
                <Flag size={15} /> Lihat Evaluasi
              </button>
            )}
            <button className="btn-primary" onClick={onReport}>
              <Mail size={16} /> Laporan Pembina
            </button>
          </div>
        </div>
      </section>

      {/* Stage-gate pipeline */}
      <section className="card p-6 sm:p-7" aria-labelledby="pipe-h">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="pipe-h" className="text-base font-bold tracking-tight">Alur Babak Lomba</h2>
          {myRole === "leader" && !finished && (
            <button className="btn-ghost !px-3.5 !py-1.5 text-xs" onClick={onAddStage}>
              <Plus size={14} /> Tambah Babak
            </button>
          )}
        </div>
        <ol className="flex items-stretch gap-2.5 overflow-x-auto pb-1" aria-label="Daftar babak">
          {stages.map((s, i) => {
            const StageIcon = s.status === "passed" ? CheckCircle2 : s.status === "eliminated" ? XCircle : s.status === "active" ? PlayCircle : Lock;
            const dropped = finished && s.status === "upcoming";
            const isSelected = sel?.id === s.id;
            const bgStyle =
              s.status === "passed"
                ? { background: "var(--tile-mint)" }
                : s.status === "eliminated"
                  ? { background: "var(--tile-rose)" }
                  : s.status === "active"
                    ? { background: "var(--tile-lav)" }
                    : undefined;
            const statusText =
              s.status === "passed"
                ? "text-[#14532d] dark:text-[#86efac]"
                : s.status === "eliminated"
                  ? "text-[#881337] dark:text-[#fda4af]"
                  : s.status === "active"
                    ? "text-[#3b1d8f] dark:text-[#c4b5fd]"
                    : "text-white/45";
            return (
              <li key={s.id} className="flex items-center gap-2.5">
                <button
                  onClick={() => setStageSel(s.id)}
                  aria-current={isSelected ? "step" : undefined}
                  style={bgStyle}
                  className={`min-w-[12.5rem] rounded-[24px] border px-4 py-3.5 text-left transition-all ${
                    !bgStyle ? "bg-[#f6f5f0] dark:bg-[#222226]" : ""
                  } ${
                    isSelected
                      ? "border-[#141416] ring-2 ring-[#141416]/10 dark:border-[#f4f4f6] dark:ring-[#f4f4f6]/15"
                      : "border-black/[0.06] hover:border-black/20 dark:border-white/10"
                  }`}
                >
                  <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#ffffff]/75 px-2.5 py-0.5 text-[11px] font-semibold dark:bg-[#141416]/40 ${statusText}`}>
                    <StageIcon size={13} /> {dropped ? "Tidak dilanjutkan" : STAGE_STATUS_LABEL[s.status]}
                  </span>
                  <span className="mt-2 block truncate text-sm font-bold">{s.name}</span>
                  <span className="mt-0.5 block text-xs text-white/55">{fmtDate(s.deadline)}</span>
                </button>
                {i < stages.length - 1 && <ChevronRight size={16} className="shrink-0 text-white/30" />}
              </li>
            );
          })}
        </ol>

        {finished && evaluation && (
          <p className="mt-4 rounded-2xl bg-[#dcfce7] px-4 py-3 text-sm text-[#14532d] dark:bg-[#142e22] dark:text-[#86efac]">
            Lomba selesai: <strong>{OUTCOME_LABEL[evaluation.outcome]}</strong>
            {evaluation.rank ? ` · ${evaluation.rank}` : ""}. Evaluasi tersimpan di Riwayat.
          </p>
        )}

        {myRole === "leader" && !finished && activeStage && (
          <div
            className={`mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[22px] border px-5 py-4 ${
              stageDone
                ? "border-[#bbf7d0] bg-[#dcfce7]/60 dark:border-[#1f4e38] dark:bg-[#142e22]/60"
                : "border-[#eae8e1] bg-[#faf9f6] dark:border-white/10 dark:bg-[#202024]"
            }`}
          >
            <div>
              <div className="text-sm font-bold">
                {stageDone ? `Semua tugas ${activeStage.name} selesai. Bagaimana hasil babak ini?` : `Keputusan hasil ${activeStage.name}`}
              </div>
              {!stageDone && <p className="mt-0.5 text-xs text-white/55">Tekan setelah panitia mengumumkan hasil, bahkan bila masih ada tugas yang terbuka.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {nextStage ? (
                <button className="btn-safe" onClick={advance}>
                  🎉 Lolos ke {nextStage.name}
                </button>
              ) : (
                <button className="btn-safe" onClick={() => onEvaluate({ competitionId, stageId: activeStage.id, stageResult: "passed" })}>
                  🏁 Selesai Lomba
                </button>
              )}
              <button className="btn-danger" onClick={eliminate}>
                🛑 Gugur di Babak Ini
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-1.5 rounded-full border border-[#e4e2dc] bg-[#efede7] p-1.5 sm:w-fit dark:border-white/10 dark:bg-[#202024]" role="tablist">
        {([
          ["tasks", "Tugas & Milestone"],
          ["board", "Whiteboard & Ideasi"],
          ["vault", "Cloud Vault"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold transition-all sm:flex-none ${
              tab === id
                ? "bg-[#141416] text-[#ffffff] shadow-sm dark:bg-[#f4f4f6] dark:text-[#141416]"
                : "text-[#52525b] hover:text-[#141416] dark:text-[#a1a1aa] dark:hover:text-[#f4f4f6]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "board" ? (
        <Whiteboard competitionId={competitionId} onGoTasks={() => setTab("tasks")} />
      ) : tab === "vault" ? (
        <CloudVault competitionId={competitionId} />
      ) : (
        <div className="space-y-6">
          <TeamPanel competitionId={competitionId} assignee={assignee} onAssignee={setAssignee} onReport={onReport} />

          {comp.guide && <GuideCard guide={comp.guide} />}

          {/* Milestones & tasks, with the calendar beside them */}
          <div className={`grid gap-6 ${showCal ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
            <div className="min-w-0">
              {sel?.status === "upcoming" ? (
                <LockedStage stage={sel} finished={finished} />
              ) : (
                <section className="card p-6 sm:p-7" aria-labelledby="task-h">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h2 id="task-h" className="text-base font-bold tracking-tight">
                      Milestone &amp; Tugas{sel ? ` · ${sel.name}` : ""}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <select className="field !w-auto !rounded-full !py-1.5 text-xs" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Filter penanggung jawab">
                        <option value="all">Semua anggota</option>
                        <option value={me}>Tugas saya</option>
                        {team
                          .filter((m) => m.userId !== me)
                          .map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {userOf(m.userId)?.fullName}
                            </option>
                          ))}
                      </select>
                      <button className="btn-ghost !px-3.5 !py-1.5 text-xs" onClick={() => setShowCal((v) => !v)} aria-pressed={showCal}>
                        <CalendarDays size={14} /> {showCal ? "Sembunyikan Kalender" : "Tampilkan Kalender & Penanda"}
                      </button>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-white/60">
                        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-[#141416] dark:accent-[#f4f4f6]" />
                        Tampilkan selesai
                      </label>
                    </div>
                  </div>

                  {dateFilter && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#ece6ff] px-4 py-2.5 text-xs text-[#3b1d8f] dark:bg-[#251f38] dark:text-[#c4b5fd]">
                      <span>Menampilkan pekerjaan tanggal {new Date(`${dateFilter}T12:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</span>
                      <button className="flex items-center gap-1 font-semibold hover:underline" onClick={() => setDateFilter(null)}>
                        <FilterX size={12} /> Tampilkan Semua Tanggal
                      </button>
                    </div>
                  )}

                  <div className="space-y-7">
                    {selTasks.length === 0 && <p className="py-6 text-center text-xs text-white/45">Belum ada tugas di babak ini.</p>}
                    {milestones.map((m, idx) => {
                      const mt = tasks.filter((t) => t.milestoneId === m.id);
                      const mDone = mt.filter((t) => t.isCompleted).length;
                      const rows = mt.filter(visible).sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
                      if (rows.length === 0 && assignee !== "all") return null;
                      if (dateFilter && rows.length === 0 && dayKey(m.targetDate) !== dateFilter) return null;
                      const pastelBg = PASTEL_VARS[idx % PASTEL_VARS.length];
                      return (
                        <div key={m.id}>
                          <div className="mb-3 flex flex-wrap items-center gap-3">
                            <span
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold text-white"
                              style={{ background: pastelBg }}
                            >
                              {m.orderIndex + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold">{m.title}</div>
                              <div className="text-xs text-white/45">Target {fmtDate(m.targetDate)}</div>
                            </div>
                            <span className="text-xs font-medium tabular-nums text-white/55">
                              {mDone}/{mt.length}
                            </span>
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-[#efede7] dark:bg-white/10">
                              <motion.div
                                className="h-full rounded-full bg-[#22c55e]"
                                initial={false}
                                animate={{ width: `${mt.length ? (mDone / mt.length) * 100 : 0}%` }}
                              />
                            </div>
                            {canStructure && (
                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  className="flex items-center gap-1 rounded-full bg-[#141416] px-3 py-1.5 text-[11px] font-semibold text-[#ffffff] transition hover:bg-[#27272a] dark:bg-[#f4f4f6] dark:text-[#141416]"
                                  onClick={() => setTaskForm({ competitionId, stageId: sel!.id, milestoneId: m.id })}
                                >
                                  <Plus size={12} /> Tambah Tugas
                                </button>
                                <button
                                  className="rounded-full p-2 text-white/45 hover:bg-[#f4f3ee] hover:text-white dark:hover:bg-white/10"
                                  onClick={() => setMsForm({ competitionId, stageId: sel!.id, milestoneId: m.id })}
                                  aria-label={`Edit milestone ${m.title}`}
                                >
                                  <Pencil size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                          <ul className="space-y-2.5">
                            {rows.map((t) => (
                              <TaskRow
                                key={t.id}
                                task={t}
                                onComplete={onComplete}
                                onTestAlarm={onTestAlarm}
                                readOnly={finished}
                                onEditTask={(x) => setTaskForm({ competitionId, stageId: x.stageId ?? sel!.id, milestoneId: x.milestoneId, taskId: x.id })}
                              />
                            ))}
                            {rows.length === 0 &&
                              (canStructure && !dateFilter && assignee === "all" ? (
                                <li className="pl-11">
                                  <button
                                    className="flex items-center gap-1.5 rounded-full border border-dashed border-[#d4d2ca] px-4 py-2 text-xs font-semibold text-white/70 hover:bg-[#f4f3ee] dark:border-white/20 dark:hover:bg-white/10"
                                    onClick={() => setTaskForm({ competitionId, stageId: sel!.id, milestoneId: m.id })}
                                  >
                                    <Plus size={13} /> Buat pekerjaan pertama di milestone ini
                                  </button>
                                </li>
                              ) : (
                                <li className="pl-11 text-xs text-white/40">Tidak ada tugas.</li>
                              ))}
                          </ul>
                        </div>
                      );
                    })}
                    {canStructure && sel && (
                      <button
                        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#d4d2ca] py-3 text-xs font-semibold text-white/60 transition hover:bg-[#f6f5f0] hover:text-white dark:border-white/20 dark:hover:bg-white/[0.05]"
                        onClick={() => setMsForm({ competitionId, stageId: sel.id })}
                      >
                        <Plus size={14} /> Tambah Milestone Baru
                      </button>
                    )}
                  </div>
                </section>
              )}
            </div>
            {showCal && (
              <div className="lg:sticky lg:top-5 lg:self-start">
                <CalendarPanel
                  competitionId={competitionId}
                  selected={dateFilter}
                  onSelect={setDateFilter}
                  onAddTask={addTaskOn}
                  canEdit={canStructure && !!(sel?.status !== "upcoming" ? sel : activeStage)}
                />
              </div>
            )}
          </div>
        </div>
      )}
      <TaskFormModal ctx={taskForm} onClose={() => setTaskForm(null)} />
      <MilestoneFormModal ctx={msForm} onClose={() => setMsForm(null)} />
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  onTestAlarm,
  onEditTask,
  readOnly,
}: {
  task: Task;
  onComplete: (id: string) => void;
  onTestAlarm: (id: string) => void;
  onEditTask: (t: Task) => void;
  readOnly: boolean;
}) {
  const { data, now, me, dispatch } = useStore();
  const confirm = useConfirm();
  const team = data.members.filter((m) => m.competitionId === task.competitionId);
  const isLeader = team.some((m) => m.userId === me && m.role === "leader");
  const user = data.users.find((u) => u.id === task.assignedTo);
  const state = dueState(task, now);
  const mine = task.assignedTo === me;
  const tone = state === "overdue" || state === "urgent" ? "danger" : state === "soon" ? "warn" : state === "done" ? "safe" : "neutral";
  const hot = state === "overdue" || state === "urgent";

  return (
    <motion.li
      layout
      className={`rounded-[22px] border p-4 transition-all ${
        hot
          ? "border-[#fbcfe8] bg-[#fce4ec]/45 dark:border-[#522437] dark:bg-[#331924]/50"
          : task.isCompleted
            ? "border-[#eae8e1] bg-[#f6f5f0]/60 dark:border-white/[0.05] dark:bg-white/[0.02]"
            : "border-[#eae8e1] bg-[#faf9f6] hover:bg-[#ffffff] hover:shadow-sm dark:border-white/[0.08] dark:bg-[#202024] dark:hover:bg-[#25252a]"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3.5">
        <span
          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
            task.isCompleted
              ? "bg-[#dcfce7] text-[#14532d] dark:bg-[#142e22] dark:text-[#86efac]"
              : hot
                ? "bg-[#fce4ec] text-[#881337] dark:bg-[#331924] dark:text-[#fda4af]"
                : "bg-[#f0efea] text-white/50 dark:bg-white/10"
          }`}
        >
          {task.isCompleted ? <CheckCircle2 size={16} /> : hot ? <BellRing size={16} className="animate-ring" /> : <Calendar size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold ${task.isCompleted ? "text-white/45 line-through" : ""}`}>{task.title}</div>
          {task.description && <div className="mt-1 text-xs leading-relaxed text-white/50">{task.description}</div>}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {user && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0efea] py-0.5 pl-1 pr-2.5 text-xs font-medium text-white/75 dark:bg-white/10">
                <Avatar user={user} size={18} /> {user.fullName.split(" ")[0]}
              </span>
            )}
            <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
            <Badge tone={tone} pulse={hot}>
              {task.isCompleted ? `Selesai ${fmtDate(task.completedAt!)}` : `${fmtDateTime(task.dueDate)} · ${relative(task.dueDate, now)}`}
            </Badge>
            {task.sourceNoteId && <Badge tone="warn">💡 Dari whiteboard</Badge>}
            {task.rescheduledFrom && !task.isCompleted && (
              <span title={`Semula ${fmtDateTime(task.rescheduledFrom)}`}>
                <Badge tone="safe">
                  <Zap size={11} /> Dijadwal ulang AI
                </Badge>
              </span>
            )}
            {task.gcalEventId && !task.isCompleted && (
              <span title="Terjadwal di Google Calendar" className="rounded-full bg-[#f0efea] px-2 py-0.5 text-[10px] font-medium text-white/60 dark:bg-white/10">
                GCal
              </span>
            )}
            {task.outlookEventId && !task.isCompleted && (
              <span title="Terjadwal di Outlook" className="rounded-full bg-[#dff0ff] px-2 py-0.5 text-[10px] font-medium text-[#1e3a8a] dark:bg-[#172736] dark:text-[#93c5fd]">
                Outlook
              </span>
            )}
            {task.isCompleted && (task.gcalEventId || task.outlookEventId) && <span className="text-[10px] text-white/35">pengingat kalender dinonaktifkan</span>}
            {task.proofUrl && (
              <a href={task.proofUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-[#14532d] hover:underline dark:text-[#86efac]">
                <ExternalLink size={12} /> Bukti
              </a>
            )}
          </div>
        </div>
        {!task.isCompleted && (
          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
            {isLeader && (
              <select
                className="field !w-auto !rounded-full !py-1.5 text-xs"
                value={task.assignedTo ?? ""}
                onChange={(e) => dispatch({ type: "assign", taskId: task.id, userId: e.target.value })}
                aria-label={`Ubah penanggung jawab: ${task.title}`}
              >
                {team.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {data.users.find((u) => u.id === m.userId)?.fullName.split(" ")[0]}
                  </option>
                ))}
              </select>
            )}
            {mine && (
              <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => onTestAlarm(task.id)} title="Uji alarm berdering untuk tugas ini">
                <Volume2 size={14} /> Uji Alarm
              </button>
            )}
            {(mine || data.members.some((m) => m.competitionId === task.competitionId && m.userId === me && m.role === "leader")) && (
              <button className={hot ? "btn-danger !px-3 !py-1.5 text-xs" : "btn-safe !px-3 !py-1.5 text-xs"} onClick={() => onComplete(task.id)}>
                <Send size={13} /> Selesai
              </button>
            )}
          </div>
        )}
        {!readOnly && (isLeader || mine) && (
          <div className="flex shrink-0 gap-1">
            <button
              className="rounded-full p-2 text-white/45 hover:bg-[#f0efea] hover:text-white dark:hover:bg-white/10"
              onClick={() => onEditTask(task)}
              aria-label={`Edit tugas ${task.title}`}
              title="Edit tugas"
            >
              <Pencil size={15} />
            </button>
            {isLeader && (
              <button
                className="rounded-full p-2 text-white/45 hover:bg-[#fce4ec] hover:text-[#881337] dark:hover:bg-[#331924] dark:hover:text-[#fda4af]"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Hapus tugas ini?",
                    item: task.title,
                    message: "Penanda kalender ikut dihapus dan skor kesiapan dihitung ulang. Tindakan ini tidak bisa dibatalkan.",
                    confirmLabel: "Hapus Tugas",
                    tone: "danger",
                    icon: "trash",
                  });
                  if (ok) dispatch({ type: "deleteTask", id: task.id });
                }}
                aria-label={`Hapus tugas ${task.title}`}
                title="Hapus tugas"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.li>
  );
}

function LockedStage({ stage, finished }: { stage: Stage; finished: boolean }) {
  const plan = stage.plan;
  return (
    <section className="card p-8 text-center" aria-label={`Babak ${stage.name} terkunci`}>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f2ee] text-white/50 dark:bg-white/10">
        <Lock size={22} />
      </span>
      <h2 className="mt-3 text-base font-bold">{finished ? `${stage.name} tidak dilanjutkan` : `${stage.name} masih terkunci`}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-white/55">
        {finished
          ? "Lomba sudah selesai sebelum babak ini dimulai."
          : `Tugas dan milestone babak ini dibuat otomatis ketika tim dinyatakan lolos ke sini. Tenggat babak: ${fmtLong(stage.deadline)}.`}
      </p>
      {!finished && plan && (plan.tasks.length > 0 || plan.marks.length > 0) && (
        <div className="mx-auto mt-4 max-w-md rounded-2xl bg-[#f6f5f0] p-4 text-left text-xs text-white/60 dark:bg-white/[0.04]">
          <div className="mb-1.5 font-semibold text-white/80">Sudah terbaca dari guidebook untuk babak ini</div>
          <ul className="list-disc space-y-1 pl-4">
            {plan.marks.map((m) => (
              <li key={m.name + m.date}>
                {m.name} ({m.date})
              </li>
            ))}
            {plan.tasks.map((t) => (
              <li key={t.title}>{t.title}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function GuideCard({ guide }: { guide: NonNullable<import("@/lib/types").Competition["guide"]> }) {
  return (
    <details className="card p-6 sm:p-7">
      <summary className="cursor-pointer text-sm font-bold">Isi Guidebook: rubrik, format berkas, dan aturan</summary>
      <div className="mt-4 grid gap-5 text-sm md:grid-cols-3">
        <div className="rounded-2xl bg-[#faf9f6] p-4 dark:bg-white/[0.03]">
          <div className="mb-2 text-xs font-semibold text-white/60">Rubrik penilaian</div>
          {guide.rubric.length === 0 ? (
            <p className="text-xs text-white/40">Tidak ditemukan.</p>
          ) : (
            <ul className="space-y-1.5">
              {guide.rubric.map((r) => (
                <li key={r.criterion} className="flex justify-between gap-2">
                  <span>{r.criterion}</span>
                  <span className="shrink-0 font-bold">{r.weight}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl bg-[#faf9f6] p-4 dark:bg-white/[0.03]">
          <div className="mb-2 text-xs font-semibold text-white/60">Format berkas</div>
          {guide.deliverables.length === 0 ? (
            <p className="text-xs text-white/40">Tidak ditemukan.</p>
          ) : (
            <ul className="list-disc space-y-1.5 pl-4">
              {guide.deliverables.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl bg-[#faf9f6] p-4 dark:bg-white/[0.03]">
          <div className="mb-2 text-xs font-semibold text-white/60">Aturan penting</div>
          {guide.rules.length === 0 ? (
            <p className="text-xs text-white/40">Tidak ditemukan.</p>
          ) : (
            <ul className="list-disc space-y-1.5 pl-4">
              {guide.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
