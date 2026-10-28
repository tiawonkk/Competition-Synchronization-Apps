import { DAY, uid } from "./logic";
import type { Competition, GuidebookDraft, Milestone, PlannedTask, Priority, Stage, Task } from "./types";

interface Phase {
  name: string;
  tasks: string[];
}

const TEMPLATES: Record<string, Phase[]> = {
  "UI/UX": [
    { name: "Riset & Empati", tasks: ["Wawancara calon pengguna", "Analisis kompetitor", "Persona & journey map"] },
    { name: "Ideasi & Wireframe", tasks: ["Workshop ideasi (How Might We)", "Wireframe lo-fi", "Finalisasi user flow & IA"] },
    { name: "Prototipe & Uji", tasks: ["Design system & komponen", "Prototipe hi-fi interaktif", "Usability testing"] },
    { name: "Penyempurnaan & Pengumpulan", tasks: ["Revisi berdasarkan hasil uji", "Naskah proposal & video presentasi"] },
  ],
  Hackathon: [
    { name: "Validasi Masalah & Data", tasks: ["Validasi masalah dengan calon pengguna", "Pengumpulan data / riset teknis", "Rancangan arsitektur sistem"] },
    { name: "Pengembangan MVP", tasks: ["Implementasi fitur inti", "Integrasi API & basis data", "Pengujian fungsional"] },
    { name: "Demo & Penyempurnaan", tasks: ["Deploy versi demo", "Polesan UI & penanganan kasus tepi", "Dokumentasi teknis"] },
    { name: "Pitching & Pengumpulan", tasks: ["Deck pitch final", "Video demo", "Latihan pitching"] },
  ],
  CTF: [
    { name: "Persiapan Lab", tasks: ["Setup lab latihan", "Pembagian peran kategori soal", "Template writeup"] },
    { name: "Latihan Kategori", tasks: ["Latihan web exploitation", "Latihan kriptografi", "Latihan pwn & reverse engineering", "Latihan forensics"] },
    { name: "Simulasi", tasks: ["Simulasi CTF 6 jam", "Evaluasi simulasi & perbaikan strategi"] },
    { name: "Hari-H", tasks: ["Cek kesiapan perangkat & akun", "Pengumpulan writeup resmi"] },
  ],
  "Data Science": [
    { name: "Pemahaman Data", tasks: ["Pemahaman masalah & metrik", "Pengumpulan dan pembersihan data", "Analisis data eksploratif (EDA)"] },
    { name: "Pemodelan", tasks: ["Model baseline", "Rekayasa fitur", "Eksperimen & tuning model"] },
    { name: "Evaluasi", tasks: ["Validasi silang & analisis error", "Interpretasi model", "Penyusunan visualisasi hasil"] },
    { name: "Pelaporan & Pengumpulan", tasks: ["Laporan teknis", "Slide presentasi", "Pengumpulan notebook & prediksi final"] },
  ],
  default: [
    { name: "Analisis Masalah", tasks: ["Riset pasar & industri", "Analisis SWOT & stakeholder", "Perumusan kerangka solusi"] },
    { name: "Perancangan Solusi", tasks: ["Model bisnis (BMC)", "Proyeksi keuangan", "Rencana implementasi"] },
    { name: "Penyusunan Materi", tasks: ["Draf laporan lengkap", "Pembuatan slide presentasi", "Review internal dan advisor"] },
    { name: "Presentasi & Pengumpulan", tasks: ["Latihan presentasi & tanya jawab", "Pengumpulan berkas final"] },
  ],
};

function templateFor(category: string): Phase[] {
  const c = category.toLowerCase();
  if (c.includes("data")) return TEMPLATES["Data Science"];
  if (c.includes("ui") || c.includes("ux") || c.includes("desain")) return TEMPLATES["UI/UX"];
  if (c.includes("ctf") || c.includes("cyber") || c.includes("security")) return TEMPLATES.CTF;
  if (c.includes("hack") || c.includes("ai") || c.includes("app")) return TEMPLATES.Hackathon;
  return TEMPLATES.default;
}

export interface StageSpec {
  name: string;
  deadline: string; // ISO
}

export interface PlanInput {
  title: string;
  category: string;
  theme: string;
  deadline: string; // ISO: final deadline of the whole competition
  advisorName: string;
  advisorEmail: string;
  leaderId: string;
  memberIds: string[];
  now: number;
  inviteCode: string;
  onedriveFolderUrl?: string;
  gdriveFolderUrl?: string;
  /** Extra task titles pulled from a pasted guidebook (see extractGuidebookTasks). */
  extraTasks?: string[];
  /** Elimination rounds in order; the last deadline is the competition's final deadline. Defaults to three rounds. */
  stages?: StageSpec[];
}

export interface GeneratedPlan {
  competition: Competition;
  stages: Stage[];
  milestones: Milestone[];
  tasks: Task[];
}

