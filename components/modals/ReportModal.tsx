"use client";

import { CheckCircle2, Loader2, Mail, RefreshCw, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { generateAdvisorReport } from "@/lib/report";
import { uid } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Badge, Modal } from "../ui";

export default function ReportModal({ competitionId, onClose }: { competitionId: string | null; onClose: () => void }) {
  const { data, now, dispatch } = useStore();
  const [nonce, setNonce] = useState(0);
  const [phase, setPhase] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => setPhase("idle"), [competitionId]);

  // `nonce` forces regeneration after tasks change while the modal is open
  const report = useMemo(
    () => (competitionId ? generateAdvisorReport(data, competitionId, now) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [competitionId, data, nonce],
  );
  const comp = data.competitions.find((c) => c.id === competitionId);
  const previous = data.reports.filter((r) => r.competitionId === competitionId);

  function send() {
    if (!report || !comp) return;
    setPhase("sending");
    // Simulated send: in production this POSTs to a Route Handler that calls Resend with report.html.
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
            <span>{report.subject}</span>
          </div>

          <div className="mt-3 max-h-[46vh] overflow-y-auto rounded-xl bg-[#ffffff]" aria-label="Pratinjau email">
            <div dangerouslySetInnerHTML={{ __html: report.html }} />
          </div>

          {previous.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/50">
              Riwayat:
              {previous.map((r) => (
                <Badge key={r.id} tone="safe">
                  Minggu {r.weekNumber} terkirim ke {r.sentToEmail}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button className="btn-ghost" onClick={() => setNonce((n) => n + 1)}>
              <RefreshCw size={15} /> Segarkan data
            </button>
            {phase === "sent" ? (
              <span className="flex items-center gap-2 text-sm text-safe">
                <CheckCircle2 size={18} /> Terkirim (simulasi) ke {comp.advisorEmail}
              </span>
            ) : (
              <button className="btn-primary" onClick={send} disabled={phase === "sending"}>
                {phase === "sending" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <Mail size={16} /> Kirim ke Pembina via Email
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
