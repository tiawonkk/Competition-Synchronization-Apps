"use client";

import { motion } from "framer-motion";
import { BellRing, Calendar, CheckCircle2, ChevronRight, ExternalLink, Flag, KeyRound, Lock, Mail, Pencil, PlayCircle, Plus, Send, Volume2, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { OUTCOME_LABEL, STAGE_STATUS_LABEL } from "@/lib/evaluation";
import { buildStageWork } from "@/lib/generator";
import { generateStageUpdate } from "@/lib/report";
import { DAY, fmtLong, uid, dueState, fmtDate, fmtDateTime, PRIORITY_LABEL, relative, scoreTone } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Stage, Task } from "@/lib/types";
import type { EvalContext } from "./modals/EvaluationModal";
import CloudVault from "./CloudVault";
import { Avatar, Badge, Gauge, PRIORITY_TONE, TONE } from "./ui";
import Whiteboard from "./Whiteboard";

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
  const [assignee, setAssignee] = useState<string>("all");
  const [showDone, setShowDone] = useState(true);
  const [tab, setTab] = useState<"tasks" | "board" | "vault">("tasks");
  const [copied, setCopied] = useState(false);
  const [stageSel, setStageSel] = useState<string | null>(null);

  const comp = data.competitions.find((c) => c.id === competitionId)!;
  const team = data.members.filter((m) => m.competitionId === competitionId);
  const tasks = data.tasks.filter((t) => t.competitionId === competitionId);
  const stages = data.stages.filter((s) => s.competitionId === competitionId).sort((a, b) => a.orderIndex - b.orderIndex);
  const activeStage = stages.find((s) => s.status === "active");
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

  function advance() {
    if (!activeStage || !nextStage) return;
    if (!window.confirm(`Tandai ${activeStage.name} lolos dan buka ${nextStage.name}?`)) return;
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

  function eliminate() {
    if (!activeStage) return;
    if (!window.confirm(`Tandai tim gugur di ${activeStage.name}? Pengingat yang tersisa akan dibatalkan.`)) return;
    onEvaluate({ competitionId, stageId: activeStage.id, stageResult: "eliminated" });
  }

  const visible = (t: Task) => (assignee === "all" || t.assignedTo === assignee) && (showDone || !t.isCompleted);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="card relative overflow-hidden p-4 sm:p-5">
        <div className="relative flex flex-wrap items-center gap-5">
          <Gauge value={score} size={112} color={TONE[scoreTone(score)].hex} label="Kesiapan" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="active">{comp.category}</Badge>
              <Badge tone={daysLeft <= 3 ? "danger" : daysLeft <= 7 ? "warn" : "safe"}>{daysLeft} hari menuju deadline</Badge>
              {myRole && <Badge tone="neutral">Peran Anda: {myRole === "leader" ? "Ketua" : "Anggota"}{myMember?.teamRole ? ` · ${myMember.teamRole}` : ""}</Badge>}
            </div>
            <h1 className="mt-1.5 text-xl font-bold sm:text-2xl">{comp.title}</h1>
            <p className="text-sm text-white/60">{comp.theme || "Tema belum diisi"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
              <KeyRound size={13} /> Kode undangan:
              <button
                onClick={copyCode}
                className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono font-semibold tracking-wider text-white hover:bg-white/10"
                title="Salin kode undangan"
              >
                {comp.inviteCode}
              </button>
              <span className="text-white/40">{copied ? "Tersalin!" : `${team.length}/5 anggota`}</span>
            </div>
            <p className="mt-1 text-xs text-white/40">
              Deadline final: {fmtDateTime(comp.submissionDeadline)} · {done}/{tasks.length} tugas selesai · {proofs} bukti terunggah
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
      <section className="card p-4 sm:p-5" aria-labelledby="pipe-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="pipe-h" className="text-sm font-semibold">Alur Babak Lomba</h2>
          {myRole === "leader" && !finished && (
            <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={onAddStage}>
              <Plus size={14} /> Tambah Babak
            </button>
          )}
        </div>
        <ol className="flex items-stretch gap-1.5 overflow-x-auto pb-1" aria-label="Daftar babak">
          {stages.map((s, i) => {
            const StageIcon = s.status === "passed" ? CheckCircle2 : s.status === "eliminated" ? XCircle : s.status === "active" ? PlayCircle : Lock;
            const tone = s.status === "passed" ? "text-safe" : s.status === "eliminated" ? "text-danger" : s.status === "active" ? "text-active" : "text-white/35";
            const dropped = finished && s.status === "upcoming";
            return (
              <li key={s.id} className="flex items-center gap-1.5">
                <button
                  onClick={() => setStageSel(s.id)}
                  aria-current={sel?.id === s.id ? "step" : undefined}
                  className={`min-w-[8.5rem] rounded-2xl border px-3 py-2.5 text-left transition ${sel?.id === s.id ? "border-active bg-active/[0.08]" : "border-white/10 hover:bg-white/[0.05]"}`}
                >
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
                    <StageIcon size={14} /> {dropped ? "Tidak dilanjutkan" : STAGE_STATUS_LABEL[s.status]}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold">{s.name}</span>
                  <span className="block text-[11px] text-white/45">{fmtDate(s.deadline)}</span>
                </button>
                {i < stages.length - 1 && <ChevronRight size={16} className="shrink-0 text-white/25" />}
              </li>
            );
          })}
        </ol>

        {finished && evaluation && (
          <p className="mt-3 rounded-xl bg-safe/10 px-3.5 py-2.5 text-sm text-safe">
            Lomba selesai: <strong>{OUTCOME_LABEL[evaluation.outcome]}</strong>
            {evaluation.rank ? ` · ${evaluation.rank}` : ""}. Evaluasi tersimpan di Riwayat.
          </p>
        )}

        {myRole === "leader" && !finished && activeStage && (
          <div className={`mt-3 rounded-2xl p-3.5 ${stageDone ? "bg-safe/[0.1]" : "bg-white/[0.04]"}`}>
            <div className="text-sm font-semibold">
              {stageDone ? `Semua tugas ${activeStage.name} selesai. Bagaimana hasil babak ini?` : `Keputusan hasil ${activeStage.name}`}
            </div>
            {!stageDone && <p className="text-xs text-white/50">Tekan setelah panitia mengumumkan hasil, bahkan bila masih ada tugas yang terbuka.</p>}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {nextStage ? (
                <button className="btn-safe" onClick={advance}>
                  🎉 Lolos ke {nextStage.name}
                </button>
              ) : (
                <button className="btn-safe" onClick={() => onEvaluate({ competitionId, stageId: activeStage.id, stageResult: "passed" })}>
                  🏁 Selesai Lomba
                </button>
              )}
              <button className="btn-ghost !border-danger/40 !text-danger hover:!bg-danger/10" onClick={eliminate}>
                🛑 Gugur di Babak Ini
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 sm:w-fit" role="tablist">
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
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${tab === id ? "bg-surface text-white shadow-sm" : "text-white/55 hover:text-white"}`}
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
      <div>
        <div className="space-y-5">
          {/* Team */}
          <section className="card p-4 sm:p-5" aria-labelledby="team-h">
            <h2 id="team-h" className="mb-3 text-sm font-semibold">
              Anggota Tim ({team.length}) &amp; Sinkronisasi Akun
            </h2>
            <div className="flex flex-wrap gap-2">
              {team.map((m) => {
                const u = userOf(m.userId)!;
                const active = assignee === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => setAssignee(active ? "all" : u.id)}
                    className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition ${
                      active ? "border-active bg-active/15" : "border-white/10 bg-white/[0.04] hover:bg-white/10"
                    }`}
                    aria-pressed={active}
                  >
                    <Avatar user={u} size={30} />
                    <span>
                      <span className="block text-xs font-medium leading-tight">
                        {u.fullName.split(" ")[0]} {m.role === "leader" && <span className="text-warn">★</span>}
                      </span>
                      {m.teamRole && <span className="block text-[9px] leading-tight text-white/45">{m.teamRole}</span>}
                      <span className="flex gap-1 pt-0.5">
                        {u.emailGoogle && (
                          <span className="rounded bg-white/10 px-1 text-[9px] text-white/70" title={u.emailGoogle}>
                            Gmail ✓
                          </span>
                        )}
                        {u.emailMicrosoft && (
                          <span className="rounded bg-active/20 px-1 text-[9px] text-active" title={u.emailMicrosoft}>
                            M365 ✓
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
              <div className="flex items-center gap-2 rounded-full border border-dashed border-white/15 px-3 py-1 text-xs text-white/50" title={comp.advisorEmail || undefined}>
                <Mail size={13} /> Pembina: {comp.advisorName || comp.advisorEmail || "belum diisi"}
              </div>
            </div>
          </section>

          {comp.guide && <GuideCard guide={comp.guide} />}

          {/* Milestones & tasks */}
          {sel?.status === "upcoming" ? (
            <LockedStage stage={sel} finished={finished} />
          ) : (
          <section className="card p-4 sm:p-5" aria-labelledby="task-h">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="task-h" className="text-sm font-semibold">
                Milestone &amp; Tugas{sel ? ` · ${sel.name}` : ""}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <select className="field !w-auto !py-1.5 text-xs" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Filter penanggung jawab">
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
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-white/60">
                  <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-blue-500" />
                  Tampilkan selesai
                </label>
              </div>
            </div>

            <div className="space-y-5">
              {selTasks.length === 0 && <p className="py-4 text-center text-xs text-white/40">Belum ada tugas di babak ini.</p>}
              {milestones.map((m) => {
                const mt = tasks.filter((t) => t.milestoneId === m.id);
                const mDone = mt.filter((t) => t.isCompleted).length;
                const rows = mt.filter(visible).sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
                if (rows.length === 0 && assignee !== "all") return null;
                return (
                  <div key={m.id}>
                    <div className="mb-2 flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-md text-xs font-bold" style={{ background: `${comp.accent}33`, color: comp.accent }}>
                        {m.orderIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{m.title}</div>
                        <div className="text-[11px] text-white/40">Target {fmtDate(m.targetDate)}</div>
                      </div>
                      <span className="text-xs tabular-nums text-white/50">
                        {mDone}/{mt.length}
                      </span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                        <motion.div className="h-full rounded-full bg-safe" initial={false} animate={{ width: `${mt.length ? (mDone / mt.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {rows.map((t) => (
                        <TaskRow key={t.id} task={t} onComplete={onComplete} onTestAlarm={onTestAlarm} />
                      ))}
                      {rows.length === 0 && <li className="pl-9 text-xs text-white/30">Tidak ada tugas.</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
          )}
        </div>

      </div>
      )}
    </div>
  );
}

function TaskRow({ task, onComplete, onTestAlarm }: { task: Task; onComplete: (id: string) => void; onTestAlarm: (id: string) => void }) {
  const { data, now, me, dispatch } = useStore();
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
      className={`rounded-xl border p-3 ${hot ? "border-danger/40 bg-danger/[0.07]" : task.isCompleted ? "border-white/[0.05] bg-white/[0.02]" : "border-white/[0.08] bg-white/[0.03]"}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className={`mt-0.5 ${task.isCompleted ? "text-safe" : hot ? "text-danger" : "text-white/30"}`}>
          {task.isCompleted ? <CheckCircle2 size={18} /> : hot ? <BellRing size={18} className="animate-ring" /> : <Calendar size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium ${task.isCompleted ? "text-white/50 line-through" : ""}`}>{task.title}</div>
          <div className="mt-0.5 text-xs text-white/40">{task.description}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {user && (
              <span className="flex items-center gap-1.5 text-xs text-white/60">
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
            {task.gcalEventId && !task.isCompleted && <span title="Terjadwal di Google Calendar" className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">GCal</span>}
            {task.outlookEventId && !task.isCompleted && <span title="Terjadwal di Outlook" className="rounded bg-active/20 px-1.5 py-0.5 text-[10px] text-active">Outlook</span>}
            {task.isCompleted && (task.gcalEventId || task.outlookEventId) && <span className="text-[10px] text-white/30">pengingat kalender dinonaktifkan</span>}
            {task.proofUrl && (
              <a href={task.proofUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-safe hover:underline">
                <ExternalLink size={11} /> Bukti
              </a>
            )}
          </div>
        </div>
        {!task.isCompleted && (
          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
            {isLeader && (
              <select
                className="field !w-auto !py-1.5 text-xs"
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
              <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => onTestAlarm(task.id)} title="Uji alarm berdering untuk tugas ini">
                <Volume2 size={14} /> Uji Alarm
              </button>
            )}
            {(mine || data.members.some((m) => m.competitionId === task.competitionId && m.userId === me && m.role === "leader")) && (
              <button className={hot ? "btn-danger !px-2.5 !py-1.5 text-xs" : "btn-safe !px-2.5 !py-1.5 text-xs"} onClick={() => onComplete(task.id)}>
                <Send size={14} /> Selesai
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
    <section className="card p-5 text-center" aria-label={`Babak ${stage.name} terkunci`}>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.07] text-white/50">
        <Lock size={22} />
      </span>
      <h2 className="mt-3 text-base font-bold">{finished ? `${stage.name} tidak dilanjutkan` : `${stage.name} masih terkunci`}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-white/55">
        {finished
          ? "Lomba sudah selesai sebelum babak ini dimulai."
          : `Tugas dan milestone babak ini dibuat otomatis ketika tim dinyatakan lolos ke sini. Tenggat babak: ${fmtLong(stage.deadline)}.`}
      </p>
      {!finished && plan && (plan.tasks.length > 0 || plan.marks.length > 0) && (
        <div className="mx-auto mt-4 max-w-md rounded-2xl bg-white/[0.04] p-3 text-left text-xs text-white/60">
          <div className="mb-1 font-semibold text-white/80">Sudah terbaca dari guidebook untuk babak ini</div>
          <ul className="list-disc space-y-0.5 pl-4">
            {plan.marks.map((m) => (
              <li key={m.name + m.date}>{m.name} ({m.date})</li>
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
    <details className="card p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-semibold">Isi Guidebook: rubrik, format berkas, dan aturan</summary>
      <div className="mt-3 grid gap-4 text-sm md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-semibold text-white/60">Rubrik penilaian</div>
          {guide.rubric.length === 0 ? <p className="text-xs text-white/40">Tidak ditemukan.</p> : (
            <ul className="space-y-1">
              {guide.rubric.map((r) => (
                <li key={r.criterion} className="flex justify-between gap-2"><span>{r.criterion}</span><span className="shrink-0 font-semibold">{r.weight}</span></li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-white/60">Format berkas</div>
          {guide.deliverables.length === 0 ? <p className="text-xs text-white/40">Tidak ditemukan.</p> : (
            <ul className="list-disc space-y-1 pl-4">{guide.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
          )}
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-white/60">Aturan penting</div>
          {guide.rules.length === 0 ? <p className="text-xs text-white/40">Tidak ditemukan.</p> : (
            <ul className="list-disc space-y-1 pl-4">{guide.rules.map((r) => <li key={r}>{r}</li>)}</ul>
          )}
        </div>
      </div>
    </details>
  );
}