export const DEFAULT_STAGE_NAMES = ["Penyisihan", "Semifinal", "Grand Final"];

const endOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
};

/** Default round deadlines at 40% / 70% / 100% of the time left; the last one is the final deadline. */
export function defaultStageSpecs(now: number, finalDeadline: number): StageSpec[] {
  const span = Math.max(3 * DAY, finalDeadline - now);
  return DEFAULT_STAGE_NAMES.map((name, i) => ({
    name,
    deadline: new Date(i === DEFAULT_STAGE_NAMES.length - 1 ? finalDeadline : Math.min(finalDeadline, endOfDay(now + span * [0.4, 0.7][i]))).toISOString(),
  }));
}

const ACCENTS = ["#3B82F6", "#A855F7", "#EF4444", "#10B981", "#F59E0B", "#06B6D4"];

/**
 * Milestones and tasks for one stage between `start` and the stage deadline. Uses the guidebook's own dated items
 * (stage.plan) when there are any, otherwise a weekly template for the competition category.
 * Called once for the first stage at creation and again whenever the team advances to the next stage.
 */
export function buildStageWork({
  competitionId,
  stage,
  category,
  assignees,
  start,
  isFinal,
}: {
  competitionId: string;
  stage: Stage;
  category: string;
  assignees: string[];
  start: number;
  isFinal: boolean;
}): { milestones: Milestone[]; tasks: Task[] } {
  const end = Math.max(new Date(stage.deadline).getTime(), start + 2 * DAY);
  const span = Math.max(DAY, end - start);
  const phases = templateFor(category);
  const parse = (d: string | null | undefined) => (d ? new Date(`${d}T23:59:00`).getTime() : NaN);
  const clamp = (t: number) => Math.min(end, Math.max(start + 3600_000, t));

  const marks = (stage.plan?.marks ?? [])
    .map((m) => ({ title: m.name, t: parse(m.date) }))
    .filter((m) => Number.isFinite(m.t) && m.t > start && m.t <= end)
    .sort((a, b) => a.t - b.t);
  const planned = stage.plan?.tasks ?? [];

  let steps: { title: string; t: number; phase?: number }[];
  if (marks.length) {
    steps = [...marks];
    if (marks[marks.length - 1].t < end - DAY) steps.push({ title: /^pengumpulan/i.test(stage.name) ? stage.name : `Pengumpulan ${stage.name}`, t: end });
  } else {
    const weeks = Math.min(6, Math.max(1, Math.ceil(span / (7 * DAY))));
    steps = Array.from({ length: weeks }, (_, w) => {
      const phase = Math.min(phases.length - 1, Math.floor((w * phases.length) / weeks));
      return { title: `Minggu ${w + 1}: ${phases[phase].name}`, t: w === weeks - 1 ? end : start + (span * (w + 1)) / weeks, phase };
    });
  }

  const milestones: Milestone[] = steps.map((s, i) => ({
    id: uid("m"),
    competitionId,
    stageId: stage.id,
    title: s.title,
    targetDate: new Date(s.t).toISOString(),
    orderIndex: i,
  }));

  const tasks: Task[] = [];
  let rr = 0;
  const add = (mi: number, title: string, description: string, due: number, priority: Priority) =>
    tasks.push({
      id: uid("t"),
      competitionId,
      stageId: stage.id,
      milestoneId: milestones[mi].id,
      assignedTo: assignees[rr++ % assignees.length],
      title,
      description,
      dueDate: new Date(clamp(due)).toISOString(),
      priority,
      isCompleted: false,
      alarmActive: true,
    });

  planned.forEach((p, k) => {
    const dated = parse(p.dueDate);
    const mi = Number.isFinite(dated) ? Math.max(0, steps.findIndex((s) => s.t >= dated)) : k % steps.length;
    add(mi, p.title, p.description || `Dari guidebook: ${stage.name}.`, Number.isFinite(dated) ? dated : steps[mi].t - 2 * DAY, p.priority);
  });

  // Generic weekly work, unless the guidebook already supplied enough of its own.
  if (!marks.length && planned.length < 3) {
    const pointers = phases.map(() => 0);
    steps.forEach((s, w) => {
      const phase = phases[s.phase ?? 0];
      const weekStart = w === 0 ? start : steps[w - 1].t;
      const weekMs = s.t - weekStart;
      const lastWeek = w === steps.length - 1;
      const picks: string[] = [];
      for (let k = 0; k < 2; k++) {
        const idx = pointers[s.phase ?? 0]++ % phase.tasks.length;
        if (!picks.includes(phase.tasks[idx])) picks.push(phase.tasks[idx]);
      }
      if (lastWeek) picks.push(isFinal ? "Unggah berkas final ke panitia" : `Kumpulkan karya ${stage.name}`);
      picks.forEach((title, k) => {
        const frac = lastWeek && k === picks.length - 1 ? 0.95 : 0.45 + 0.4 * (k / Math.max(1, picks.length - 1));
        const priority: Priority = lastWeek ? (isFinal ? "critical" : "high") : w >= steps.length - 2 ? "high" : "medium";
        add(w, title, k === 0 && w === 0 ? `Mengacu pada babak ${stage.name}.` : `Bagian dari ${phase.name}.`, weekStart + weekMs * frac, priority);
      });
    });
  }

  // Every milestone gets at least one task so none is an empty shell.
  milestones.forEach((m, i) => {
    if (!tasks.some((t) => t.milestoneId === m.id)) add(i, `Siapkan: ${m.title}`, "Dibuat otomatis dari tahapan guidebook.", steps[i].t - 2 * DAY, i === milestones.length - 1 ? "critical" : "medium");
  });

  return { milestones, tasks };
}

