"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, BellRing, CalendarClock, CheckCircle2, KeyRound, Loader2, Plus, Radar, ShieldCheck, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DAY,
  detectCollisions,
  dueState,
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
      <div className="card mx-auto mt-8 max-w-2xl p-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#ece6ff] text-[#3b1d8f] dark:bg-[#251f38] dark:text-[#c4b5fd]">
          <Radar size={28} />
        </span>
        <h2 className="mt-5 text-2xl font-bold tracking-tight">Belum ada lomba</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/60">
          Buat lomba baru sebagai Ketua, atau gabung ke tim temanmu dengan kode undangan.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
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
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={<Radar size={17} />} label="Kompetisi Aktif" value={active.length} bg="lav" />
        <Tile icon={<CalendarClock size={17} />} label="Tugas Saya (Terbuka)" value={myOpen.length} bg="sky" />
        <Tile icon={<BellRing size={17} />} label="Perlu Alarm (< 24 jam)" value={urgentCount} bg={urgentCount ? "peach" : "mint"} />
        <Tile
          icon={collisions.length ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
          label="Bentrok Jadwal"
          value={collisions.length}
          bg={collisions.length ? "peach" : "cream"}
        />
      </div>

      {/* Collision radar */}
      <section className="card p-6 sm:p-7" aria-labelledby="radar-h">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="radar-h" className="flex items-center gap-2.5 text-base font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ece6ff] text-[#3b1d8f] dark:bg-[#251f38] dark:text-[#c4b5fd]">
              <Radar size={16} />
            </span>
            Radar Bentrok Jadwal
            <span className="text-xs font-normal text-white/45">jendela 48 jam lintas kompetisi</span>
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
          <div
            className={`mb-4 rounded-2xl border p-4 text-sm ${
              outcome.remaining === 0
                ? "border-[#bbf7d0] bg-[#dcfce7] text-[#14532d] dark:border-[#1f4e38] dark:bg-[#142e22] dark:text-[#86efac]"
                : "border-[#fde68a] bg-[#fef4c7] text-[#78350f] dark:border-[#4d3b1e] dark:bg-[#302615] dark:text-[#fcd34d]"
            }`}
            role="status"
          >
            <div className="flex items-center gap-2 font-semibold">
              {outcome.remaining === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {outcome.moves.length > 0
                ? `${outcome.moves.length} tugas dipindahkan. Event Google Calendar dan Outlook sudah diperbarui.`
                : "Tidak ada tugas yang bisa dipindahkan otomatis."}
            </div>
            {outcome.moves.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs opacity-85">
                {outcome.moves.map((m) => (
                  <li key={m.taskId}>
                    <span className="font-semibold">{m.title}</span> ({compName(m.competitionId).title}): {fmtDateTime(m.from)} → <strong>{fmtDateTime(m.to)}</strong>
                  </li>
                ))}
              </ul>
            )}
            {outcome.remaining > 0 && (
              <p className="mt-2 text-xs opacity-85">
                {outcome.remaining} bentrok tersisa melibatkan deadline final dua lomba atau tidak punya slot kosong. Bicarakan dengan Ketua tim untuk menggesernya manual.
              </p>
            )}
          </div>
        )}
        {collisions.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[#bbf7d0] bg-[#dcfce7]/65 px-4 py-3.5 text-sm font-medium text-[#14532d] dark:border-[#1f4e38] dark:bg-[#142e22] dark:text-[#86efac]">
            <ShieldCheck size={18} /> Aman — tidak ada tenggat berat yang berhimpitan antar-kompetisi.
          </div>
        ) : (
          <div className="space-y-3.5">
            {collisions.map((c) => {
              const tone = c.severity === "critical" ? "danger" : "warn";
              const t = TONE[tone];
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border p-5 ${t.bg} ${t.border}`}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tone={tone} pulse={c.severity === "critical"}>
                      <AlertTriangle size={12} /> Peringatan Bentrok Jadwal · {c.severity === "critical" ? "Kritis" : "Waspada"}
                    </Badge>
                    <span className="text-sm font-bold">
                      {compName(c.competitionA).title} <span className="opacity-45">×</span> {compName(c.competitionB).title}
                    </span>
                    <span className="text-xs opacity-65">selisih terdekat {c.hoursApart} jam</span>
                  </div>
                  <ul className="mt-3.5 grid gap-2 sm:grid-cols-2">
                    {c.items.map((i, k) => (
                      <li key={k} className="flex items-start gap-2.5 rounded-xl bg-[#ffffff]/70 px-3.5 py-2.5 text-xs dark:bg-[#141416]/40">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: compName(i.competitionId).accent }} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{i.label}</span>
                          <span className="opacity-65">
                            {compName(i.competitionId).title} · {fmtDateTime(i.at)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3.5 flex gap-2 text-xs">
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
        <h2 id="ready-h" className="mb-3.5 px-1 text-base font-bold tracking-tight">
          Skor Kesiapan Kompetisi
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                className="card group p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <Gauge value={score} color={TONE[tone].hex} label="siap" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.accent }} />
                      <span className="text-xs font-medium text-white/55">{c.category}</span>
                    </div>
                    <div className="mt-1 truncate text-base font-bold tracking-tight">{c.title}</div>
                    <div className="mt-1 text-xs text-white/55">
                      {tasks.filter((t) => t.isCompleted).length}/{tasks.length} tugas · {left} hari lagi
                    </div>
                    <div className="mt-3 flex -space-x-2">
                      {team.map((m) => {
                        const u = data.users.find((u) => u.id === m.userId) ?? { id: m.userId, fullName: "Anggota", color: "#6366F1" };
                        return <Avatar key={m.userId} user={u} size={26} />;
                      })}
                    </div>
                  </div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f3f2ee] text-[#141416] transition group-hover:bg-[#141416] group-hover:text-[#ffffff] dark:bg-[#27272a] dark:text-[#f4f4f6] dark:group-hover:bg-[#f4f4f6] dark:group-hover:text-[#141416]">
                    <ArrowUpRight size={16} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Calendar across all my competitions */}
      <CompetitionCalendar onComplete={onComplete} />

      {/* My urgent tasks */}
      <section className="card p-6 sm:p-7" aria-labelledby="my-h">
        <h2 id="my-h" className="mb-4 text-base font-bold tracking-tight">
          Tugas Saya yang Paling Dekat
        </h2>
        <ul className="divide-y divide-[#eae8e1] dark:divide-white/[0.06]">
          {myOpen.slice(0, 5).map((t) => {
            const comp = compName(t.competitionId);
            const state = dueState(t, now);
            const tone = state === "overdue" || state === "urgent" ? "danger" : state === "soon" ? "warn" : "neutral";
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3.5 py-3.5">
                <span className="h-8 w-1.5 rounded-full" style={{ background: comp.accent }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.title}</div>
                  <div className="mt-0.5 text-xs text-white/50">{comp.title}</div>
                </div>
                <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                <Badge tone={tone} pulse={state === "urgent" || state === "overdue"}>
                  {relative(t.dueDate, now)}
                </Badge>
                <button className="btn-ghost !px-3.5 !py-1.5 text-xs" onClick={() => onComplete(t.id)}>
                  <CheckCircle2 size={14} /> Selesai
                </button>
              </li>
            );
          })}
          {myOpen.length === 0 && <li className="py-5 text-sm text-white/55">Semua tugas Anda sudah selesai. 🎉</li>}
        </ul>
      </section>

      {/* Notification log */}
      <section className="card p-6 sm:p-7" aria-labelledby="log-h">
        <h2 id="log-h" className="mb-4 flex items-center gap-2.5 text-base font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#fef4c7] text-[#78350f] dark:bg-[#302615] dark:text-[#fcd34d]">
            <BellRing size={15} />
          </span>
          Log Notifikasi
        </h2>
        {data.notices.length === 0 ? (
          <p className="text-xs text-white/45">Belum ada aktivitas. Pembaruan kalender, anggota baru, dan laporan akan muncul di sini.</p>
        ) : (
          <ul className="space-y-2">
            {data.notices.slice(0, 6).map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-2xl bg-[#faf9f6] px-4 py-2.5 text-xs dark:bg-white/[0.03]">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[n.tone].hex }} />
                <span className="min-w-0 flex-1 text-white/80">{n.text}</span>
                <span className="shrink-0 tabular-nums text-white/40">{fmtTime(n.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Pastel stat block inspired by the reference cards. */
function Tile({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: "lav" | "mint" | "cream" | "peach" | "sky" }) {
  return (
    <div
      className="rounded-[28px] border border-black/[0.04] p-5 sm:p-6 shadow-sm dark:border-white/[0.06]"
      style={{ background: `var(--tile-${bg})` }}
    >
      <div className="flex items-center gap-2.5 text-xs font-semibold text-[#141416]/80 dark:text-[#f4f4f6]/85">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ffffff]/85 text-[#141416] shadow-sm dark:bg-[#141416]/50 dark:text-[#f4f4f6]">
          {icon}
        </span>
        <span className="leading-snug">{label}</span>
      </div>
      <div className="mt-4 text-4xl font-extrabold tracking-tight tabular-nums text-[#141416] dark:text-[#f4f4f6]">{value}</div>
    </div>
  );
}
