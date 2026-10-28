import type { AdvisorReport, Competition, Member, Milestone, Notice, Resource, Task, User, WhiteboardElement } from "./types";

export const TEAM_ROLES = ["Hustler / Lead", "Hacker / AI & Backend", "Hipster / UI-UX", "Researcher"] as const;
export const AVATAR_COLORS = ["#3B82F6", "#EC4899", "#10B981", "#F59E0B", "#8B5CF6", "#06B6D4", "#EF4444", "#14B8A6"];

export const NOTE_COLORS: Record<NonNullable<WhiteboardElement["kind"]>, string> = {
  ide: "#FEF08A",
  fitur: "#BFDBFE",
  riset: "#BBF7D0",
  kendala: "#FECDD3",
};

export interface AppData {
  users: User[];
  competitions: Competition[];
  members: Member[];
  milestones: Milestone[];
  tasks: Task[];
  resources: Resource[];
  reports: AdvisorReport[];
  whiteboard: WhiteboardElement[];
  notices: Notice[];
  /** id of the signed-in user, or null on the login screen. Persisted with the rest of the data. */
  session: string | null;
}

/** Builds realistic dummy data relative to `now` so alarms and collisions are always testable. */
export function buildSeed(now: number): AppData {
  const at = (days: number, hour: number, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const inHours = (h: number) => new Date(now + h * 3600_000).toISOString();

  const users: User[] = [
    { id: "u1", fullName: "Raka Pratama", emailGoogle: "raka.pratama@gmail.com", emailMicrosoft: "raka.pratama@binus.ac.id", color: "#3B82F6", headline: "Ketua Tim · AI Engineer" },
    { id: "u2", fullName: "Salsabila Putri", emailGoogle: "salsabila.putri@gmail.com", emailMicrosoft: "salsabila.putri@binus.ac.id", color: "#EC4899", headline: "Anggota 2 · UI/UX Designer" },
    { id: "u3", fullName: "Dimas Anggara", emailMicrosoft: "dimas.anggara@binus.ac.id", color: "#10B981", headline: "Anggota 3 · Backend / Security" },
    { id: "u4", fullName: "Nadya Kirana", emailGoogle: "nadya.kirana@gmail.com", emailMicrosoft: "nadya.kirana@binus.ac.id", color: "#F59E0B" },
    { id: "u5", fullName: "Fajar Ramadhan", emailGoogle: "fajar.ramadhan@gmail.com", color: "#8B5CF6" },
    { id: "u6", fullName: "Citra Lestari", emailGoogle: "citra.lestari@gmail.com", emailMicrosoft: "citra.lestari@binus.ac.id", color: "#06B6D4" },
  ];

  const competitions: Competition[] = [
    {
      id: "c1",
      title: "Gemastik UX Design",
      category: "UI/UX",
      theme: "Layanan Digital Inklusif untuk UMKM Indonesia",
      startDate: at(-12, 8),
      submissionDeadline: at(6, 23, 59),
      advisorName: "Dr. Ir. Hendra Wijaya, M.Kom.",
      advisorEmail: "hendra.wijaya@binus.ac.id",
      onedriveFolderUrl: "https://binus-my.sharepoint.com/personal/raka_pratama/Gemastik-UX",
      gdriveFolderUrl: "https://drive.google.com/drive/folders/gemastik-ux-2026",
      status: "active",
      accent: "#3B82F6",
      inviteCode: "GEM-26",
    },
    {
      id: "c2",
      title: "Hackathon Nasional AI",
      category: "Hackathon",
      theme: "Asisten AI untuk Layanan Kesehatan Primer",
      startDate: at(-9, 8),
      submissionDeadline: at(14, 17),
      advisorName: "Maya Kusuma, S.T., M.T.",
      advisorEmail: "maya.kusuma@binus.ac.id",
      onedriveFolderUrl: "https://binus-my.sharepoint.com/personal/salsabila_putri/Hackathon-AI",
      gdriveFolderUrl: "https://drive.google.com/drive/folders/hackathon-ai-2026",
      status: "active",
      accent: "#A855F7",
      inviteCode: "HACK-88",
    },
    {
      id: "c3",
      title: "CyberJawara CTF",
      category: "CTF",
      theme: "Penyisihan Online: Web, Crypto, Pwn, Forensics",
      startDate: at(-5, 8),
      submissionDeadline: at(20, 20),
      advisorName: "Agus Santoso, M.Sc.",
      advisorEmail: "agus.santoso@binus.ac.id",
      onedriveFolderUrl: "https://binus-my.sharepoint.com/personal/dimas_anggara/CyberJawara",
      gdriveFolderUrl: "https://drive.google.com/drive/folders/cyberjawara-2026",
      status: "active",
      accent: "#EF4444",
      inviteCode: "CTF-01",
    },
  ];

  const [LEAD, HACK, UX, RES] = TEAM_ROLES;
  const members: Member[] = [
    { competitionId: "c1", userId: "u1", role: "leader", teamRole: LEAD },
    { competitionId: "c1", userId: "u2", role: "member", teamRole: UX },
    { competitionId: "c1", userId: "u3", role: "member", teamRole: HACK },
    { competitionId: "c1", userId: "u4", role: "member", teamRole: RES },
    { competitionId: "c2", userId: "u2", role: "leader", teamRole: LEAD },
    { competitionId: "c2", userId: "u1", role: "member", teamRole: HACK },
    { competitionId: "c2", userId: "u5", role: "member", teamRole: HACK },
    { competitionId: "c2", userId: "u6", role: "member", teamRole: RES },
    { competitionId: "c3", userId: "u3", role: "leader", teamRole: LEAD },
    { competitionId: "c3", userId: "u1", role: "member", teamRole: HACK },
    { competitionId: "c3", userId: "u5", role: "member", teamRole: HACK },
  ];

  const milestones: Milestone[] = [
    { id: "m1a", competitionId: "c1", title: "Riset & Empati Pengguna", targetDate: at(-6, 23), orderIndex: 0 },
    { id: "m1b", competitionId: "c1", title: "Desain & Prototipe", targetDate: at(3, 23), orderIndex: 1 },
    { id: "m1c", competitionId: "c1", title: "Validasi & Pengumpulan", targetDate: at(6, 23, 59), orderIndex: 2 },
    { id: "m2a", competitionId: "c2", title: "Data & Model Dasar", targetDate: at(-3, 23), orderIndex: 0 },
    { id: "m2b", competitionId: "c2", title: "Integrasi & Demo", targetDate: at(10, 23), orderIndex: 1 },
    { id: "m2c", competitionId: "c2", title: "Pitching & Dokumentasi", targetDate: at(14, 12), orderIndex: 2 },
    { id: "m3a", competitionId: "c3", title: "Persiapan Lab Latihan", targetDate: at(-1, 23), orderIndex: 0 },
    { id: "m3b", competitionId: "c3", title: "Latihan Kategori Soal", targetDate: at(8, 23), orderIndex: 1 },
    { id: "m3c", competitionId: "c3", title: "Simulasi & Hari-H", targetDate: at(20, 20), orderIndex: 2 },
  ];

  const base = { alarmActive: true } as const;
  const done = (proof: string, completedDaysAgo: number) => ({
    isCompleted: true,
    completedAt: at(-completedDaysAgo, 15),
    proofUrl: proof,
    alarmActive: false,
  });
  const G = "https://drive.google.com/file/d/";
  const O = "https://binus-my.sharepoint.com/:f:/g/personal/";

  const raw: Omit<Task, "gcalEventId" | "outlookEventId">[] = [
    // --- Gemastik UX Design ---
    { id: "t101", competitionId: "c1", milestoneId: "m1a", assignedTo: "u2", title: "Wawancara 8 pelaku UMKM", description: "Rekam & transkripsi hasil wawancara pengguna.", dueDate: at(-8, 17), priority: "high", ...done(`${G}wawancara-umkm`, 8) },
    { id: "t102", competitionId: "c1", milestoneId: "m1a", assignedTo: "u3", title: "Analisis kompetitor aplikasi UMKM", description: "Benchmark 5 aplikasi sejenis.", dueDate: at(-7, 17), priority: "medium", ...done(`${G}analisis-kompetitor`, 7) },
    { id: "t103", competitionId: "c1", milestoneId: "m1a", assignedTo: "u4", title: "Persona & customer journey map", description: "Tiga persona utama beserta journey map.", dueDate: at(-6, 20), priority: "high", ...done(`${O}nadya/journey-map`, 6) },
    { id: "t104", competitionId: "c1", milestoneId: "m1b", assignedTo: "u3", title: "Wireframe lo-fi seluruh alur", description: "Wireframe 24 layar utama.", dueDate: at(-2, 18), priority: "medium", ...done(`${O}dimas/wireframe`, 2) },
    { id: "t105", competitionId: "c1", milestoneId: "m1b", assignedTo: "u1", title: "Finalisasi user flow & IA", description: "Kunci arsitektur informasi sebelum prototipe hi-fi. Alarm uji: tugas ini jatuh tempo beberapa jam lagi.", dueDate: inHours(3), priority: "critical", ...base, isCompleted: false },
    { id: "t106", competitionId: "c1", milestoneId: "m1b", assignedTo: "u4", title: "Design system & library komponen", description: "Token warna, tipografi, dan komponen inti di Figma.", dueDate: at(1, 18), priority: "medium", ...base, isCompleted: false },
    { id: "t107", competitionId: "c1", milestoneId: "m1b", assignedTo: "u1", title: "Prototipe hi-fi interaktif (Figma)", description: "Prototipe klik-tembus untuk semua skenario utama.", dueDate: at(2, 18), priority: "critical", ...base, isCompleted: false },
    { id: "t108", competitionId: "c1", milestoneId: "m1c", assignedTo: "u2", title: "Usability testing 5 partisipan", description: "Uji coba dengan skenario tugas dan SUS.", dueDate: at(4, 16), priority: "high", ...base, isCompleted: false },
    { id: "t109", competitionId: "c1", milestoneId: "m1c", assignedTo: "u2", title: "Naskah proposal PDF", description: "Naskah maksimal 15 halaman sesuai guidebook.", dueDate: at(5, 20), priority: "high", ...base, isCompleted: false },
    { id: "t110", competitionId: "c1", milestoneId: "m1c", assignedTo: "u3", title: "Video presentasi 3 menit", description: "Video demo dan narasi solusi.", dueDate: at(6, 12), priority: "critical", ...base, isCompleted: false },
    { id: "t111", competitionId: "c1", milestoneId: "m1c", assignedTo: "u1", title: "Unggah berkas final (ZIP)", description: "Unggah ke portal Gemastik sebelum 23:59.", dueDate: at(6, 20), priority: "critical", ...base, isCompleted: false },

    // --- Hackathon Nasional AI ---
    { id: "t201", competitionId: "c2", milestoneId: "m2a", assignedTo: "u5", title: "Pengumpulan dataset & EDA", description: "Dataset keluhan pasien (anonim) dan eksplorasi data.", dueDate: at(-6, 18), priority: "high", ...done(`${G}dataset-eda`, 6) },
    { id: "t202", competitionId: "c2", milestoneId: "m2a", assignedTo: "u6", title: "Model baseline klasifikasi triase", description: "Baseline IndoBERT dengan metrik F1.", dueDate: at(-3, 20), priority: "high", ...done(`${G}baseline-triase`, 3) },
    { id: "t203", competitionId: "c2", milestoneId: "m2b", assignedTo: "u5", title: "Fine-tuning model & evaluasi", description: "Tuning hyperparameter dan analisis error.", dueDate: at(7, 20), priority: "high", ...base, isCompleted: false },
    { id: "t204", competitionId: "c2", milestoneId: "m2b", assignedTo: "u1", title: "Deck pitch final (10 slide)", description: "Narasi masalah, solusi, demo, dan model bisnis.", dueDate: at(7, 10), priority: "critical", ...base, isCompleted: false },
    { id: "t205", competitionId: "c2", milestoneId: "m2b", assignedTo: "u6", title: "Deploy API demo & uji beban", description: "Deploy ke cloud dengan endpoint publik.", dueDate: at(9, 15), priority: "high", ...base, isCompleted: false },
    { id: "t206", competitionId: "c2", milestoneId: "m2c", assignedTo: "u1", title: "Dokumentasi arsitektur sistem", description: "Diagram arsitektur dan alur data.", dueDate: at(10, 18), priority: "medium", ...base, isCompleted: false },
    { id: "t207", competitionId: "c2", milestoneId: "m2c", assignedTo: "u2", title: "Video pitch 5 menit", description: "Rekam dan edit video pitch.", dueDate: at(11, 14), priority: "critical", ...base, isCompleted: false },

    // --- CyberJawara CTF ---
    { id: "t301", competitionId: "c3", milestoneId: "m3a", assignedTo: "u5", title: "Setup lab latihan (Docker)", description: "Lab lokal untuk soal web dan pwn.", dueDate: at(-2, 17), priority: "medium", ...done(`${O}fajar/lab-setup`, 2) },
    { id: "t302", competitionId: "c3", milestoneId: "m3b", assignedTo: "u1", title: "Latihan web exploitation (20 soal)", description: "Fokus SQLi, SSRF, dan deserialization.", dueDate: at(2, 10), priority: "medium", ...base, isCompleted: false },
    { id: "t303", competitionId: "c3", milestoneId: "m3b", assignedTo: "u3", title: "Latihan kriptografi", description: "RSA, ECC, dan serangan padding oracle.", dueDate: at(5, 19), priority: "medium", ...base, isCompleted: false },
    { id: "t304", competitionId: "c3", milestoneId: "m3b", assignedTo: "u5", title: "Latihan pwn & reverse engineering", description: "Buffer overflow dan ROP dasar.", dueDate: at(7, 19), priority: "medium", ...base, isCompleted: false },
    { id: "t305", competitionId: "c3", milestoneId: "m3b", assignedTo: "u1", title: "Template writeup & cheatsheet", description: "Template writeup bersama.", dueDate: at(9, 17), priority: "low", ...base, isCompleted: false },
    { id: "t306", competitionId: "c3", milestoneId: "m3c", assignedTo: "u3", title: "Simulasi CTF 6 jam", description: "Simulasi penuh dengan soal tahun lalu.", dueDate: at(17, 9), priority: "high", ...base, isCompleted: false },
  ];
  const tasks: Task[] = raw.map((t) => ({
    ...t,
    gcalEventId: `gcal_${t.id}`,
    outlookEventId: users.find((u) => u.id === t.assignedTo)?.emailMicrosoft ? `outlook_${t.id}` : undefined,
  }));

  const resources: Resource[] = [
    { id: "r1", competitionId: "c1", kind: "guidebook", title: "Guidebook Gemastik UX 2026.pdf", provider: "gdrive", url: `${G}guidebook-gemastik`, meta: "PDF · 2,4 MB" },
    { id: "r2", competitionId: "c1", kind: "diagram", title: "User Flow & IA.fig", provider: "onedrive", url: `${O}raka/userflow`, meta: "Figma · 6,1 MB" },
    { id: "r3", competitionId: "c1", kind: "deck", title: "Deck Presentasi Draft.pptx", provider: "onedrive", url: `${O}raka/deck-draft`, meta: "PPTX · 12 MB" },
    { id: "r4", competitionId: "c1", kind: "zip", title: "Submission_Final.zip", provider: "gdrive", url: `${G}submission-final`, meta: "Belum diunggah" },
    { id: "r5", competitionId: "c2", kind: "guidebook", title: "Panduan Hackathon Nasional AI.pdf", provider: "gdrive", url: `${G}guidebook-hackathon`, meta: "PDF · 1,8 MB" },
    { id: "r6", competitionId: "c2", kind: "diagram", title: "Arsitektur Sistem v2.drawio", provider: "onedrive", url: `${O}salsabila/arsitektur`, meta: "Diagram · 0,4 MB" },
    { id: "r7", competitionId: "c2", kind: "deck", title: "Pitch Deck v1.pptx", provider: "onedrive", url: `${O}salsabila/pitch-v1`, meta: "PPTX · 9 MB" },
    { id: "r8", competitionId: "c3", kind: "guidebook", title: "Rulebook CyberJawara.pdf", provider: "gdrive", url: `${G}rulebook-cj`, meta: "PDF · 0,9 MB" },
    { id: "r9", competitionId: "c3", kind: "other", title: "Cheatsheet Web Exploitation.md", provider: "gdrive", url: `${G}cheatsheet-web`, meta: "Dokumen · 0,1 MB" },
  ];

  const stamp = new Date(now).toISOString();
  const note = (id: string, c: string, kind: WhiteboardElement['kind'], content: string, x: number, y: number, votes: string[], by: string): WhiteboardElement => ({
    id, competitionId: c, type: 'sticky', kind, content, color: NOTE_COLORS[kind!], x, y, votes, createdBy: by, updatedAt: stamp,
  });
  const stroke = (id: string, c: string, points: [number, number][], color: string): WhiteboardElement => ({
    id, competitionId: c, type: 'drawing', content: '', color, x: 0, y: 0, points, votes: [], createdBy: 'u1', updatedAt: stamp,
  });
  const whiteboard: WhiteboardElement[] = [
    note('w1', 'c2', 'ide', 'Asisten triase WhatsApp untuk puskesmas: pasien kirim keluhan, AI beri tingkat urgensi.', 60, 50, ['u2', 'u5', 'u6'], 'u2'),
    note('w2', 'c2', 'fitur', 'Mode suara berbahasa daerah (Jawa & Sunda) agar lansia mudah memakai.', 330, 40, ['u1', 'u6'], 'u6'),
    note('w3', 'c2', 'riset', 'Pelajari pedoman triase Kemenkes dan data kunjungan puskesmas 2025.', 600, 70, ['u5'], 'u5'),
    note('w4', 'c2', 'kendala', 'Dataset keluhan pasien terbatas — perlu data sintetis yang divalidasi.', 120, 290, ['u2'], 'u1'),
    note('w5', 'c2', 'fitur', 'Dashboard bidan: antrean pasien berdasarkan urgensi secara real-time.', 400, 280, ['u1', 'u2', 'u5', 'u6'], 'u1'),
    stroke('w6', 'c2', [[250, 130], [290, 128], [318, 100], [340, 80]], '#2563EB'),
    note('w7', 'c1', 'ide', 'Mode sederhana untuk pemilik warung: satu layar, tombol besar, ikon jelas.', 60, 50, ['u3', 'u4'], 'u4'),
    note('w8', 'c1', 'fitur', 'Pencatatan kas lewat suara ("jual 3 nasi goreng").', 330, 60, ['u2'], 'u2'),
    note('w9', 'c1', 'kendala', 'Banyak pengguna UMKM belum nyaman dengan istilah akuntansi.', 200, 280, ['u1', 'u3'], 'u3'),
  ];

  return { users, competitions, members, milestones, tasks, resources, reports: [], whiteboard, notices: [], session: null };
}