/**
 * Builds the whole competition: stages (only the first one is active), the guidebook's dated items spread over the
 * stages by date, and real milestones and tasks for the first stage. Later stages keep their plan until unlocked.
 */
export function generatePlan(input: PlanInput, accentSeed: number, draft?: GuidebookDraft | null): GeneratedPlan {
  const finalDeadline = new Date(input.deadline).getTime();
  const specs = (input.stages?.length ? input.stages : defaultStageSpecs(input.now, finalDeadline)).map((s) => ({ name: s.name, t: new Date(s.deadline).getTime() }));
  specs.sort((a, b) => a.t - b.t);
  specs[specs.length - 1].t = finalDeadline;

  const compId = uid("c");
  const assignees = input.memberIds.length ? input.memberIds : [input.leaderId];

  const stages: Stage[] = specs.map((s, i) => ({
    id: uid("s"),
    competitionId: compId,
    name: s.name,
    orderIndex: i,
    status: i === 0 ? "active" : "upcoming",
    deadline: new Date(Math.min(s.t, finalDeadline)).toISOString(),
  }));

  const stageIndexOf = (date: string | null) => {
    if (!date) return 0;
    const t = new Date(`${date}T23:59:00`).getTime();
    const i = stages.findIndex((s) => new Date(s.deadline).getTime() >= t);
    return i < 0 ? stages.length - 1 : i;
  };
  const plans = stages.map(() => ({ marks: [] as { name: string; date: string }[], tasks: [] as PlannedTask[] }));
  if (draft) {
    for (const s of draft.stages) if (!s.isRound && s.date) plans[stageIndexOf(s.date)].marks.push({ name: s.name, date: s.date });
    for (const t of draft.tasks) plans[stageIndexOf(t.dueDate)].tasks.push(t);
  } else {
    for (const title of input.extraTasks ?? []) plans[0].tasks.push({ title, description: "Dari guidebook.", dueDate: null, priority: "medium" });
  }
  stages.forEach((s, i) => {
    if (plans[i].marks.length || plans[i].tasks.length) s.plan = plans[i];
  });

  const guide = draft && (draft.rubric?.length || draft.deliverables?.length || draft.rules?.length) ? { rubric: draft.rubric ?? [], deliverables: draft.deliverables ?? [], rules: draft.rules ?? [] } : undefined;

  const competition: Competition = {
    id: compId,
    title: input.title,
    category: input.category,
    theme: input.theme,
    startDate: new Date(input.now).toISOString(),
    submissionDeadline: stages[stages.length - 1].deadline,
    advisorName: input.advisorName,
    advisorEmail: input.advisorEmail,
    onedriveFolderUrl: input.onedriveFolderUrl || undefined,
    gdriveFolderUrl: input.gdriveFolderUrl || undefined,
    status: "active",
    accent: ACCENTS[accentSeed % ACCENTS.length],
    inviteCode: input.inviteCode,
    guide,
  };

  const work = buildStageWork({ competitionId: compId, stage: stages[0], category: input.category, assignees, start: input.now, isFinal: stages.length === 1 });
  stages[0] = { ...stages[0], plan: undefined };
  return { competition, stages, milestones: work.milestones, tasks: work.tasks };
}

/** Pulls actionable requirements (bullets / "wajib" lines) out of pasted guidebook text, at most 4. */
export function extractGuidebookTasks(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const bullet = /^\s*([-*•]|\d+[.)])\s/.test(raw);
    const line = raw.replace(/^[\s\-*•\d.)]+/, "").trim();
    if (line.length < 8 || line.length > 90) continue;
    if (bullet || /wajib|harus|dokumen|kumpul|submit|unggah|proposal|video/i.test(line)) {
      const title = line.charAt(0).toUpperCase() + line.slice(1);
      if (!out.includes(title)) out.push(title);
    }
    if (out.length === 4) break;
  }
  return out;
}
