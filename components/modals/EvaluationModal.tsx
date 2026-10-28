"use client";

import { Flag, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { analyzePostMortem, OUTCOMES, suggestOutcome } from "@/lib/evaluation";
import { isValidProofUrl, uid } from "@/lib/logic";
import { generateFinalReport } from "@/lib/report";
import { useStore } from "@/lib/store";
import type { OutcomeTier } from "@/lib/types";
import { Modal } from "../ui";

export interface EvalContext {
  competitionId: string;
  /** The round whose result triggered this dialog; its status is set when the evaluation is saved. */
  stageId?: string;
  stageResult?: "passed" | "eliminated";
}

/** "Selesaikan Lomba & Isi Evaluasi": records the outcome and the team retrospective, then archives the competition. */
export default function EvaluationModal({ ctx, onClose, onSaved }: { ctx: EvalContext | null; onClose: () => void; onSaved: (competitionId: string) => void }) {
  const { data, now, dispatch } = useStore();
  const comp = data.competitions.find((c) => c.id === ctx?.competitionId);
  const existing = data.evaluations.find((e) => e.competitionId === ctx?.competitionId);
  const stages = data.stages.filter((s) => s.competitionId === ctx?.competitionId);
  const finished = comp?.status === "archived";

  const [outcome, setOutcome] = useState<OutcomeTier>("finalis");
  const [rank, setRank] = useState("");
  const [score, setScore] = useState("");
  const [certificateUrl, setCertificateUrl] = useState("");
  const [archiveUrl, setArchiveUrl] = useState("");
  const [wentWell, setWentWell] = useState("");
  const [wentWrong, setWentWrong] = useState("");
  const [judgeFeedback, setJudgeFeedback] = useState("");
  const [insights, setInsights] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [sendFinal, setSendFinal] = useState(true);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!ctx) return;
    setOutcome(existing?.outcome ?? suggestOutcome(stages, ctx.stageId, ctx.stageResult));
    setRank(existing?.rank ?? "");
    setScore(existing?.score ?? "");
    setCertificateUrl(existing?.certificateUrl ?? "");
    setArchiveUrl(existing?.archiveUrl ?? "");
    setWentWell(existing?.wentWell ?? "");
    setWentWrong(existing?.wentWrong ?? "");
    setJudgeFeedback(existing?.judgeFeedback ?? "");
    setInsights(existing?.insights ?? []);
    setSendFinal(!existing);
    setTouched(false);
  }, [ctx?.competitionId, ctx?.stageId, ctx?.stageResult]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ctx || !comp) return <Modal open={false}>{null}</Modal>;

  const errors = {
    certificateUrl: certificateUrl.trim() && !isValidProofUrl(certificateUrl) && "Gunakan tautan https dari Google Drive atau OneDrive.",
    archiveUrl: archiveUrl.trim() && !isValidProofUrl(archiveUrl) && "Gunakan tautan https dari Google Drive atau OneDrive.",
  };
  const err = (k: keyof typeof errors) => touched && errors[k] && <p className="mt-1 text-xs text-danger">{errors[k]}</p>;
  const canSend = !!comp.advisorEmail;

  function analyze() {
    setAnalyzing(true);
    setTimeout(() => {
      setInsights(analyzePostMortem({ tasks: data.tasks.filter((t) => t.competitionId === comp!.id), users: data.users, outcome, wentWell, wentWrong, judgeFeedback }));
      setAnalyzing(false);
    }, 600);
  }

  function save() {
    setTouched(true);
    if (Object.values(errors).some(Boolean) || !ctx || !comp) return;
    const evaluation = {
      id: existing?.id ?? uid("ev"),
      competitionId: comp.id,
      outcome,
      rank: rank.trim(),
      score: score.trim(),
      certificateUrl: certificateUrl.trim() || undefined,
      archiveUrl: archiveUrl.trim() || undefined,
      wentWell: wentWell.trim(),
      wentWrong: wentWrong.trim(),
      judgeFeedback: judgeFeedback.trim(),
      insights: insights.length ? insights : undefined,
      completedAt: existing?.completedAt ?? new Date().toISOString(),
    };
    if (finished) dispatch({ type: "saveEvaluation", evaluation });
    else dispatch({ type: "finishCompetition", evaluation, stageId: ctx.stageId, stageResult: ctx.stageResult });

    if (sendFinal && canSend) {
      // Statuses are not applied yet, so give the report the post-decision view of the stages.
      const snapshot = { ...data, stages: data.stages.map((s) => (s.id === ctx.stageId && ctx.stageResult ? { ...s, status: ctx.stageResult } : s)) };
      const report = generateFinalReport(snapshot, comp.id, evaluation, now);
      dispatch({ type: "saveReport", report: { id: uid("rep"), competitionId: comp.id, weekNumber: 0, html: report.html, sentToEmail: comp.advisorEmail, sentAt: new Date().toISOString(), status: "sent", kind: "final" } });
    }
    onSaved(comp.id);
    onClose();
  }

  const stageName = stages.find((s) => s.id === ctx.stageId)?.name;

  return (
    <Modal open onClose={onClose} title={finished ? "Evaluasi Lomba" : "Selesaikan Lomba & Isi Evaluasi"} wide>
      <div className="space-y-5 p-5">
        <div className="rounded-2xl bg-white/[0.05] p-3.5 text-sm">
          <div className="font-semibold">{comp.title}</div>
          <div className="text-xs text-white/55">
            {ctx.stageResult === "eliminated" && stageName
              ? `Tim berhenti di babak ${stageName}.`
              : ctx.stageResult === "passed"
                ? `Babak ${stageName} dinyatakan lolos dan ini babak terakhir.`
                : finished
                  ? "Lomba ini sudah selesai. Anda dapat memperbarui evaluasinya."
                  : "Lomba akan dipindahkan ke Riwayat dan pengingat yang tersisa dibatalkan."}
          </div>
        </div>

        <div>
          <span className="label">Hasil akhir</span>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Hasil akhir">
            {OUTCOMES.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={outcome === o.id}
                onClick={() => setOutcome(o.id)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${outcome === o.id ? "border-active bg-active/10 font-semibold" : "border-white/10 hover:bg-white/[0.05]"}`}
              >
                <span className="mr-2">{o.emoji}</span>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ev-rank">Peringkat</label>
            <input id="ev-rank" className="field" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="mis. Rank 2 dari 150 tim" />
          </div>
          <div>
            <label className="label" htmlFor="ev-score">Skor akhir</label>
            <input id="ev-score" className="field" value={score} onChange={(e) => setScore(e.target.value)} placeholder="mis. 92,4" />
          </div>
          <div>
            <label className="label" htmlFor="ev-cert">Tautan sertifikat</label>
            <input id="ev-cert" className="field" value={certificateUrl} onChange={(e) => setCertificateUrl(e.target.value)} placeholder="https://drive.google.com/…" />
            {err("certificateUrl")}
          </div>
          <div>
            <label className="label" htmlFor="ev-arc">Arsip karya final</label>
            <input id="ev-arc" className="field" value={archiveUrl} onChange={(e) => setArchiveUrl(e.target.value)} placeholder="https://binus-my.sharepoint.com/…" />
            {err("archiveUrl")}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="ev-well">✅ Hal yang berjalan baik</label>
            <textarea id="ev-well" rows={5} className="field resize-y" value={wentWell} onChange={(e) => setWentWell(e.target.value)} placeholder="Apa yang sudah dikerjakan tim dengan baik?" />
          </div>
          <div>
            <label className="label" htmlFor="ev-wrong">⚠️ Kendala dan alasan kurang maksimal</label>
            <textarea id="ev-wrong" rows={5} className="field resize-y" value={wentWrong} onChange={(e) => setWentWrong(e.target.value)} placeholder="Masalah teknis, pengelolaan waktu, atau keahlian yang kurang" />
          </div>
          <div>
            <label className="label" htmlFor="ev-judge">💬 Masukan juri dan pelajaran</label>
            <textarea id="ev-judge" rows={5} className="field resize-y" value={judgeFeedback} onChange={(e) => setJudgeFeedback(e.target.value)} placeholder="Catatan penting untuk lomba berikutnya" />
          </div>
        </div>

        <div className="rounded-2xl bg-active/[0.07] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">Analisis Post-Mortem</div>
            <button className="btn-ghost !py-1.5 text-xs" onClick={analyze} disabled={analyzing}>
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-active" />} {insights.length ? "Analisis ulang" : "Analisis otomatis"}
            </button>
          </div>
          {insights.length === 0 ? (
            <p className="mt-1.5 text-xs text-white/50">Membaca keterlambatan tugas, pembagian beban kerja, dan catatan di atas, lalu memberi saran konkret untuk lomba berikutnya.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
              {insights.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>

        <label className={`flex items-start gap-3 rounded-2xl border border-white/10 p-3 text-sm ${canSend ? "cursor-pointer" : "opacity-60"}`}>
          <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-500" checked={sendFinal && canSend} disabled={!canSend} onChange={(e) => setSendFinal(e.target.checked)} />
          <span>
            <span className="block font-medium">Kirim Laporan Akhir Pertanggungjawaban ke Pembina</span>
            <span className="text-xs text-white/50">
              {canSend ? `Dikirim ke ${comp.advisorEmail} (simulasi di mode demo).` : "Email Pembina belum diisi. Isi lewat Ubah Detail agar laporan bisa dikirim."}
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={save}>
            {finished ? <Send size={15} /> : <Flag size={15} />} {finished ? "Simpan Evaluasi" : "Selesaikan Lomba"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
