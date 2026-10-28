"use client";

import { CheckCircle2, Link2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { alarm } from "@/lib/alarm";
import { computeReadiness, isValidProofUrl, scoreTone } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Badge, Gauge, Modal, TONE } from "../ui";

export default function CompleteModal({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { data, dispatch, readiness } = useStore();
  const task = data.tasks.find((t) => t.id === taskId);
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ before: number; after: number } | null>(null);

  useEffect(() => {
    setUrl("");
    setTouched(false);
    setBusy(false);
    setResult(null);
  }, [taskId]);

  const valid = isValidProofUrl(url);
  const comp = data.competitions.find((c) => c.id === task?.competitionId);

  function submit() {
    if (!task || !valid) {
      setTouched(true);
      return;
    }
    setBusy(true);
    const before = readiness(task.competitionId);
    // Stop-on-Confirm: silence the alarm immediately, then persist completion.
    alarm.stop();
    setTimeout(() => {
      dispatch({ type: "complete", taskId: task.id, proofUrl: url.trim(), at: new Date().toISOString() });
      // readiness after = recomputed from current tasks with this one flipped
      const tasks = data.tasks
        .filter((t) => t.competitionId === task.competitionId)
        .map((t) => (t.id === task.id ? { ...t, isCompleted: true, proofUrl: url.trim() } : t));
      setResult({ before, after: computeReadiness(tasks) });
      setBusy(false);
    }, 450);
  }

  return (
    <Modal open={!!task} onClose={onClose} title="Konfirmasi Selesai">
      {task && !result && (
        <div className="space-y-4 p-5">
          <div>
            <div className="text-xs text-white/50">{comp?.title}</div>
            <div className="text-base font-semibold">{task.title}</div>
          </div>
          <div>
            <label className="label" htmlFor="proof">
              Tautan bukti pekerjaan (OneDrive / Google Drive — PDF atau ZIP)
            </label>
            <div className="relative">
              <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                id="proof"
                className="field !pl-9"
                placeholder="https://drive.google.com/file/d/… atau https://1drv.ms/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => setTouched(true)}
                autoFocus
              />
            </div>
            {touched && !valid && (
              <p className="mt-1 text-xs text-danger">Gunakan tautan https dari drive.google.com, docs.google.com, 1drv.ms, atau SharePoint Binus.</p>
            )}
            <button type="button" className="mt-2 text-xs text-active hover:underline" onClick={() => setUrl("https://drive.google.com/file/d/bukti-pekerjaan-demo/view")}>
              Isi tautan contoh
            </button>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
            Setelah dikonfirmasi: alarm berdering dihentikan, pengingat Google Calendar &amp; Outlook untuk tugas ini dinonaktifkan, dan skor kesiapan dihitung ulang.
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>
              Batal
            </button>
            <button className="btn-safe" onClick={submit} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Tandai Selesai
            </button>
          </div>
        </div>
      )}
      {task && result && (
        <div className="p-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-safe/15 text-safe">
            <CheckCircle2 size={34} />
          </div>
          <h3 className="mt-3 text-lg font-bold">Tugas selesai — alarm dihentikan</h3>
          <p className="mt-1 text-sm text-white/60">{task.title}</p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <Gauge value={result.before} size={80} color={TONE.neutral.hex} label="sebelum" />
            <span className="text-2xl text-white/30">→</span>
            <Gauge value={result.after} size={96} color={TONE[scoreTone(result.after)].hex} label="sekarang" />
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <Badge tone="safe">Skor kesiapan +{result.after - result.before}%</Badge>
            <Badge tone="neutral">Pengingat kalender nonaktif</Badge>
          </div>
          <button className="btn-primary mt-5" onClick={onClose}>
            Tutup
          </button>
        </div>
      )}
    </Modal>
  );
}
