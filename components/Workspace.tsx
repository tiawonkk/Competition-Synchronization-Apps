"use client";

import { motion } from "framer-motion";
import {
  BellRing,
  Calendar,
  CheckCircle2,
  Cloud,
  ExternalLink,
  FileArchive,
  FileText,
  FolderOpen,
  Mail,
  Network,
  Presentation,
  Send,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { DAY, dueState, fmtDate, fmtDateTime, PRIORITY_LABEL, relative, scoreTone } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { ResourceKind, Task } from "@/lib/types";
import { Avatar, Badge, Gauge, PRIORITY_TONE, TONE } from "./ui";
import Whiteboard from "./Whiteboard";

const KIND_ICON: Record<ResourceKind, typeof FileText> = {
  guidebook: FileText,
  diagram: Network,
  deck: Presentation,
  zip: FileArchive,
  other: FileText,
};

export default function Workspace({
  competitionId,
  onComplete,
  onTestAlarm,
  onReport,
}: {
  competitionId: string;
  onComplete: (taskId: string) => void;
  onTestAlarm: (taskId: string) => void;
  onReport: () => void;
}) {
  const { data, now, me, readiness } = useStore();
  const [assignee, setAssignee] = useState<string>("all");
  const [showDone, setShowDone] = useState(true);
  const [tab, setTab] = useState<"tasks" | "board">("tasks");

  const comp = data.competitions.find((c) => c.id === competitionId)!;
  const team = data.members.filter((m) => m.competitionId === competitionId);
  const tasks = data.tasks.filter((t) => t.competitionId === competitionId);
  const milestones = data.milestones.filter((m) => m.competitionId === competitionId).sort((a, b) => a.orderIndex - b.orderIndex);
  const resources = data.resources.filter((r) => r.competitionId === competitionId);
  const userOf = (id: string | null) => data.users.find((u) => u.id === id);
  const score = readiness(competitionId);
  const done = tasks.filter((t) => t.isCompleted).length;
  const proofs = tasks.filter((t) => t.proofUrl).length;
  const daysLeft = Math.ceil((new Date(comp.submissionDeadline).getTime() - now) / DAY);
  const myRole = team.find((m) => m.userId === me)?.role;

  const visible = (t: Task) => (assignee === "all" || t.assignedTo === assignee) && (showDone || !t.isCompleted);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="glass relative overflow-hidden p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl" style={{ background: comp.accent }} />
        <div className="relative flex flex-wrap items-center gap-5">
          <Gauge value={score} size={112} color={TONE[scoreTone(score)].hex} label="Kesiapan" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="active">{comp.category}</Badge>
              <Badge tone={daysLeft <= 3 ? "danger" : daysLeft <= 7 ? "warn" : "safe"}>{daysLeft} hari menuju deadline</Badge>
              {myRole && <Badge tone="neutral">Peran Anda: {myRole === "leader" ? "Ketua" : "Anggota"}</Badge>}
            </div>
            <h1 className="mt-1.5 text-xl font-bold sm:text-2xl">{comp.title}</h1>
            <p className="text-sm text-white/60">{comp.theme}</p>
            <p className="mt-1 text-xs text-white/40">
              Deadline final: {fmtDateTime(comp.submissionDeadline)} · {done}/{tasks.length} tugas selesai · {proofs} bukti terunggah
            </p>
          </div>
          <button className="btn-primary" onClick={onReport}>
            <Mail size={16} /> Laporan Pembina
          </button>
        </div>
      </section>

      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 sm:w-fit" role="tablist">
        {([
          ["tasks", "Tugas & Milestone"],
          ["board", "Whiteboard & Ideasi"],
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
      ) : (
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Team */}
          <section className="glass p-4 sm:p-5" aria-labelledby="team-h">
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
              <div className="flex items-center gap-2 rounded-full border border-dashed border-white/15 px-3 py-1 text-xs text-white/50" title={comp.advisorEmail}>
                <Mail size={13} /> Pembina: {comp.advisorName}
              </div>
            </div>
          </section>

          {/* Milestones & tasks */}
          <section className="glass p-4 sm:p-5" aria-labelledby="task-h">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="task-h" className="text-sm font-semibold">
                Milestone &amp; Daftar Tugas
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
        </div>

        {/* Cloud vault */}
        <aside className="space-y-5">
          <section className="glass p-4 sm:p-5" aria-labelledby="vault-h">
            <h2 id="vault-h" className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Cloud size={16} className="text-active" /> Brankas Cloud
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {comp.onedriveFolderUrl && (
                <a href={comp.onedriveFolderUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-active/30 bg-active/10 p-3 transition hover:bg-active/20">
                  <FolderOpen size={18} className="text-active" />
                  <div className="mt-1.5 text-xs font-semibold">OneDrive Pro</div>
                  <div className="text-[10px] text-white/50">Folder bersama M365</div>
                </a>
              )}
              {comp.gdriveFolderUrl && (
                <a href={comp.gdriveFolderUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-safe/30 bg-safe/10 p-3 transition hover:bg-safe/20">
                  <FolderOpen size={18} className="text-safe" />
                  <div className="mt-1.5 text-xs font-semibold">Google Drive</div>
                  <div className="text-[10px] text-white/50">Folder bersama Gmail</div>
                </a>
              )}
            </div>
            <ul className="mt-3 space-y-1.5">
              {resources.map((r) => {
                const Icon = KIND_ICON[r.kind];
                return (
                  <li key={r.id}>
                    <a href={r.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/[0.06]">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${r.provider === "onedrive" ? "bg-active/15 text-active" : "bg-safe/15 text-safe"}`}>
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{r.title}</span>
                        <span className="text-[10px] text-white/40">
                          {r.provider === "onedrive" ? "OneDrive" : "Google Drive"} · {r.meta}
                        </span>
                      </span>
                      <ExternalLink size={13} className="text-white/20 group-hover:text-white/70" />
                    </a>
                  </li>
                );
              })}
              {resources.length === 0 && <li className="text-xs text-white/40">Belum ada dokumen.</li>}
            </ul>
          </section>
        </aside>
      </div>
      )}
    </div>
  );
}

function TaskRow({ task, onComplete, onTestAlarm }: { task: Task; onComplete: (id: string) => void; onTestAlarm: (id: string) => void }) {
  const { data, now, me } = useStore();
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
          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
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
