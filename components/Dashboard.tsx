"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, BellRing, CalendarClock, CheckCircle2, Flag, KeyRound, Loader2, Plus, Radar, ShieldCheck, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DAY,
  detectCollisions,
  dueState,
  fmtDate,
  fmtDateTime,
  fmtTime,
  isAlarming,
  planReschedule,
  PRIORITY_LABEL,
  relative,
  scoreTone,
  type RescheduleMove,
} from "@/lib/logic";
import { useStore } from "@/lib/store";
import CompetitionCalendar from "./CompetitionCalendar";
import { Avatar, Badge, Gauge, PRIORITY_TONE, TONE } from "./ui";

export default function Dashboard({
  onOpen,
  onComplete,
  onCreate,
  onJoin,
}: {
  onOpen: (competitionId: string) => void;
  onComplete: (taskId: string) => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  // Finished competitions live in Riwayat; the dashboard only tracks the ones still running.
  const { data, now, me, liveCompetitions: myCompetitions, dispatch, readiness } = useStore();
  const [optimizing, setOptimizing] = useState(false);
  const [outcome, setOutcome] = useState<{ moves: RescheduleMove[]; remaining: number } | null>(null);
  const active = myCompetitions.filter((c) => c.status === "active");
  // Everything below is scoped to the competitions the signed-in user belongs to.
  const myTasks = useMemo(() => {
    const ids = new Set(myCompetitions.map((c) => c.id));
    return data.tasks.filter((t) => ids.has(t.competitionId));
  }, [myCompetitions, data.tasks]);
  const collisions = useMemo(() => detectCollisions(myCompetitions, myTasks, now), [myCompetitions, myTasks, now]);

  function optimize() {
    setOptimizing(true);
    // Brief delay so the "AI" step is visible; the planner itself is deterministic and instant.
    setTimeout(() => {
      const plan = planReschedule(myCompetitions, myTasks, now);
      if (plan.moves.length > 0) dispatch({ type: "reschedule", moves: plan.moves });
      setOutcome(plan);
      setOptimizing(false);
    }, 900);
  }
  const compName = (id: string) => data.competitions.find((c) => c.id === id)!;

  const liveIds = new Set(myCompetitions.map((c) => c.id));
  const myOpen = data.tasks
    .filter((t) => t.assignedTo === me && !t.isCompleted && liveIds.has(t.competitionId))
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  const urgentCount = myOpen.filter((t) => isAlarming(t, now)).length;

  if (myCompetitions.length === 0) {
    return (
      <div className="card mx-auto mt-6 max-w-2xl p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-active/15 text-active">
          <Radar size={26} />
        </span>
        <h2 className="mt-4 text-xl font-bold">Belum ada lomba</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-white/60">Buat lomba baru sebagai Ketua, atau gabung ke tim temanmu dengan kode undangan.</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <button className="btn-primary" onClick={onCreate}>
            <Plus size={16} /> Buat Lomba Baru
          </button>
          <button className="btn-ghost" onClick={onJoin}>
            <KeyRound size={16} /> Gabung Lomba
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<Radar size={16} />} label="Kompetisi Aktif" value={active.length} bg="lav" />
        <Tile icon={<CalendarClock size={16} />} label="Tugas Saya (Terbuka)" value={myOpen.length} bg="sky" />
        <Tile icon={<BellRing size={16} />} label="Perlu Alarm (< 24 jam)" value={urgentCount} bg={urgentCount ? "peach" : "mint"} />
        <Tile
          icon={collisions.length ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
          label="Bentrok Jadwal"
          value={collisions.length}
          bg={collisions.length ? "peach" : "cream"}
        />
      </div>

      {/* Collision radar */}
      <section className="card p-4 sm:p-5" aria-labelledby="radar-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="radar-h" className="flex items-center gap-2 text-sm font-semibold">
            <Radar size={16} className="text-active" /> Radar Bentrok Jadwal
            <span className="text-xs font-normal text-white/40">jendela 48 jam lintas kompetisi</span>
          </h2>
          {collisions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="danger" pulse>
                {collisions.length} peringatan
              </Badge>
              <button className="btn-danger !py-1.5 text-xs" onClick={optimize} disabled={optimizing}>
                {optimizing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Optimasi Jadwal Bentrok (AI Rescheduler)
              </button>
            </div>
          )}
        </div>
        {outcome && (
          <div className={`mb-3 rounded-xl border p-4 text-sm ${outcome.remaining === 0 ? "border-safe/30 bg-safe/10" : "border-warn/30 bg-warn/10"}`} role="status">
            <div className={`flex items-center gap-2 font-medium ${outcome.remaining === 0 ? "text-safe" : "text-warn"}`}>
              {outcome.remaining === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {outcome.moves.length > 0
                ? `${outcome.moves.length} tugas dipindahkan. Event Google Calendar dan Outlook sudah diperbarui.`
                : "Tidak ada tugas yang bisa dipindahkan otomatis."}
            </div>
            {outcome.moves.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-white/70">
                {outcome.moves.map((m) => (
                  <li key={m.taskId}>
                    <span className="font-medium text-white/90">{m.title}</span> ({compName(m.competitionId).title}): {fmtDateTime(m.from)} → <strong>{fmtDateTime(m.to)}</strong>
                  </li>
                ))}
              </ul>
            )}
            {outcome.remaining > 0 && (
              <p className="mt-2 text-xs text-white/70">
                {outcome.remaining} bentrok tersisa melibatkan deadline final dua lomba atau tidak punya slot kosong. Bicarakan dengan Ketua tim untuk menggesernya manual.
              </p>
            )}
          </div>
        )}
        {collisions.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-safe/30 bg-safe/10 p-4 text-sm text-safe">
            <ShieldCheck size={18} /> Aman — tidak ada tenggat berat yang berhimpitan antar-kompetisi.
          </div>
        ) : (
          <div className="space-y-3">
            {collisions.map((c) => {
              const tone = c.severity === "critical" ? "danger" : "warn";
              const t = TONE[tone];
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border p-4 ${t.bg} ${t.border}`}
                 
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={tone} pulse={c.severity === "critical"}>
                      <AlertTriangle size={12} /> Peringatan Bentrok Jadwal · {c.severity === "critical" ? "Kritis" : "Waspada"}
                    </Badge>
                    <span className="text-sm font-medium">
                      {compName(c.competitionA).title} <span className="text-white/40">×</span> {compName(c.competitionB).title}
                    </span>
                    <span className="text-xs text-white/50">selisih terdekat {c.hoursApart} jam</span>
                  </div>
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {c.items.map((i, k) => (
                      <li key={k} className="flex items-start gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-xs">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: compName(i.competitionId).accent }} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-white/90">{i.label}</span>
                          <span className="text-white/50">
                            {compName(i.competitionId).title} · {fmtDateTime(i.at)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 flex gap-2 text-xs text-white/80">
                    <Zap size={14} className={`mt-0.5 shrink-0 ${t.text}`} />
                    <span>
                      <strong className={t.text}>Saran:</strong> {c.suggestion}
                    </span>
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Readiness gauges */}
      <section aria-labelledby="ready-h">
        <h2 id="ready-h" className="mb-3 text-sm font-semibold">
          Skor Kesiapan Kompetisi
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((c) => {
            const score = readiness(c.id);
            const tone = scoreTone(score);
            const tasks = data.tasks.filter((t) => t.competitionId === c.id);
            const left = Math.ceil((new Date(c.submissionDeadline).getTime() - now) / DAY);
            const team = data.members.filter((m) => m.competitionId === c.id);
            return (
              <button
                key={c.id}
                onClick={() => onOpen(c.id)}
                className="card group p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-center gap-4">
                  <Gauge value={score} color={TONE[tone].hex} label="siap" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.accent }} />
                      <span className="text-[11px] text-white/50">{c.category}</span>
                    </div>
                    <div className="truncate font-semibold">{c.title}</div>
                    <div className="mt-1 text-xs text-white/50">
                      {tasks.filter((t) => t.isCompleted).length}/{tasks.length} tugas · {left} hari lagi
                    </div>
                    <div className="mt-2 flex -space-x-2">
                      {team.map((m) => {
                        const u = data.users.find((u) => u.id === m.userId) ?? { id: m.userId, fullName: "Anggota", color: "#6366F1" };
                        return <Avatar key={m.userId} user={u} size={24} />;
                      })}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-white/30 transition group-hover:translate-x-1 group-hover:text-white/70" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Calendar across all my competitions */}
      <CompetitionCalendar onComplete={onComplete} />

      {/* My urgent tasks */}
      <section className="card p-4 sm:p-5" aria-labelledby="my-h">
        <h2 id="my-h" className="mb-3 text-sm font-semibold">
          Tugas Saya yang Paling Dekat
        </h2>
        <ul className="divide-y divide-white/[0.06]">
          {myOpen.slice(0, 5).map((t) => {
            const comp = compName(t.competitionId);
            const state = dueState(t, now);
            const tone = state === "overdue" || state === "urgent" ? "danger" : state === "soon" ? "warn" : "neutral";
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="h-8 w-1 rounded-full" style={{ background: comp.accent }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-white/50">{comp.title}</div>
                </div>
                <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                <Badge tone={tone} pulse={state === "urgent" || state === "overdue"}>
                  {relative(t.dueDate, now)}
                </Badge>
                <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => onComplete(t.id)}>
                  <CheckCircle2 size={14} /> Selesai
                </button>
              </li>
            );
          })}
          {myOpen.length === 0 && <li className="py-4 text-sm text-white/50">Semua tugas Anda sudah selesai. 🎉</li>}
        </ul>
      </section>

      {/* Notification log */}
      <section className="card p-4 sm:p-5" aria-labelledby="log-h">
        <h2 id="log-h" className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <BellRing size={16} className="text-active" /> Log Notifikasi
        </h2>
        {data.notices.length === 0 ? (
          <p className="text-xs text-white/40">Belum ada aktivitas. Pembaruan kalender, anggota baru, dan laporan akan muncul di sini.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.notices.slice(0, 6).map((n) => (
              <li key={n.id} className="flex items-start gap-2.5 text-xs">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[n.tone].hex }} />
                <span className="min-w-0 flex-1 text-white/80">{n.text}</span>
                <span className="shrink-0 tabular-nums text-white/35">{fmtTime(n.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Pastel stat block. Text stays in the foreground colour so it reads on every tint, light or dark. */
function Tile({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: "lav" | "mint" | "cream" | "peach" | "sky" }) {
  return (
    <div className="rounded-3xl p-4 sm:p-5" style={{ background: `var(--tile-${bg})` }}>
      <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#fff]/60 text-[#1c1c22] dark:bg-[#fff]/10 dark:text-[#fff]">{icon}</span>
        {label}
      </div>
      <div className="mt-3 text-4xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
