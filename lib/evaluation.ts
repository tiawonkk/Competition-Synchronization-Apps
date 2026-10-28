import { DAY } from "./logic";
import type { Evaluation, OutcomeTier, Stage, StageStatus, Task, User } from "./types";

export const OUTCOMES: { id: OutcomeTier; label: string; emoji: string; win: boolean }[] = [
  { id: "juara1", label: "Juara 1", emoji: "🥇", win: true },
  { id: "juara2", label: "Juara 2", emoji: "🥈", win: true },
  { id: "juara3", label: "Juara 3", emoji: "🥉", win: true },
  { id: "harapan", label: "Juara Harapan / Best Award", emoji: "🏅", win: true },
  { id: "finalis", label: "Finalis", emoji: "🎖️", win: false },
  { id: "gugur_semifinal", label: "Gugur di Semifinal", emoji: "🛑", win: false },
  { id: "gugur_kualifikasi", label: "Gugur di Kualifikasi", emoji: "🛑", win: false },
];

export const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.id, `${o.label} ${o.emoji}`])) as Record<OutcomeTier, string>;
export const OUTCOME_WIN = Object.fromEntries(OUTCOMES.map((o) => [o.id, o.win])) as Record<OutcomeTier, boolean>;

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  upcoming: "Terkunci",
  active: "Sedang berjalan",
  passed: "Lolos",
  eliminated: "Gugur",
};

/** Sensible default outcome when a round ends: where in the pipeline the team stopped. */
export function suggestOutcome(stages: Stage[], stageId: string | undefined, result: "passed" | "eliminated" | undefined): OutcomeTier {
  const ordered = [...stages].sort((a, b) => a.orderIndex - b.orderIndex);
  const idx = ordered.findIndex((s) => s.id === stageId);
  if (result === "eliminated") {
    if (idx <= 0) return "gugur_kualifikasi";
    return idx === ordered.length - 1 ? "finalis" : "gugur_semifinal";
  }
  return result === "passed" && idx === ordered.length - 1 ? "juara1" : "finalis";
}

interface InsightInput {
  tasks: Task[];
  users: User[];
  outcome: OutcomeTier;
  wentWell: string;
  wentWrong: string;
  judgeFeedback: string;
}

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

/**
 * Rule-based post-mortem: looks at how the team really executed (late tasks, workload split, proof) and at the
 * notes they wrote, then returns concrete advice for the next competition. No external model involved.
 */
