"use client";

import { ArrowRight, Check, Eraser, Hand, Lightbulb, Minus, Pencil, Plus, StickyNote, ThumbsUp, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRIORITY_LABEL, uid } from "@/lib/logic";
import { NOTE_COLORS } from "@/lib/seed";
import { useStore } from "@/lib/store";
import type { NoteKind, Priority, Task, WhiteboardElement } from "@/lib/types";
import { Avatar, Badge } from "./ui";

type Tool = "select" | "pen" | "eraser";
interface View {
  x: number;
  y: number;
  z: number;
}

const KIND_LABEL: Record<NoteKind, string> = { ide: "Ide Utama", fitur: "Fitur", riset: "Riset", kendala: "Kendala" };
const INK = "ink"; // theme-aware default pen color
const PEN_COLORS = [INK, "#2563EB", "#E11D48", "#059669", "#D97706"];
const NOTE_W = 208;

const strokeColor = (c: string) => (c === INK ? "rgb(var(--fg) / 0.85)" : c);
const pathOf = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Whiteboard({ competitionId, onGoTasks }: { competitionId: string; onGoTasks: () => void }) {
  const { data, now, me, dispatch } = useStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [penColor, setPenColor] = useState(INK);
  const [view, setView] = useState<View>({ x: 20, y: 20, z: 1 });
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [stroke, setStroke] = useState<[number, number][] | null>(null);
  const [convertFor, setConvertFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const dragStart = useRef<{ px: number; py: number; nx: number; ny: number } | null>(null);

  const elements = data.whiteboard.filter((e) => e.competitionId === competitionId);
  const notes = elements.filter((e) => e.type === "sticky");
  const drawings = elements.filter((e) => e.type === "drawing" && e.points);
  const team = data.members.filter((m) => m.competitionId === competitionId);
  const userOf = (id: string) => data.users.find((u) => u.id === id);

  const ranked = useMemo(() => [...notes].sort((a, b) => b.votes.length - a.votes.length).filter((n) => n.votes.length > 0).slice(0, 3), [notes]);

  // Wheel = zoom around the cursor (needs a non-passive listener to stop page scroll).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setView((v) => {
        const z = Math.min(1.8, Math.max(0.4, v.z * (e.deltaY < 0 ? 1.1 : 0.9)));
        return { z, x: cx - ((cx - v.x) * z) / v.z, y: cy - ((cy - v.y) * z) / v.z };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const toWorld = (e: React.PointerEvent): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [(e.clientX - rect.left - view.x) / view.z, (e.clientY - rect.top - view.y) / view.z];
  };

  // ---------- Canvas: pan / draw ----------
  function onCanvasDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    if ((e.target as HTMLElement).closest("[data-note]") && tool !== "pen") return;
    canvasRef.current!.setPointerCapture(e.pointerId);
    if (tool === "pen") setStroke([toWorld(e)]);
    else if (tool === "select") pan.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
  }
  function onCanvasMove(e: React.PointerEvent) {
    if (stroke) setStroke((s) => (s ? [...s, toWorld(e)] : s));
    else if (pan.current) {
      const p = pan.current;
      setView((v) => ({ ...v, x: p.ox + e.clientX - p.sx, y: p.oy + e.clientY - p.sy }));
    }
  }
  function onCanvasUp() {
    if (stroke && stroke.length > 1) {
      dispatch({
        type: "wbAdd",
        element: { id: uid("w"), competitionId, type: "drawing", content: "", color: penColor, x: 0, y: 0, points: stroke, votes: [], createdBy: me, updatedAt: new Date().toISOString() },
      });
    }
    setStroke(null);
    pan.current = null;
  }

  // ---------- Sticky notes ----------
  function addNote(kind: NoteKind) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const jitter = () => (Math.random() - 0.5) * 80;
    const el: WhiteboardElement = {
      id: uid("w"),
      competitionId,
      type: "sticky",
      kind,
      content: "",
      color: NOTE_COLORS[kind],
      x: (rect.width / 2 - view.x) / view.z - NOTE_W / 2 + jitter(),
      y: (rect.height / 2 - view.y) / view.z - 70 + jitter(),
      votes: [],
      createdBy: me,
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: "wbAdd", element: el });
    setTool("select");
  }
  function onNoteDown(e: React.PointerEvent, n: WhiteboardElement) {
    if (tool !== "select") return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { px: e.clientX, py: e.clientY, nx: n.x, ny: n.y };
    setDrag({ id: n.id, x: n.x, y: n.y });
  }
  function onNoteMove(e: React.PointerEvent) {
    const s = dragStart.current;
    if (!s || !drag) return;
    setDrag({ id: drag.id, x: s.nx + (e.clientX - s.px) / view.z, y: s.ny + (e.clientY - s.py) / view.z });
  }
  function onNoteUp() {
    if (drag) dispatch({ type: "wbPatch", id: drag.id, patch: { x: drag.x, y: drag.y } });
    dragStart.current = null;
    setDrag(null);
  }

  const zoomBy = (f: number) => setView((v) => ({ ...v, z: Math.min(1.8, Math.max(0.4, v.z * f)) }));
  const converting = notes.find((n) => n.id === convertFor);

  return (
    <div className="space-y-4">
      <div className="glass relative overflow-hidden">
        <div
          ref={canvasRef}
          className={`dot-grid relative h-[68vh] min-h-[460px] select-none overflow-hidden ${
            tool === "pen" ? "cursor-crosshair" : tool === "eraser" ? "cursor-cell" : "cursor-grab active:cursor-grabbing"
          }`}
          style={{ touchAction: "none", backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${22 * view.z}px ${22 * view.z}px` }}
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={onCanvasUp}
          onPointerCancel={onCanvasUp}
          aria-label="Kanvas whiteboard"
        >
          <div className="absolute left-0 top-0" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, transformOrigin: "0 0" }}>
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
              {drawings.map((d) => (
                <g key={d.id}>
                  <path d={pathOf(d.points!)} fill="none" stroke={strokeColor(d.color)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  {tool === "eraser" && (
                    <path
                      d={pathOf(d.points!)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={22}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      data-ui
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "wbRemove", id: d.id });
                      }}
                    />
                  )}
                </g>
              ))}
              {stroke && <path d={pathOf(stroke)} fill="none" stroke={strokeColor(penColor)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
            </svg>

            {notes.map((n) => {
              const pos = drag?.id === n.id ? drag : n;
              const voted = n.votes.includes(me);
              const author = userOf(n.createdBy);
              return (
                <div
                  key={n.id}
                  data-note
                  className={`absolute rounded-xl text-slate-900 shadow-[0_6px_18px_rgb(0,0,0,0.14)] ring-1 ring-black/5 ${tool === "pen" ? "pointer-events-none" : ""} ${
                    drag?.id === n.id ? "z-10 scale-[1.02] shadow-[0_12px_28px_rgb(0,0,0,0.22)]" : ""
                  }`}
                  style={{ left: pos.x, top: pos.y, width: NOTE_W, background: n.color }}
                >
                  <div
                    className={`flex items-center justify-between rounded-t-xl bg-black/[0.06] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 ${tool === "select" ? "cursor-grab active:cursor-grabbing" : ""}`}
                    onPointerDown={(e) => onNoteDown(e, n)}
                    onPointerMove={onNoteMove}
                    onPointerUp={onNoteUp}
                  >
                    <span>{n.kind ? KIND_LABEL[n.kind] : "Catatan"}</span>
                    <span className="flex items-center gap-1.5 normal-case tracking-normal">
                      {author && <span className="font-medium text-slate-600">{author.fullName.split(" ")[0]}</span>}
                      <button
                        className="rounded p-0.5 text-slate-500 hover:bg-black/10 hover:text-slate-900"
                        aria-label="Hapus catatan"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => dispatch({ type: "wbRemove", id: n.id })}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  </div>
                  <textarea
                    value={n.content}
                    placeholder="Tulis ide Anda…"
                    rows={Math.max(3, Math.ceil(n.content.length / 27))}
                    onChange={(e) => dispatch({ type: "wbPatch", id: n.id, patch: { content: e.target.value } })}
                    className="block w-full resize-none bg-transparent px-2.5 py-2 text-[13px] leading-snug text-slate-900 outline-none placeholder:text-slate-500/70"
                  />
                  <div className="flex items-center gap-1.5 px-2 pb-2">
                    <button
                      onClick={() => dispatch({ type: "wbVote", id: n.id, userId: me })}
                      aria-pressed={voted}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${voted ? "bg-slate-900 text-[#fff]" : "bg-black/[0.07] text-slate-700 hover:bg-black/[0.12]"}`}
                    >
                      <ThumbsUp size={12} /> +{n.votes.length}
                    </button>
                    {n.taskId ? (
                      <button onClick={onGoTasks} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-[#fff]">
                        <Check size={12} /> Jadi tugas <ArrowRight size={11} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setConvertFor(n.id)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-[#fff] transition hover:bg-blue-600"
                      >
                        <Zap size={12} /> Jadikan Tugas
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Toolbar */}
          <div data-ui className="glass absolute left-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 p-1.5">
            <ToolBtn active={tool === "select"} onClick={() => setTool("select")} label="Geser & pilih" icon={<Hand size={16} />} />
            <ToolBtn active={tool === "pen"} onClick={() => setTool("pen")} label="Pena" icon={<Pencil size={16} />} />
            <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} label="Hapus coretan" icon={<Eraser size={16} />} />
            <span className="mx-1 h-5 w-px bg-white/10" />
            {tool === "pen" &&
              PEN_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Warna pena ${c}`}
                  onClick={() => setPenColor(c)}
                  className={`h-5 w-5 rounded-full ring-offset-1 ring-offset-transparent transition ${penColor === c ? "ring-2 ring-active" : ""}`}
                  style={{ background: strokeColor(c) }}
                />
              ))}
            {tool !== "pen" &&
              (Object.keys(KIND_LABEL) as NoteKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => addNote(k)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-900 transition hover:brightness-95"
                  style={{ background: NOTE_COLORS[k] }}
                  title={`Tambah catatan: ${KIND_LABEL[k]}`}
                >
                  <Plus size={12} /> {KIND_LABEL[k]}
                </button>
              ))}
          </div>

          {/* Zoom + presence */}
          <div data-ui className="glass absolute bottom-3 left-3 z-20 flex items-center gap-1 p-1">
            <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => zoomBy(0.85)} aria-label="Perkecil">
              <Minus size={15} />
            </button>
            <button className="w-12 text-xs tabular-nums text-white/70" onClick={() => setView({ x: 20, y: 20, z: 1 })} title="Reset tampilan">
              {Math.round(view.z * 100)}%
            </button>
            <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => zoomBy(1.15)} aria-label="Perbesar">
              <Plus size={15} />
            </button>
          </div>
          <div data-ui className="glass absolute bottom-3 right-3 z-20 flex items-center gap-2 px-2.5 py-1.5">
            <div className="flex -space-x-2">
              {team.map((m) => (
                <span key={m.userId} className="relative">
                  <Avatar user={userOf(m.userId)!} size={22} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-safe ring-2 ring-[rgb(var(--surface))]" />
                </span>
              ))}
            </div>
            <span className="hidden text-[10px] text-white/50 sm:inline">Realtime (simulasi)</span>
          </div>

          {notes.length === 0 && drawings.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-sm text-white/40">
              <div>
                <StickyNote className="mx-auto mb-2" />
                Kanvas kosong — tambahkan catatan dari toolbar atau gambar dengan pena.
              </div>
            </div>
          )}

          {/* Convert popover */}
          {converting && (
            <ConvertPanel
              key={converting.id}
              note={converting}
              onClose={() => setConvertFor(null)}
              onDone={(msg) => {
                setConvertFor(null);
                setToast(msg);
              }}
            />
          )}

          {toast && (
            <div data-ui className="glass absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-3 border-safe/40 px-4 py-2.5 text-xs shadow-lg">
              <Check size={15} className="text-safe" /> {toast}
              <button className="font-semibold text-active hover:underline" onClick={onGoTasks}>
                Lihat daftar tugas
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="glass p-4 sm:p-5" aria-labelledby="top-ideas">
        <h2 id="top-ideas" className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Lightbulb size={16} className="text-warn" /> Ide Terpopuler
          <span className="text-xs font-normal text-white/40">masuk otomatis ke Laporan Pembina</span>
        </h2>
        {ranked.length === 0 ? (
          <p className="text-xs text-white/40">Belum ada suara. Tekan +1 pada catatan untuk memilih ide terbaik.</p>
        ) : (
          <ol className="grid gap-2 md:grid-cols-3">
            {ranked.map((n, i) => (
              <li key={n.id} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-warn/15 text-xs font-bold text-warn">{i + 1}</span>
                <div className="min-w-0">
                  <p className="line-clamp-3 text-xs text-white/80">{n.content || "(kosong)"}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Badge tone="active">+{n.votes.length} suara</Badge>
                    {n.taskId && <Badge tone="safe">Sudah jadi tugas</Badge>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ToolBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`rounded-lg p-2 transition ${active ? "bg-active text-[#fff]" : "text-white/70 hover:bg-white/10"}`}
    >
      {icon}
    </button>
  );
}

/** One-click "Convert note to task": assignee + deadline, then pushes the task into the to-do list and calendar sync. */
function ConvertPanel({ note, onClose, onDone }: { note: WhiteboardElement; onClose: () => void; onDone: (msg: string) => void }) {
  const { data, now, me, dispatch } = useStore();
  const team = data.members.filter((m) => m.competitionId === note.competitionId);
  const [title, setTitle] = useState(note.content.slice(0, 90) || "Tugas dari whiteboard");
  const [assignee, setAssignee] = useState(me);
  const [due, setDue] = useState(() => {
    const d = new Date(now + 3 * 86400_000);
    d.setHours(17, 0, 0, 0);
    return toLocalInput(d);
  });
  const [priority, setPriority] = useState<Priority>("medium");

  function submit() {
    const dueDate = new Date(due);
    if (!title.trim() || Number.isNaN(+dueDate)) return;
    const milestones = data.milestones.filter((m) => m.competitionId === note.competitionId).sort((a, b) => a.orderIndex - b.orderIndex);
    const milestone = milestones.find((m) => new Date(m.targetDate) >= dueDate) ?? milestones[milestones.length - 1];
    const user = data.users.find((u) => u.id === assignee);
    const id = uid("t");
    const task: Task = {
      id,
      competitionId: note.competitionId,
      milestoneId: milestone?.id ?? null,
      assignedTo: assignee,
      title: title.trim(),
      description: `Dari Whiteboard & Ideasi${note.kind ? ` (${KIND_LABEL[note.kind]})` : ""}: ${note.content}`.slice(0, 240),
      dueDate: dueDate.toISOString(),
      priority,
      isCompleted: false,
      alarmActive: true,
      sourceNoteId: note.id,
      // In production /api/sync-task returns the real event ids; the prototype stamps placeholders.
      gcalEventId: user?.emailGoogle ? `gcal_${id}` : undefined,
      outlookEventId: user?.emailMicrosoft ? `outlook_${id}` : undefined,
    };
    dispatch({ type: "noteToTask", noteId: note.id, task });
    const targets = [user?.emailGoogle && "Google Calendar", user?.emailMicrosoft && "Outlook"].filter(Boolean).join(" & ");
    onDone(`Tugas dibuat untuk ${user?.fullName.split(" ")[0]} dan disinkronkan ke ${targets || "kalender"}.`);
  }

  return (
    <div data-ui className="glass absolute right-3 top-3 z-30 w-[min(20rem,calc(100%-1.5rem))] bg-[var(--modal-bg)] p-4 shadow-xl" role="dialog" aria-label="Jadikan tugas">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Zap size={15} className="text-active" /> Jadikan Tugas
        </h3>
        <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 text-white/50 hover:bg-white/10">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2.5">
        <div>
          <label className="label" htmlFor="cv-title">Judul tugas</label>
          <input id="cv-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="cv-who">Penanggung jawab</label>
          <select id="cv-who" className="field" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {team.map((m) => (
              <option key={m.userId} value={m.userId}>
                {data.users.find((u) => u.id === m.userId)?.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="cv-due">Tenggat</label>
            <input id="cv-due" type="datetime-local" className="field !px-2" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="cv-pri">Prioritas</label>
            <select id="cv-pri" className="field" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn-primary w-full" onClick={submit}>
          <Zap size={15} /> Buat tugas &amp; sinkron kalender
        </button>
      </div>
    </div>
  );
}
