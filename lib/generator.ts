import { DAY, uid } from "./logic";
import type { Competition, GuidebookDraft, Milestone, Priority, Task } from "./types";

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

export interface PlanInput {
  title: string;
  category: string;
  theme: string;
  deadline: string; // ISO
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
}

export interface GeneratedPlan {
  competition: Competition;
  milestones: Milestone[];
  tasks: Task[];
}

const ACCENTS = ["#3B82F6", "#A855F7", "#EF4444", "#10B981", "#F59E0B", "#06B6D4"];

/** Deterministic AI-style breakdown: weekly milestones + actionable tasks, assigned round-robin to the team. */
export function generatePlan(input: PlanInput, accentSeed: number): GeneratedPlan {
  const deadline = new Date(input.deadline).getTime();
  const span = Math.max(DAY, deadline - input.now);
  const weeks = Math.min(8, Math.max(2, Math.ceil(span / (7 * DAY))));
  const weekMs = span / weeks;
  const phases = templateFor(input.category);
  const compId = uid("c");
  const assignees = input.memberIds.length ? input.memberIds : [input.leaderId];
  const pointers = phases.map(() => 0);
  let rr = 0;

  const competition: Competition = {
    id: compId,
    title: input.title,
    category: input.category,
    theme: input.theme,
    startDate: new Date(input.now).toISOString(),
    submissionDeadline: new Date(deadline).toISOString(),
    advisorName: input.advisorName,
    advisorEmail: input.advisorEmail,
    onedriveFolderUrl: input.onedriveFolderUrl || undefined,
    gdriveFolderUrl: input.gdriveFolderUrl || undefined,
    status: "active",
    accent: ACCENTS[accentSeed % ACCENTS.length],
    inviteCode: input.inviteCode,
  };

  const milestones: Milestone[] = [];
  const tasks: Task[] = [];

  for (let w = 0; w < weeks; w++) {
    const pi = Math.min(phases.length - 1, Math.floor((w * phases.length) / weeks));
    const phase = phases[pi];
    const weekStart = input.now + w * weekMs;
    const target = w === weeks - 1 ? deadline : weekStart + weekMs;
    const mId = uid("m");
    milestones.push({
      id: mId,
      competitionId: compId,
      title: `Minggu ${w + 1}: ${phase.name}`,
      targetDate: new Date(target).toISOString(),
      orderIndex: w,
    });

    const picks: string[] = [];
    for (let k = 0; k < 2; k++) {
      const idx = pointers[pi]++ % phase.tasks.length;
      if (!picks.includes(phase.tasks[idx])) picks.push(phase.tasks[idx]);
    }
    const isLast = w === weeks - 1;
    if (w === 0) for (const extra of input.extraTasks ?? []) picks.push(extra);
    if (isLast) picks.push("Unggah berkas final ke panitia");

    picks.forEach((title, k) => {
      const frac = isLast && k === picks.length - 1 ? 0.95 : 0.45 + 0.4 * (k / Math.max(1, picks.length - 1));
      const priority: Priority = isLast ? "critical" : w >= weeks - 2 ? "high" : "medium";
      tasks.push({
        id: uid("t"),
        competitionId: compId,
        milestoneId: mId,
        assignedTo: assignees[rr++ % assignees.length],
        title,
        description: k === 0 && w === 0 ? `Mengacu pada tema: ${input.theme || input.title}` : `Bagian dari ${phase.name}.`,
        dueDate: new Date(Math.min(deadline, weekStart + weekMs * frac)).toISOString(),
        priority,
        isCompleted: false,
        alarmActive: true,
      });
    });
  }

  return { competition, milestones, tasks };
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

/**
 * Plan driven by a guidebook: milestones are the stages the organiser published (registration, abstract, final...),
 * and tasks are the requirements it lists. Without any usable dated stage it degrades to the generic plan
 * plus the guidebook's requirements as extra tasks.
 */
export function generatePlanFromGuidebook(input: PlanInput, draft: GuidebookDraft, accentSeed: number): GeneratedPlan {
  const deadline = new Date(input.deadline).getTime();
  const minT = input.now + 3600_000;
  const parse = (d: string | null) => (d ? new Date(`${d}T23:59:00`).getTime() : NaN);

  const stages = draft.stages
    .map((s) => ({ name: s.name, t: parse(s.date) }))
    .filter((s) => Number.isFinite(s.t) && s.t >= minT && s.t <= deadline)
    .sort((a, b) => a.t - b.t);

  if (stages.length === 0) {
    return generatePlan({ ...input, extraTasks: draft.tasks.map((t) => t.title).slice(0, 6) }, accentSeed);
  }
  if (stages[stages.length - 1].t < deadline - DAY) stages.push({ name: "Pengumpulan final", t: deadline });

  const base = generatePlan(input, accentSeed);
  const compId = base.competition.id;
  const assignees = input.memberIds.length ? input.memberIds : [input.leaderId];
  let rr = 0;

  const milestones: Milestone[] = stages.map((s, i) => ({
    id: uid("m"),
    competitionId: compId,
    title: s.name,
    targetDate: new Date(s.t).toISOString(),
    orderIndex: i,
  }));
  const clamp = (t: number) => Math.min(deadline, Math.max(minT + DAY, t));

  const tasks: Task[] = [];
  const add = (mi: number, title: string, description: string, due: number, priority: Priority) =>
    tasks.push({
      id: uid("t"),
      competitionId: compId,
      milestoneId: milestones[mi].id,
      assignedTo: assignees[rr++ % assignees.length],
      title,
      description,
      dueDate: new Date(due).toISOString(),
      priority,
      isCompleted: false,
      alarmActive: true,
    });

  draft.tasks.forEach((t, k) => {
    const dated = parse(t.dueDate);
    const mi = Number.isFinite(dated) ? Math.max(0, stages.findIndex((s) => s.t >= dated)) : k % stages.length;
    const target = stages[mi].t;
    add(mi, t.title, t.description, clamp(Number.isFinite(dated) ? dated : target - 2 * DAY), t.priority);
  });
  // Every stage gets at least one task so no milestone is an empty shell.
  milestones.forEach((m, i) => {
    if (!tasks.some((t) => t.milestoneId === m.id)) add(i, `Siapkan: ${m.title}`, "Dibuat otomatis dari tahapan guidebook.", clamp(stages[i].t - 2 * DAY), i === milestones.length - 1 ? "critical" : "medium");
  });

  return { competition: base.competition, milestones, tasks };
}