export function analyzePostMortem({ tasks, users, outcome, wentWell, wentWrong, judgeFeedback }: InsightInput): string[] {
  const out: string[] = [];
  const total = tasks.length;
  const done = tasks.filter((t) => t.isCompleted);
  const late = done.filter((t) => t.completedAt && new Date(t.completedAt).getTime() > new Date(t.dueDate).getTime());
  const open = tasks.filter((t) => !t.isCompleted);
  const noProof = done.filter((t) => !t.proofUrl);

  if (total === 0) return ["Belum ada data tugas untuk dianalisis. Isi catatan evaluasi lalu jalankan analisis lagi."];

  if (late.length > 0) {
    const avg = late.reduce((s, t) => s + (new Date(t.completedAt!).getTime() - new Date(t.dueDate).getTime()) / DAY, 0) / late.length;
    out.push(`${late.length} dari ${done.length} tugas selesai melewati tenggat (rata-rata telat ${avg.toFixed(1)} hari). Pasang tenggat internal 2 hari lebih awal dari tenggat resmi dan beri alarm khusus untuk tugas prioritas tinggi.`);
  } else if (done.length > 0) {
    out.push("Semua tugas selesai tepat waktu. Pertahankan ritme ini: kebiasaan menyelesaikan tugas sebelum tenggat adalah modal terbesar tim.");
  }

  if (open.length > 0) out.push(`${open.length} tugas belum selesai saat lomba berakhir. Pecah tugas besar menjadi bagian yang selesai dalam 1 sampai 2 hari agar progres lebih mudah dipantau.`);

  const byUser = new Map<string, Task[]>();
  for (const t of tasks) if (t.assignedTo) byUser.set(t.assignedTo, [...(byUser.get(t.assignedTo) ?? []), t]);
  const sorted = [...byUser.entries()].sort((a, b) => b[1].length - a[1].length);
  if (sorted.length > 1 && sorted[0][1].length / total > 0.5) {
    const name = users.find((u) => u.id === sorted[0][0])?.fullName.split(" ")[0] ?? "Satu anggota";
    out.push(`Beban kerja timpang: ${name} memegang ${Math.round((sorted[0][1].length / total) * 100)}% tugas. Bagi tugas lebih merata di awal lomba supaya tidak ada satu titik kemacetan.`);
  }

  const lateCritical = late.filter((t) => t.priority === "critical" || t.priority === "high");
  if (lateCritical.length > 0) out.push(`${lateCritical.length} tugas prioritas tinggi terlambat. Kerjakan pekerjaan yang paling menentukan nilai lebih dulu, bukan yang paling mudah.`);

  const rescheduled = tasks.filter((t) => t.rescheduledFrom).length;
  if (rescheduled > 0) out.push(`${rescheduled} tugas harus dijadwal ulang karena bentrok antar lomba. Saat memilih lomba berikutnya, cek dulu radar bentrok agar beban tidak menumpuk di minggu yang sama.`);

  if (noProof.length > 0 && done.length > 0) out.push(`${noProof.length} tugas selesai tanpa bukti tautan. Simpan bukti di Cloud Vault agar mudah dipakai sebagai lampiran laporan dan portofolio.`);

  const notes = `${wentWrong} ${judgeFeedback}`.toLowerCase();
  if (has(notes, "waktu", "deadline", "mepet", "telat", "terlambat")) out.push("Catatan tim menyebut masalah waktu. Mulai dari tenggat dan mundur: tetapkan tanggal bebas revisi minimal 3 hari sebelum pengumpulan.");
  if (has(notes, "komunikasi", "koordinasi", "miskom", "salah paham")) out.push("Ada kendala komunikasi. Tetapkan satu ritme singkat (misalnya cek progres 15 menit dua kali seminggu) dan catat keputusan di whiteboard.");
  if (has(notes, "teknis", "bug", "error", "server", "model", "akurasi", "deploy")) out.push("Ada kendala teknis. Sisihkan waktu khusus untuk uji dan deploy percobaan satu minggu sebelum tenggat, bukan di hari terakhir.");
  if (has(notes, "riset", "data", "literatur", "referensi", "validasi")) out.push("Kekurangan di sisi riset atau data. Mulai pengumpulan data dan validasi lebih awal, dan libatkan Pembina untuk mengecek dasar ilmiahnya.");
  if (has(notes, "presentasi", "pitch", "demo", "slide", "menjawab", "tanya jawab")) out.push("Presentasi perlu dilatih. Jadwalkan minimal dua kali gladi bersih dengan pertanyaan juri tiruan sebelum babak presentasi.");
  if (has(notes, "kriteria", "rubrik", "juri", "penilaian")) out.push("Juri memberi sinyal soal kriteria penilaian. Petakan setiap bagian karya ke rubrik guidebook sejak awal, lalu periksa satu per satu sebelum mengumpulkan.");
  if (has(wentWell.toLowerCase(), "kompak", "solid", "kerja sama", "kolaborasi")) out.push("Kekompakan tim adalah kekuatan Anda. Pertahankan susunan tim dan cara kerja yang sama untuk lomba berikutnya.");

  if (OUTCOME_WIN[outcome]) out.push("Hasil bagus. Dokumentasikan strategi yang berhasil (alur kerja, pembagian peran, template) supaya bisa dipakai ulang dan dibagikan ke tim lain.");
  else if (outcome === "finalis") out.push("Lolos sampai final adalah capaian kuat. Selisih ke podium biasanya ada di detail: baca ulang rubrik penilaian dan bandingkan dengan karya pemenang.");
  else out.push("Gugur adalah data berharga. Minta lembar penilaian atau umpan balik juri ke panitia, lalu jadikan sebagai daftar perbaikan untuk lomba berikutnya.");

  return out.slice(0, 8);
}

export interface Analytics {
  total: number;
  podium: number;
  finalists: number;
  winRate: number; // percent of finished competitions that ended on the podium or with an award
  reachFinalRate: number;
  lateRate: number; // percent of completed tasks finished after their deadline
}

export function summarizeHistory(evaluations: Evaluation[], tasks: Task[]): Analytics {
  const total = evaluations.length;
  const podium = evaluations.filter((e) => OUTCOME_WIN[e.outcome]).length;
  const finalists = evaluations.filter((e) => e.outcome === "finalis" || OUTCOME_WIN[e.outcome]).length;
  const ids = new Set(evaluations.map((e) => e.competitionId));
  const done = tasks.filter((t) => ids.has(t.competitionId) && t.isCompleted && t.completedAt);
  const late = done.filter((t) => new Date(t.completedAt!).getTime() > new Date(t.dueDate).getTime()).length;
  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((100 * n) / d));
  return { total, podium, finalists, winRate: pct(podium, total), reachFinalRate: pct(finalists, total), lateRate: pct(late, done.length) };
}
