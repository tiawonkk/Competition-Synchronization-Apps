"use client";

import { Award, ExternalLink, Pencil, Search, Target, TrendingUp, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { OUTCOME_LABEL, OUTCOME_WIN, STAGE_STATUS_LABEL, summarizeHistory } from "@/lib/evaluation";
import { fmtLong } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Badge } from "./ui";
import type { EvalContext } from "./modals/EvaluationModal";

/** "Riwayat, Rank & Evaluasi": finished competitions, win-rate analytics and searchable post-mortem lessons. */
export default function HistoryView({ onEvaluate, onOpen }: { onEvaluate: (ctx: EvalContext) => void; onOpen: (competitionId: string) => void }) {
  const { data, me, myCompetitions } = useStore();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const mine = new Set(myCompetitions.map((c) => c.id));
    return data.evaluations
      .filter((e) => mine.has(e.competitionId))
      .map((e) => ({ e, comp: data.competitions.find((c) => c.id === e.competitionId)! }))
      .filter((r) => r.comp)
      .sort((a, b) => +new Date(b.e.completedAt) - +new Date(a.e.completedAt));
  }, [data.evaluations, data.competitions, myCompetitions]);

  const stats = summarizeHistory(rows.map((r) => r.e), data.tasks);
  const q = query.trim().toLowerCase();
  const shown = rows.filter(({ e, comp }) =>
    !q ? true : [comp.title, comp.category, OUTCOME_LABEL[e.outcome], e.rank, e.score, e.wentWell, e.wentWrong, e.judgeFeedback, ...(e.insights ?? [])].join(" ").toLowerCase().includes(q),
  );

  if (rows.length === 0) {
    return (
      <div className="card mx-auto mt-6 max-w-2xl p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-active/15 text-active">
          <Trophy size={26} />
        </span>
        <h2 className="mt-4 text-xl font-bold">Belum ada lomba yang selesai</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-white/60">
          Setelah tim menekan <strong>Selesaikan Lomba</strong> atau gugur di suatu babak, hasil, peringkat, dan evaluasinya tersimpan di sini sebagai portofolio dan bahan belajar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Trophy size={16} />} label="Lomba selesai" value={String(stats.total)} bg="lav" />
        <Stat icon={<Award size={16} />} label="Win rate (juara/award)" value={`${stats.winRate}%`} bg="mint" />
        <Stat icon={<Target size={16} />} label="Capai final" value={`${stats.reachFinalRate}%`} bg="sky" />
        <Stat icon={<TrendingUp size={16} />} label="Tugas selesai telat" value={`${stats.lateRate}%`} bg={stats.lateRate > 30 ? "peach" : "cream"} />
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
        <input className="field !pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari pelajaran, kendala, nama lomba, atau hasil…" aria-label="Cari riwayat dan evaluasi" />
      </div>

      {shown.length === 0 && <p className="py-6 text-center text-sm text-white/45">Tidak ada evaluasi yang cocok dengan pencarian.</p>}

      <ul className="space-y-4">
        {shown.map(({ e, comp }) => {
          const stages = data.stages.filter((s) => s.competitionId === comp.id).sort((a, b) => a.orderIndex - b.orderIndex);
          const leader = data.members.some((m) => m.competitionId === comp.id && m.userId === me && m.role === "leader");
          return (
            <li key={e.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={OUTCOME_WIN[e.outcome] ? "safe" : e.outcome === "finalis" ? "active" : "warn"}>{OUTCOME_LABEL[e.outcome]}</Badge>
                    <span className="text-xs text-white/45">{comp.category} · selesai {fmtLong(e.completedAt)}</span>
                  </div>
                  <button className="mt-1 text-left text-lg font-bold hover:underline" onClick={() => onOpen(comp.id)}>
                    {comp.title}
                  </button>
                  <div className="text-sm text-white/60">
                    {[e.rank, e.score && `Skor ${e.score}`].filter(Boolean).join(" · ") || "Peringkat belum dicatat"}
                  </div>
                </div>
                {leader && (
                  <button className="btn-ghost !py-1.5 text-xs" onClick={() => onEvaluate({ competitionId: comp.id })}>
                    <Pencil size={14} /> Ubah Evaluasi
                  </button>
                )}
              </div>

              <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Perjalanan babak">
                {stages.map((s) => (
                  <li key={s.id}>
                    <Badge tone={s.status === "passed" ? "safe" : s.status === "eliminated" ? "danger" : "neutral"}>
                      {s.name}: {s.status === "upcoming" ? "tidak dilanjutkan" : STAGE_STATUS_LABEL[s.status]}
                    </Badge>
                  </li>
                ))}
              </ol>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Note title="✅ Berjalan baik" text={e.wentWell} />
                <Note title="⚠️ Kendala" text={e.wentWrong} />
                <Note title="💬 Masukan juri" text={e.judgeFeedback} />
              </div>

              {e.insights && e.insights.length > 0 && (
                <div className="mt-3 rounded-2xl bg-active/[0.07] p-3.5">
                  <div className="text-xs font-semibold text-active">Saran untuk lomba berikutnya</div>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
                    {e.insights.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(e.certificateUrl || e.archiveUrl) && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {e.certificateUrl && (
                    <a href={e.certificateUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-active hover:underline">
                      <ExternalLink size={12} /> Sertifikat
                    </a>
                  )}
                  {e.archiveUrl && (
                    <a href={e.archiveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-active hover:underline">
                      <ExternalLink size={12} /> Arsip karya final
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Note({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3">
      <div className="text-xs font-semibold text-white/60">{title}</div>
      <p className="mt-1 whitespace-pre-line text-sm">{text || <span className="text-white/35">Belum diisi.</span>}</p>
    </div>
  );
}

function Stat({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: "lav" | "mint" | "cream" | "peach" | "sky" }) {
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
