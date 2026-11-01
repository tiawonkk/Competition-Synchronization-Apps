"use client";

import { CalendarDays, Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DAY, dayKey, detectCollisions, fmtTime } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { useConfirm } from "./ConfirmDialog";
import TaskFormModal, { type TaskFormCtx } from "./modals/TaskFormModal";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const HOUR_H = 44; // px per hour in the week view
const monthFmt = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });

type View = "month" | "week";
type Tone = "blue" | "amber" | "red" | "green" | "indigo" | "gold";

const TONE_CLS: Record<Tone, string> = {
  blue: "bg-[#dff0ff] text-[#1e3a8a] dark:bg-[#172736] dark:text-[#93c5fd]",
  amber: "bg-[#fef4c7] text-[#78350f] dark:bg-[#302615] dark:text-[#fcd34d]",
  red: "bg-[#fce4ec] text-[#881337] dark:bg-[#331924] dark:text-[#fda4af]",
  green: "bg-[#dcfce7] text-[#14532d] dark:bg-[#142e22] dark:text-[#86efac]",
  indigo: "bg-[#ece6ff] text-[#3b1d8f] dark:bg-[#251f38] dark:text-[#c4b5fd]",
  gold: "bg-[#fde5d0] text-[#7c2d12] dark:bg-[#331f1a] dark:text-[#fdba74]",
};

interface Ev {
  id: string;
  kind: "milestone" | "stage" | "task";
  competitionId: string;
  at: string;
  day: string;
  title: string;
  emoji: string;
  tone: Tone;
  done: boolean;
  task?: Task;
}

/** Short tag for a competition: its first word when short (STACK), otherwise the initials (HNA). */
const tagOf = (title: string) => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return words[0].length <= 6 ? words[0].toUpperCase() : words.map((w) => w[0]).join("").toUpperCase().slice(0, 5);
};
const startOfWeek = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday first
  return d;
};

