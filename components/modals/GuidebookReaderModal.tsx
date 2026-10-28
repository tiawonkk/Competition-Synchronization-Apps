"use client";

import { FileUp, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { analyzeGuidebook, type Progress } from "@/lib/guidebook-client";
import { DAY, fmtDate, uid } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { GuidebookDraft, Task } from "@/lib/types";
import { Modal } from "../ui";

/** Reads a guidebook for an existing competition: rubric, file formats, rules and extra tasks for the running round. */
export default function GuidebookReaderModal({ open, competitionId, onClose }: { open: boolean; competitionId: string; onClose: () => void }) {
  const { data, now, me, dispatch } = useStore();
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GuidebookDraft | null>(null);
  const [addTasks, setAddTasks] = useState(true);

  useEffect(() => {
    if (open) {
      setFileName("");
      setText("");
      setError(null);
      setDraft(null);
      setProgress(null);
    }
  }, [open]);

  const stage = data.stages.find((s) => s.competitionId === competitionId && s.status === "active");
  const busy = progress !== null;

  async function read(file?: File) {
    setError(null);
    setDraft(null);
    setProgress({ label: "Menyiapkan…", pct: 0 });
    const res = await analyzeGuidebook({ file, text, onProgress: setProgress });
    setProgress(null);
    if (!res.draft) return setError(res.error ?? "Gagal membaca guidebook.");
    setDraft(res.draft);
    if (res.note) setError(res.note);
  }

  function apply() {
    if (!draft) return;
    dispatch({ type: "updateCompetition", id: competitionId, patch: { guide: { rubric: draft.rubric ?? [], deliverables: draft.deliverables ?? [], rules: draft.rules ?? [] } } });
    if (addTasks && stage && draft.tasks.length > 0) {
      const end = new Date(stage.deadline).getTime();
      const milestone = data.milestones.filter((m) => m.stageId === stage.id).sort((a, b) => a.orderIndex - b.orderIndex)[0];
      const existing = new Set(data.tasks.filter((t) => t.stageId === stage.id).map((t) => t.title.toLowerCase()));
      const tasks: Task[] = draft.tasks
        .filter((t) => !existing.has(t.title.toLowerCase()))
        .map((t) => {
          const dated = t.dueDate ? new Date(`${t.dueDate}T23:59:00`).getTime() : NaN;
          const due = Math.min(end, Math.max(now + DAY, Number.isFinite(dated) ? dated : end - 2 * DAY));
          return { id: uid("t"), competitionId, stageId: stage.id, milestoneId: milestone?.id ?? null, assignedTo: me, title: t.title, description: t.description || "Dari guidebook.", dueDate: new Date(due).toISOString(), priority: t.priority, isCompleted: false, alarmActive: true };
        });
      if (tasks.length) dispatch({ type: "addTasks", tasks });
    }
    onClose();
  }

  const rounds = draft?.stages.filter((s) => s.isRound) ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Baca Guidebook dengan AI" wide>
      <div className="space-y-4 p-5">
        <p className="text-sm text-white/60">
          Unggah PDF guidebook penuh, atau tempel teks aturan. Sistem membaca halaman demi halaman lalu mengambil babak, rubrik penilaian, format berkas, dan aturan. Teks dikirim ke Google Gemini, jadi jangan unggah dokumen rahasia.
        </p>

        <label className={`btn-ghost w-full cursor-pointer !justify-start ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
          <span className="min-w-0 truncate">{fileName || "Unggah PDF guidebook (ukuran berapa pun)"}</span>
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setFileName(f.name);
              read(f);
            }}
          />
        </label>

        {progress && (
          <div role="status" aria-live="polite">
            <div className="mb-1 flex justify-between text-xs text-white/60">
              <span>{progress.label}</span>
              {progress.pct !== null && <span className="tabular-nums">{progress.pct}%</span>}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full bg-active transition-all ${progress.pct === null ? "w-1/3 animate-pulse" : ""}`} style={progress.pct === null ? undefined : { width: `${progress.pct}%` }} />
            </div>
          </div>
        )}

        <textarea className="field resize-y" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Atau tempel teks buku panduan di sini…" aria-label="Teks guidebook" />
        <button className="btn-ghost !py-1.5 text-xs" onClick={() => read()} disabled={busy || text.trim().length < 40}>
          <Sparkles size={14} className="text-active" /> Baca teks dengan AI
        </button>

        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

        {draft && (
          <div className="space-y-3 rounded-2xl bg-white/[0.04] p-4 text-sm">
            <Section title={`Babak dan tahapan (${draft.stages.length})`}>
              {draft.stages.length === 0 ? <Empty /> : (
                <ul className="space-y-0.5">
                  {draft.stages.map((s) => (
                    <li key={s.name + s.date}>
                      {s.isRound ? "🏁 " : "• "}
                      {s.name} {s.date && <span className="text-white/50">({fmtDate(`${s.date}T12:00:00`)})</span>}
                    </li>
                  ))}
                </ul>
              )}
              {rounds.length > 0 && <p className="mt-1 text-[11px] text-white/45">Babak untuk lomba yang sudah berjalan diatur lewat tombol Tambah Babak.</p>}
            </Section>
            <Section title={`Rubrik penilaian (${draft.rubric?.length ?? 0})`}>
              {draft.rubric?.length ? <ul>{draft.rubric.map((r) => <li key={r.criterion}>{r.criterion} {r.weight && <strong>{r.weight}</strong>}</li>)}</ul> : <Empty />}
            </Section>
            <Section title={`Format berkas (${draft.deliverables?.length ?? 0})`}>
              {draft.deliverables?.length ? <ul className="list-disc pl-5">{draft.deliverables.map((d) => <li key={d}>{d}</li>)}</ul> : <Empty />}
            </Section>
            <Section title={`Aturan (${draft.rules?.length ?? 0})`}>
              {draft.rules?.length ? <ul className="list-disc pl-5">{draft.rules.map((r) => <li key={r}>{r}</li>)}</ul> : <Empty />}
            </Section>
            {draft.tasks.length > 0 && (
              <label className={`flex items-start gap-2 text-sm ${stage ? "cursor-pointer" : "opacity-60"}`}>
                <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-500" checked={addTasks && !!stage} disabled={!stage} onChange={(e) => setAddTasks(e.target.checked)} />
                <span>
                  Tambahkan {draft.tasks.length} tugas dari guidebook ke {stage ? stage.name : "babak aktif"} (tugas dengan judul yang sama dilewati).
                </span>
              </label>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Tutup</button>
          <button className="btn-primary" onClick={apply} disabled={!draft}>Terapkan ke Lomba</button>
        </div>
      </div>
    </Modal>
  );
}

const Empty = () => <p className="text-xs text-white/40">Tidak ditemukan di dokumen.</p>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-white/60">{title}</div>
      {children}
    </div>
  );
}
