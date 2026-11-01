"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, FilterX, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { DAY, dayKey, detectCollisions, fmtTime } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Milestone, Stage, Task } from "@/lib/types";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const monthFmt = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
const longFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

interface DayInfo {
  milestones: Milestone[];
  stages: Stage[];
  open: Task[];
  done: Task[];
  hot: boolean; // an open task due within 48 hours (or overdue)
  collide: boolean; // another competition has a heavy deadline close by
}

const empty = (): DayInfo => ({ milestones: [], stages: [], open: [], done: [], hot: false, collide: false });

/** Month calendar for one competition: colour-coded markers, a day agenda with quick-add, and a legend. */
export default function CalendarPanel({
  competitionId,
  selected,
  onSelect,
  onAddTask,
  canEdit,
}: {
  competitionId: string;
  selected: string | null;
  onSelect: (day: string | null) => void;
  onAddTask: (day: string) => void;
  canEdit: boolean;
}) {
  const { data, now, dispatch, liveCompetitions } = useStore();
  const today = dayKey(now);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(now);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const days = useMemo(() => {
    const map = new Map<string, DayInfo>();
    const at = (k: string) => map.get(k) ?? map.set(k, empty()).get(k)!;
    for (const m of data.milestones.filter((x) => x.competitionId === competitionId)) at(dayKey(m.targetDate)).milestones.push(m);
    for (const s of data.stages.filter((x) => x.competitionId === competitionId)) at(dayKey(s.deadline)).stages.push(s);
    for (const t of data.tasks.filter((x) => x.competitionId === competitionId)) {
      const d = at(dayKey(t.dueDate));
      if (t.isCompleted) d.done.push(t);
      else {
        d.open.push(t);
        if (new Date(t.dueDate).getTime() - now < 2 * DAY) d.hot = true;
      }
    }
    // Collisions come from the same radar as the dashboard, so both always agree.
    const ids = new Set(liveCompetitions.map((c) => c.id));
    const radar = detectCollisions(
      liveCompetitions,
      data.tasks.filter((t) => ids.has(t.competitionId)),
      now,
    );
    for (const c of radar) for (const i of c.items) if (i.competitionId === competitionId) at(dayKey(i.at)).collide = true;
    return map;
  }, [data.milestones, data.stages, data.tasks, liveCompetitions, competitionId, now]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first grid
    return Array.from({ length: 42 }, (_, i) => new Date(cursor.y, cursor.m, 1 - lead + i));
  }, [cursor]);

  const shift = (delta: number) => setCursor((c) => ({ y: c.y + Math.floor((c.m + delta) / 12), m: (c.m + delta + 12) % 12 }));

  const open = data.tasks.filter((t) => t.competitionId === competitionId && !t.isCompleted);
  const synced = open.filter((t) => t.gcalEventId || t.outlookEventId).length;
  // Only people signed up with a Gmail or Binus address have a calendar the markers can go to.
  const linkable = open.filter((t) => {
    const u = data.users.find((x) => x.id === t.assignedTo);
    return !!(u?.emailGoogle || u?.emailMicrosoft);
  }).length;
  const sel = selected ? (days.get(selected) ?? empty()) : null;

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="cal-h">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="cal-h" className="text-sm font-bold tracking-tight">Kalender &amp; Penanda</h2>
        <div className="flex items-center gap-1">
          <button className="rounded-full p-1.5 hover:bg-[#f4f3ee] dark:hover:bg-white/10" onClick={() => shift(-1)} aria-label="Bulan sebelumnya">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[8.5rem] text-center text-sm font-bold capitalize">{monthFmt.format(new Date(cursor.y, cursor.m, 1))}</span>
          <button className="rounded-full p-1.5 hover:bg-[#f4f3ee] dark:hover:bg-white/10" onClick={() => shift(1)} aria-label="Bulan berikutnya">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-white/45">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={monthFmt.format(new Date(cursor.y, cursor.m, 1))}>
        {cells.map((d) => {
          const key = dayKey(d.getTime());
          const info = days.get(key);
          const inMonth = d.getMonth() === cursor.m;
          const isSel = selected === key;
          const count = info ? info.open.length + info.done.length : 0;
          const blue = !!info && (info.milestones.length > 0 || info.stages.length > 0);
          const red = !!info && (info.hot || info.collide);
          const amber = !!info && info.open.some((t) => new Date(t.dueDate).getTime() - now >= 2 * DAY);
          const green = !!info && info.open.length === 0 && info.done.length > 0;
          const label = [
            longFmt.format(d),
            blue && "target milestone atau babak",
            count > 0 && `${count} tugas`,
            red && "kritis atau bentrok",
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={key}
              role="gridcell"
              aria-label={label}
              aria-pressed={isSel}
              onClick={() => onSelect(isSel ? null : key)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-xs transition ${
                isSel
                  ? "bg-[#141416] font-bold text-[#ffffff] dark:bg-[#f4f4f6] dark:text-[#141416]"
                  : key === today
                    ? "bg-[#ece6ff] font-bold text-[#3b1d8f] dark:bg-[#251f38] dark:text-[#c4b5fd]"
                    : "hover:bg-[#f4f3ee] dark:hover:bg-white/[0.07]"
              } ${inMonth ? "" : "opacity-35"}`}
            >
              <span>{d.getDate()}</span>
              <span className="mt-0.5 flex h-1.5 items-center gap-0.5" aria-hidden>
                {blue && <i className={`h-1.5 w-1.5 rounded-full border-[1.5px] ${isSel ? "border-[#ffffff] dark:border-[#141416]" : "border-[#7c3aed]"}`} />}
                {amber && <i className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />}
                {red && <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f43f5e]" />}
                {green && <i className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[11px] text-white/60" aria-label="Legenda penanda">
        <li className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full border-2 border-[#7c3aed]" /> Target milestone</li>
        <li className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Deadline tugas tim</li>
        <li className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f43f5e]" /> Kritis / bentrok</li>
        <li className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#22c55e]" /> Selesai</li>
      </ul>

      {selected && sel && (
        <div className="mt-4 rounded-2xl border border-[#eae8e1] bg-[#faf9f6] p-3.5 dark:border-white/10 dark:bg-[#202024]" role="region" aria-label="Agenda tanggal terpilih">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-bold capitalize">{longFmt.format(new Date(`${selected}T12:00:00`))}</div>
            <button className="flex shrink-0 items-center gap-1 text-[11px] font-semibold hover:underline" onClick={() => onSelect(null)}>
              <FilterX size={12} /> Semua Tanggal
            </button>
          </div>
          <ul className="mt-2.5 space-y-1.5 text-xs">
            {sel.stages.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <i className="h-2 w-2 shrink-0 rounded-full border-2 border-[#7c3aed]" /> Tenggat babak: {s.name}
              </li>
            ))}
            {sel.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <i className="h-2 w-2 shrink-0 rounded-full border-2 border-[#7c3aed]" /> Milestone: {m.title}
              </li>
            ))}
            {[...sel.open, ...sel.done]
              .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))
              .map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <i className={`h-2 w-2 shrink-0 rounded-full ${t.isCompleted ? "bg-[#22c55e]" : new Date(t.dueDate).getTime() - now < 2 * DAY ? "bg-[#f43f5e]" : "bg-[#f59e0b]"}`} />
                  <span className={`min-w-0 flex-1 truncate ${t.isCompleted ? "text-white/45 line-through" : ""}`}>{t.title}</span>
                  <span className="shrink-0 text-white/45">{fmtTime(t.dueDate)}</span>
                </li>
              ))}
            {sel.stages.length + sel.milestones.length + sel.open.length + sel.done.length === 0 && <li className="text-white/45">Belum ada jadwal di tanggal ini.</li>}
          </ul>
          {canEdit && (
            <button className="btn-primary mt-3.5 w-full !py-2 text-xs" onClick={() => onAddTask(selected)}>
              <CalendarPlus size={14} /> Tambah Pekerjaan di Tanggal Ini
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#eae8e1] bg-[#faf9f6] px-3.5 py-2.5 text-[11px] dark:border-white/10 dark:bg-[#202024]">
        <span className="text-white/60" title="Simulasi: belum memakai akun Google/Microsoft sungguhan">
          {open.length === 0
            ? "Tidak ada penanda terbuka."
            : linkable === 0
              ? "Belum ada penanggung jawab dengan akun Gmail atau Binus, jadi belum ada kalender tujuan."
              : `${synced} dari ${linkable} penanda tersinkron (simulasi)`}
        </span>
        <button className="flex items-center gap-1 font-bold hover:underline disabled:opacity-40" onClick={() => dispatch({ type: "syncCalendar", competitionId })} disabled={open.length === 0}>
          <RefreshCw size={12} /> Sinkronkan Semua Penanda ke Google Calendar &amp; Outlook
        </button>
      </div>
    </section>
  );
}
