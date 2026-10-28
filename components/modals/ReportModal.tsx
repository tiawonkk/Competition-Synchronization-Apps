"use client";

import { CheckCircle2, Clock, Loader2, RefreshCw, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fmtDateTime, fmtWib, nextAutoSend, uid } from "@/lib/logic";
import { generateAdvisorReport } from "@/lib/report";
import { useStore } from "@/lib/store";
import { Badge, Modal } from "../ui";

export default function ReportModal({ competitionId, onClose }: { competitionId: string | null; onClose: () => void }) {
  const { data, now, me, dispatch } = useStore();
  const [nonce, setNonce] = useState(0);
  const [phase, setPhase] = useState<"idle" | "sending" | "sent">("idle");
  const [viewing, setViewing] = useState<string | null>(null); // id of a past report shown in the preview

  useEffect(() => {
    setPhase("idle");
    setViewing(null);
  }, [competitionId]);

  // `nonce` forces regeneration after tasks change while the modal is open
  const report = useMemo(
    () => (competitionId ? generateAdvisorReport(data, competitionId, now) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [competitionId, data, nonce],
  );
  const comp = data.competitions.find((c) => c.id === competitionId);
  const history = data.reports.filter((r) => r.competitionId === competitionId);
  const past = history.find((r) => r.id === viewing);
  const isLeader = data.members.some((m) => m.competitionId === competitionId && m.userId === me && m.role === "leader");
  const next = useMemo(() => nextAutoSend(now), [now]);

  function send() {
    if (!report || !comp || !isLeader) return;
    setPhase("sending");
    // Simulated send: in production this POSTs to /api/advisor-report with { send: true }, which calls Resend.
    setTimeout(() => {
      dispatch({
        type: "saveReport",
        report: {
          id: uid("rep"),
          competitionId: comp.id,
          weekNumber: report.weekNumber,
          html: report.html,
          sentToEmail: comp.advisorEmail,
          sentAt: new Date().toISOString(),
          status: "sent",
        },
      });
      setPhase("sent");
    }, 1300);
  }

  return (
    <Modal open={!!competitionId} onClose={onClose} title="Laporan Progres untuk Pembina" wide>
      {comp && report && (
        <div className="p-5">
          <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <span className="text-white/40">Kepada</span>
            <span>
              {comp.advisorName} &lt;{comp.advisorEmail}&gt;
            </span>
            <span className="text-white/40">Subjek</span>
            <span>{past ? `[Arsip] Laporan minggu ${past.weekNumber}` : report.subject}</span>
          </div>

          <div className="mt-3 max-h-[40vh] overflow-y-auto rounded-xl bg-[#ffffff]" aria-label="Pratinjau email">
            <div dangerouslySetInnerHTML={{ __html: past ? past.html : report.html }} />
          </div>
          {past && (
            <button className="mt-2 text-xs text-active hover:underline" onClick={() => setViewing(null)}>
              Kembali ke laporan terbaru
            </button>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <label className={`flex items-center gap-3 text-sm ${isLeader ? "cursor-pointer" : "opacity-60"}`}>
              <input
                type="checkbox"
                role="switch"
                className="h-4 w-4 accent-blue-500"
                checked={!!comp.autoSendWeekly}
                disabled={!isLeader}
                onChange={(e) => dispatch({ type: "setAutoSend", competitionId: comp.id, on: e.target.checked })}
              />
              <span>
                <span className="block font-medium">Auto-Send Setiap Minggu (19:00 WIB)</span>
                <span className="flex items-center gap-1 text-xs text-white/50">
                  <Clock size={12} />
                  {comp.autoSendWeekly ? `Pengiriman berikutnya: ${fmtWib(next)}` : "Nonaktif"}
                </span>
              </span>
            </label>
            {!isLeader && <span className="text-xs text-white/45">Hanya Ketua yang dapat mengubah atau mengirim.</span>}
          </div>

          <div className="mt-3">
            <div className="mb-1.5 text-xs font-semibold text-white/60">Riwayat pengiriman ({history.length})</div>
            {history.length === 0 ? (
              <p className="text-xs text-white/40">Belum ada laporan yang dikirim.</p>
            ) : (
              <ul className="max-h-32 space-y-1 overflow-y-auto">
                {history.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setViewing(r.id)}
                      className={`flex w-full flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-white/[0.06] ${viewing === r.id ? "bg-active/10" : ""}`}
                    >
                      <Badge tone={r.status === "sent" ? "safe" : "warn"}>{r.status === "sent" ? "Terkirim" : "Draf"}</Badge>
                      <span className="font-medium">Minggu {r.weekNumber}</span>
                      <span className="text-white/45">ke {r.sentToEmail}</span>
                      <span className="ml-auto text-white/40">{fmtDateTime(r.sentAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button className="btn-ghost" onClick={() => setNonce((n) => n + 1)}>
              <RefreshCw size={15} /> Segarkan data
            </button>
            {phase === "sent" ? (
              <span className="flex items-center gap-2 text-sm text-safe" role="status">
                <CheckCircle2 size={18} /> Terkirim (simulasi) ke {comp.advisorEmail}
              </span>
            ) : (
              <button className="btn-primary" onClick={send} disabled={phase === "sending" || !isLeader} title={isLeader ? undefined : "Hanya Ketua yang dapat mengirim laporan"}>
                {phase === "sending" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Kirim Laporan ke Email Pembina Sekarang
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