/** Real calendar across every running competition: month grid and 7-day time grid, event pills, collision flags and a day drawer. */
export default function CompetitionCalendar({ onComplete }: { onComplete: (taskId: string) => void }) {
  const { data, now, me, liveCompetitions, dispatch } = useStore();
  const confirm = useConfirm();
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(now);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormCtx | null>(null);
  const [addFor, setAddFor] = useState<string>("");
  const weekScroll = useRef<HTMLDivElement>(null);
  const today = dayKey(now);

  const comps = liveCompetitions;
  const leaderOf = (cid: string) => data.members.some((m) => m.competitionId === cid && m.userId === me && m.role === "leader");
  const leading = comps.filter((c) => leaderOf(c.id));
  const comp = (id: string) => comps.find((c) => c.id === id);

  // ---- events (respecting the competition filter) ----
  const events = useMemo(() => {
    const out: Ev[] = [];
    for (const c of comps) {
      if (filter !== "all" && filter !== c.id) continue;
      const stages = data.stages.filter((s) => s.competitionId === c.id).sort((a, b) => a.orderIndex - b.orderIndex);
      for (const m of data.milestones.filter((x) => x.competitionId === c.id)) {
        out.push({ id: `m-${m.id}`, kind: "milestone", competitionId: c.id, at: m.targetDate, day: dayKey(m.targetDate), title: m.title, emoji: "🏁", tone: "blue", done: false });
      }
      stages.forEach((s, i) => {
        const last = i === stages.length - 1;
        out.push({ id: `s-${s.id}`, kind: "stage", competitionId: c.id, at: s.deadline, day: dayKey(s.deadline), title: last && stages.length > 1 ? `${s.name} (final)` : `Tenggat ${s.name}`, emoji: last ? "🏆" : "🎯", tone: last ? "gold" : "indigo", done: false });
      });
      for (const t of data.tasks.filter((x) => x.competitionId === c.id)) {
        const hot = !t.isCompleted && new Date(t.dueDate).getTime() - now < 2 * DAY;
        out.push({ id: `t-${t.id}`, kind: "task", competitionId: c.id, at: t.dueDate, day: dayKey(t.dueDate), title: t.title, emoji: t.isCompleted ? "✅" : "📄", tone: t.isCompleted ? "green" : hot ? "red" : "amber", done: t.isCompleted, task: t });
      }
    }
    return out.sort((a, b) => +new Date(a.at) - +new Date(b.at));
  }, [comps, data.stages, data.milestones, data.tasks, filter, now]);

  const byDay = useMemo(() => {
    const map = new Map<string, Ev[]>();
    for (const e of events) map.set(e.day, [...(map.get(e.day) ?? []), e]);
    return map;
  }, [events]);

  // ---- crowded / colliding days, always computed over every running competition ----
  const flags = useMemo(() => {
    const map = new Map<string, string>();
    const ids = new Set(comps.map((c) => c.id));
    const open = data.tasks.filter((t) => ids.has(t.competitionId) && !t.isCompleted);
    for (const c of detectCollisions(comps, open, now)) for (const i of c.items) map.set(dayKey(i.at), "Bentrok: tenggat berat dari lomba berbeda berdekatan (jendela 48 jam)");
    const perDay = new Map<string, Task[]>();
    for (const t of open) perDay.set(dayKey(t.dueDate), [...(perDay.get(dayKey(t.dueDate)) ?? []), t]);
    for (const [day, ts] of perDay) {
      const heavy = ts.filter((t) => t.priority === "critical" || t.priority === "high").length;
      if (new Set(ts.map((t) => t.competitionId)).size >= 2) map.set(day, map.get(day) ?? "Padat: tugas dari 2 lomba atau lebih jatuh di hari yang sama");
      else if (heavy >= 3) map.set(day, map.get(day) ?? "Padat: 3 tenggat prioritas tinggi di hari yang sama");
    }
    return map;
  }, [comps, data.tasks, now]);

  // ---- grid geometry ----
  const monthCells = useMemo(() => {
    const first = new Date(new Date(anchor).getFullYear(), new Date(anchor).getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - lead + i));
  }, [anchor]);
  const weekDays = useMemo(() => {
    const s = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i));
  }, [anchor]);
  const anchorMonth = new Date(anchor).getMonth();

  function shift(delta: number) {
    const d = new Date(anchor);
    if (view === "month") d.setMonth(d.getMonth() + delta, 1);
    else d.setDate(d.getDate() + 7 * delta);
    setAnchor(d.getTime());
  }

  useEffect(() => {
    if (view === "week" && weekScroll.current) weekScroll.current.scrollTop = 7 * HOUR_H;
  }, [view]);

  const label =
    view === "month"
      ? monthFmt.format(new Date(anchor))
      : `${shortFmt.format(weekDays[0])} – ${shortFmt.format(weekDays[6])} ${weekDays[6].getFullYear()}`;

  // ---- adding / editing ----
  function openAdd(day: string, cid: string) {
    const stage = data.stages.find((s) => s.competitionId === cid && s.status === "active");
    if (!stage) return;
    const ms = data.milestones.filter((m) => m.stageId === stage.id).sort((a, b) => a.orderIndex - b.orderIndex);
    const target = ms.find((m) => dayKey(m.targetDate) >= day) ?? ms[ms.length - 1];
    setForm({ competitionId: cid, stageId: stage.id, milestoneId: target?.id ?? null, defaultDue: new Date(`${day}T23:59:00`).toISOString() });
  }
  const addTarget = addFor && leading.some((c) => c.id === addFor) ? addFor : (leading[0]?.id ?? "");

  function pickToday() {
    setSelected(today);
    if (!leading.length) return;
    openAdd(selected ?? today, addTarget);
  }

  const sel = selected ? (byDay.get(selected) ?? []) : [];
  const Pill = ({ e, compact }: { e: Ev; compact?: boolean }) => (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        setSelected(e.day);
      }}
      title={`${e.title} · ${comp(e.competitionId)?.title ?? ""} · ${fmtTime(e.at)}`}
      className={`block w-full truncate rounded-lg px-2 py-1 text-left text-[10px] font-semibold leading-tight ${TONE_CLS[e.tone]} ${e.done ? "line-through opacity-70" : ""}`}
    >
      {e.emoji} [{tagOf(comp(e.competitionId)?.title ?? "")}] {e.title}
      {!compact && e.kind === "task" && ` (${fmtTime(e.at)})`}
    </button>
  );

  return (
    <section className="card p-6 sm:p-7" aria-labelledby="cal-main-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cal-main-h" className="flex items-center gap-2.5 text-base font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#dff0ff] text-[#1e3a8a] dark:bg-[#172736] dark:text-[#93c5fd]">
            <CalendarDays size={16} />
          </span>
          Kalender Kompetisi &amp; Jadwal Tim
        </h2>
        <button className="btn-primary !px-3.5 !py-1.5 text-xs" onClick={pickToday} disabled={leading.length === 0} title={leading.length === 0 ? "Hanya Ketua yang dapat menambah pekerjaan" : undefined}>
          <Plus size={14} /> Tambah Agenda / Tugas
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1">
          <button className="rounded-full p-1.5 hover:bg-[#f4f3ee] dark:hover:bg-white/10" onClick={() => shift(-1)} aria-label={view === "month" ? "Bulan sebelumnya" : "Minggu sebelumnya"}>
            <ChevronLeft size={17} />
          </button>
          <span className="min-w-[10rem] text-center text-base font-bold capitalize">{label}</span>
          <button className="rounded-full p-1.5 hover:bg-[#f4f3ee] dark:hover:bg-white/10" onClick={() => shift(1)} aria-label={view === "month" ? "Bulan berikutnya" : "Minggu berikutnya"}>
            <ChevronRight size={17} />
          </button>
        </div>
        <button className="btn-ghost !px-3.5 !py-1.5 text-xs" onClick={() => setAnchor(now)}>
          Hari Ini
        </button>
        <div className="ml-auto flex rounded-full border border-[#e4e2dc] bg-[#efede7] p-1 dark:border-white/10 dark:bg-[#202024]" role="tablist" aria-label="Tampilan kalender">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                view === v
                  ? "bg-[#141416] text-[#ffffff] shadow-sm dark:bg-[#f4f4f6] dark:text-[#141416]"
                  : "text-[#52525b] hover:text-[#141416] dark:text-[#a1a1aa] dark:hover:text-[#f4f4f6]"
              }`}
            >
              {v === "month" ? "Bulanan" : "Mingguan"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2" role="group" aria-label="Filter lomba">
        <button
          onClick={() => setFilter("all")}
          aria-pressed={filter === "all"}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
            filter === "all"
              ? "border-[#141416] bg-[#141416] text-[#ffffff] dark:border-[#f4f4f6] dark:bg-[#f4f4f6] dark:text-[#141416]"
              : "border-[#e4e2dc] bg-[#faf9f6] text-white/65 hover:bg-[#f0efea] dark:border-white/10 dark:bg-[#202024]"
          }`}
        >
          Semua Lomba
        </button>
        {comps.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(filter === c.id ? "all" : c.id)}
            aria-pressed={filter === c.id}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              filter === c.id
                ? "border-[#141416] bg-[#141416] text-[#ffffff] dark:border-[#f4f4f6] dark:bg-[#f4f4f6] dark:text-[#141416]"
                : "border-[#e4e2dc] bg-[#faf9f6] text-white/65 hover:bg-[#f0efea] dark:border-white/10 dark:bg-[#202024]"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: c.accent }} />
            {c.title}
          </button>
        ))}
      </div>

      <div className={`mt-5 grid gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
        <div className="min-w-0 overflow-x-auto">
          {view === "month" ? (
            <div className="min-w-[680px]">
              <div className="grid grid-cols-7 gap-px text-center text-[11px] font-semibold text-white/45">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1.5">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[24px] border border-[#eae8e1] bg-[#eae8e1] dark:border-white/10 dark:bg-white/10" role="grid" aria-label={label}>
                {monthCells.map((d) => {
                  const key = dayKey(d.getTime());
                  const evs = byDay.get(key) ?? [];
                  const flag = flags.get(key);
                  const inMonth = d.getMonth() === anchorMonth;
                  return (
                    <div
                      key={key}
                      role="gridcell"
                      tabIndex={0}
                      aria-label={`${dayFmt.format(d)}, ${evs.length} agenda${flag ? ", padat atau bentrok" : ""}`}
                      aria-selected={selected === key}
                      onClick={() => setSelected(selected === key ? null : key)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(selected === key ? null : key))}
                      className={`min-h-[7rem] cursor-pointer bg-[#ffffff] p-1.5 transition hover:bg-[#faf9f6] dark:bg-[#18181b] dark:hover:bg-[#202024] ${
                        selected === key ? "ring-2 ring-inset ring-[#141416] dark:ring-[#f4f4f6]" : ""
                      } ${flag ? "border-t-2 border-t-[#f43f5e]" : ""} ${inMonth ? "" : "opacity-40"}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        {flag ? (
                          <span className="rounded-full bg-[#fce4ec] px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#881337] dark:bg-[#331924] dark:text-[#fda4af]" title={flag}>
                            ⚠️ Padat / Bentrok
                          </span>
                        ) : (
                          <span />
                        )}
                        <span
                          className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-bold ${
                            key === today ? "bg-[#141416] text-[#ffffff] dark:bg-[#f4f4f6] dark:text-[#141416]" : "text-white/70"
                          }`}
                        >
                          {d.getDate()}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {evs.slice(0, 3).map((e) => (
                          <Pill key={e.id} e={e} />
                        ))}
                        {evs.length > 3 && <div className="px-1 text-[10px] font-semibold text-white/45">+{evs.length - 3} lagi</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-px text-center">
                <div />
                {weekDays.map((d, i) => {
                  const key = dayKey(d.getTime());
                  return (
                    <button key={key} onClick={() => setSelected(selected === key ? null : key)} className={`rounded-xl py-1.5 transition hover:bg-[#f4f3ee] dark:hover:bg-white/[0.06] ${flags.get(key) ? "border-t-2 border-t-[#f43f5e]" : ""}`} title={flags.get(key)}>
                      <span className="block text-[11px] font-semibold text-white/45">{WEEKDAYS[i]}</span>
                      <span className={`mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${key === today ? "bg-[#141416] text-[#ffffff] dark:bg-[#f4f4f6] dark:text-[#141416]" : ""}`}>{d.getDate()}</span>
                      {flags.get(key) && <span className="block text-[9px] font-bold text-[#881337] dark:text-[#fda4af]">⚠️ Padat / Bentrok</span>}
                    </button>
                  );
                })}
              </div>
              <div ref={weekScroll} className="mt-1.5 max-h-[540px] overflow-y-auto rounded-[24px] border border-[#eae8e1] bg-[#ffffff] dark:border-white/10 dark:bg-[#18181b]" role="grid" aria-label={label}>
                <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR_H }}>
                  <div className="relative">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-white/40" style={{ top: h * HOUR_H }}>
                        {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                      </div>
                    ))}
                  </div>
                  {weekDays.map((d) => {
                    const key = dayKey(d.getTime());
                    const evs = byDay.get(key) ?? [];
                    const laneEnd: number[] = [];
                    const placed = evs.map((e) => {
                      const dt = new Date(e.at);
                      const start = dt.getHours() * 60 + dt.getMinutes();
                      let lane = laneEnd.findIndex((end) => end <= start);
                      if (lane < 0) lane = laneEnd.length;
                      laneEnd[lane] = start + 55;
                      return { e, start, lane };
                    });
                    const lanes = Math.max(1, laneEnd.length);
                    return (
                      <div
                        key={key}
                        className={`relative border-l border-[#eae8e1] dark:border-white/10 ${key === today ? "bg-[#faf9f6] dark:bg-white/[0.02]" : ""}`}
                        style={{ backgroundImage: "linear-gradient(to bottom, rgb(var(--fg) / 0.06) 1px, transparent 1px)", backgroundSize: `100% ${HOUR_H}px` }}
                        role="gridcell"
                        aria-label={dayFmt.format(d)}
                      >
                        {placed.map(({ e, start, lane }) => (
                          <div key={e.id} className="absolute px-px" style={{ top: (start / 60) * HOUR_H, height: HOUR_H - 6, left: `${(lane * 100) / lanes}%`, width: `${100 / lanes}%` }}>
                            <button
                              type="button"
                              onClick={() => setSelected(e.day)}
                              title={`${e.title} · ${comp(e.competitionId)?.title ?? ""} · ${fmtTime(e.at)}`}
                              className={`h-full w-full overflow-hidden rounded-lg px-1.5 py-0.5 text-left text-[10px] font-semibold leading-tight ${TONE_CLS[e.tone]} ${e.done ? "line-through opacity-70" : ""}`}
                            >
                              <span className="block tabular-nums opacity-80">{fmtTime(e.at)}</span>
                              {e.emoji} [{tagOf(comp(e.competitionId)?.title ?? "")}] {e.title}
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-white/60" aria-label="Legenda">
            <li>🏁 Target milestone</li>
            <li>🎯 Tenggat babak</li>
            <li>🏆 Final</li>
            <li>📄 Tugas tim</li>
            <li className="text-[#881337] dark:text-[#fda4af]">📄 Kurang dari 48 jam / terlambat</li>
            <li>✅ Selesai</li>
            <li className="font-semibold text-[#881337] dark:text-[#fda4af]">⚠️ Padat / Bentrok</li>
          </ul>
        </div>

        {selected && (
          <aside className="rounded-[24px] border border-[#eae8e1] bg-[#faf9f6] p-5 xl:sticky xl:top-5 xl:self-start dark:border-white/10 dark:bg-[#202024]" aria-label="Agenda tanggal terpilih">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold capitalize">{dayFmt.format(new Date(`${selected}T12:00:00`))}</div>
                <div className="text-xs text-white/50">{sel.length} agenda</div>
              </div>
              <button className="rounded-full p-1.5 hover:bg-[#e4e2dc] dark:hover:bg-white/10" onClick={() => setSelected(null)} aria-label="Tutup agenda">
                <X size={16} />
              </button>
            </div>
            {flags.get(selected) && (
              <p className="mt-3 rounded-2xl bg-[#fce4ec] px-3.5 py-2.5 text-xs text-[#881337] dark:bg-[#331924] dark:text-[#fda4af]">
                ⚠️ {flags.get(selected)}
              </p>
            )}

            <ul className="mt-3.5 space-y-2.5">
              {sel.length === 0 && <li className="text-xs text-white/45">Belum ada agenda di tanggal ini.</li>}
              {sel.map((e) => {
                const c = comp(e.competitionId);
                const t = e.task;
                const mine = t?.assignedTo === me;
                const lead = leaderOf(e.competitionId);
                return (
                  <li key={e.id} className="rounded-2xl border border-[#eae8e1] bg-[#ffffff] p-3.5 dark:border-white/10 dark:bg-[#18181b]">
                    <div className="flex items-start gap-2.5">
                      <span className="text-base leading-none">{e.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-semibold ${e.done ? "text-white/45 line-through" : ""}`}>{e.title}</div>
                        <div className="mt-0.5 text-xs text-white/50">
                          [{tagOf(c?.title ?? "")}] {c?.title} · {fmtTime(e.at)}
                          {t && ` · ${data.users.find((u) => u.id === t.assignedTo)?.fullName.split(" ")[0] ?? "belum ditugaskan"}`}
                        </div>
                      </div>
                    </div>
                    {t && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {!t.isCompleted && (mine || lead) && (
                          <button className="btn-safe !px-3 !py-1 text-xs" onClick={() => onComplete(t.id)}>
                            <Check size={12} /> Selesai
                          </button>
                        )}
                        {(mine || lead) && (
                          <button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => setForm({ competitionId: t.competitionId, stageId: t.stageId ?? "", milestoneId: t.milestoneId, taskId: t.id })}>
                            <Pencil size={12} /> Edit
                          </button>
                        )}
                        {lead && (
                          <button
                            className="btn-danger !px-3 !py-1 text-xs"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Hapus tugas ini?",
                                item: t.title,
                                message: "Penanda kalender ikut dihapus dan skor kesiapan dihitung ulang.",
                                confirmLabel: "Hapus Tugas",
                                tone: "danger",
                                icon: "trash",
                              });
                              if (ok) dispatch({ type: "deleteTask", id: t.id });
                            }}
                          >
                            <Trash2 size={12} /> Hapus
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t border-[#eae8e1] pt-3.5 dark:border-white/10">
              {leading.length === 0 ? (
                <p className="text-xs text-white/45">Hanya Ketua yang dapat menambah pekerjaan.</p>
              ) : (
                <>
                  {leading.length > 1 && (
                    <select className="field mb-2.5 !py-1.5 text-xs" value={addTarget} onChange={(e) => setAddFor(e.target.value)} aria-label="Lomba tujuan pekerjaan baru">
                      {leading.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <button className="btn-primary w-full !py-2 text-xs" onClick={() => openAdd(selected, addTarget)}>
                    <Plus size={14} /> Tambah Pekerjaan di Tanggal Ini
                  </button>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      <TaskFormModal ctx={form} onClose={() => setForm(null)} />
    </section>
  );
}
