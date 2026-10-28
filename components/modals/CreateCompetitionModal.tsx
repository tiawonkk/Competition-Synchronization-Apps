"use client";

import { Check, FileUp, KeyRound, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { defaultStageSpecs, extractGuidebookTasks, generatePlan, type GeneratedPlan } from "@/lib/generator";
import type { GuidebookDraft } from "@/lib/types";
import { analyzeGuidebook } from "@/lib/guidebook-client";
import { fmtDate, isValidProofUrl, makeInviteCode, PRIORITY_LABEL } from "@/lib/logic";
import { isEmail } from "@/lib/passwords";
import { TEAM_ROLES } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { Avatar, Badge, Modal, PRIORITY_TONE } from "../ui";

const CATEGORIES = ["Hackathon", "UI/UX Design", "CTF Cyber Security", "Business Case", "Data Science"];

function defaultDeadline(now: number) {
  const d = new Date(now + 21 * 86400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const localDay = (iso: string | number) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

interface Row {
  name: string;
  date: string; // YYYY-MM-DD
}

export default function CreateCompetitionModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { data, now, me, dispatch } = useStore();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [theme, setTheme] = useState("");
  const [deadline, setDeadline] = useState(() => defaultDeadline(now));
  const [advisorName, setAdvisorName] = useState("");
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [onedrive, setOnedrive] = useState("");
  const [gdrive, setGdrive] = useState("");
  const [teamRole, setTeamRole] = useState<string>(TEAM_ROLES[0]);
  const [guidebook, setGuidebook] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [touched, setTouched] = useState(false);
  const [draft, setDraft] = useState<GuidebookDraft | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState<{ label: string; pct: number | null } | null>(null);
  /** Fields the AI filled from the guidebook; they get a green ring until the user edits them. */
  const [filled, setFilled] = useState<string[]>([]);

  const rowsFor = (dl: string): Row[] => defaultStageSpecs(now, new Date(`${dl}T23:59:00`).getTime()).map((s) => ({ name: s.name, date: localDay(s.deadline) }));
  const [rows, setRows] = useState<Row[]>(() => rowsFor(defaultDeadline(now)));
  const [rowsTouched, setRowsTouched] = useState(false);
  // The last round always ends on the main deadline, so its date is derived rather than edited.
  const effRows = rows.map((r, i) => (i === rows.length - 1 ? { ...r, date: deadline } : r));

  function changeDeadline(v: string) {
    setDeadline(v);
    setPlan(null);
    if (!rowsTouched && v) setRows(rowsFor(v));
  }
  function editRow(i: number, patch: Partial<Row>) {
    setRows((p) => p.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    setRowsTouched(true);
    setPlan(null);
  }
  function addRow() {
    setRows((p) => {
      const prev = p.length > 1 ? effRows[p.length - 2].date : localDay(now + 86400_000);
      const mid = localDay((new Date(`${prev}T12:00:00`).getTime() + new Date(`${deadline}T12:00:00`).getTime()) / 2);
      return [...p.slice(0, -1), { name: "Babak baru", date: mid }, p[p.length - 1]];
    });
    setRowsTouched(true);
    setPlan(null);
  }
  function removeRow(i: number) {
    setRows((p) => (p.length > 1 ? p.filter((_, k) => k !== i) : p));
    setRowsTouched(true);
    setPlan(null);
  }

  useEffect(() => {
    if (open) {
      setRows(rowsFor(deadline));
      setRowsTouched(false);
      setProgress(null);
      setFilled([]);
      setDraft(null);
      setFileName("");
      setReadError(null);
      setPlan(null);
      setTouched(false);
    }
  }, [open]);

  function stageError(): string | false {
    if (effRows.some((r) => !r.name.trim())) return "Nama setiap babak wajib diisi.";
    let prev = now;
    for (let i = 0; i < effRows.length - 1; i++) {
      const t = new Date(`${effRows[i].date}T23:59:00`).getTime();
      if (!Number.isFinite(t) || t <= prev) return "Tenggat babak harus berurutan dan di masa depan.";
      prev = t;
    }
    return new Date(`${deadline}T23:59:00`).getTime() > prev ? false : "Tenggat babak terakhir harus setelah babak sebelumnya.";
  }

  const taken = useMemo(() => data.competitions.map((c) => c.inviteCode), [data.competitions]);
  const errors = {
    title: !title.trim() && "Nama lomba wajib diisi.",
    deadline: (!deadline || new Date(`${deadline}T23:59:00`).getTime() <= now) && "Pilih tanggal di masa depan.",
    stages: stageError(),
    advisorEmail: advisorEmail.trim() && !isEmail(advisorEmail.trim()) && "Format email belum valid.",
    onedrive: onedrive.trim() && !isValidProofUrl(onedrive) && "Gunakan tautan https dari OneDrive, SharePoint, atau domain Binus.",
    gdrive: gdrive.trim() && !isValidProofUrl(gdrive) && "Gunakan tautan https dari Google Drive.",
  };
  const valid = !Object.values(errors).some(Boolean);

  function build(d: GuidebookDraft | null = draft, dl = deadline, name = title, th = theme, rs: Row[] = effRows, cat = category): GeneratedPlan {
    const input = {
        title: name.trim(),
        category: cat,
        theme: th.trim(),
        deadline: new Date(`${dl}T23:59:00`).toISOString(),
        advisorName: advisorName.trim(),
        advisorEmail: advisorEmail.trim(),
        leaderId: me,
        memberIds: [me],
        now,
        inviteCode: makeInviteCode(title, taken),
        onedriveFolderUrl: onedrive.trim(),
        gdriveFolderUrl: gdrive.trim(),
        extraTasks: extractGuidebookTasks(guidebook),
        stages: rs.map((r) => ({ name: r.name.trim(), deadline: new Date(`${r.date}T23:59:00`).toISOString() })),
      };
    return generatePlan(input, data.competitions.length, d);
  }

  /** Reads the PDF (or pasted text) with AI, fills empty fields from the answer and previews the resulting plan. */
  async function readGuidebook(file?: File) {
    setReadError(null);
    setReading(true);
    const { draft: d, error, note } = await analyzeGuidebook({ file, text: guidebook, onProgress: setProgress });
    setReading(false);
    setProgress(null);
    if (!d) return setReadError(error ?? "Gagal membaca guidebook.");

    const name = title.trim() || d.title || "";
    const th = theme.trim() || d.theme || "";
    const dated = (v: string | null | undefined) => (v && new Date(`${v}T23:59:00`).getTime() > now ? v : null);
    const rounds = d.stages.filter((st) => st.isRound && dated(st.date)).sort((x, y) => x.date!.localeCompare(y.date!));
    const lastRound = rounds.length ? rounds[rounds.length - 1].date! : null;
    const future = [dated(d.deadline), lastRound].filter((x): x is string => !!x).sort().pop() ?? deadline;
    // Rounds named by the guidebook replace the default Penyisihan / Semifinal / Grand Final rows.
    const nextRows = rounds.length ? rounds.map((r) => ({ name: r.name, date: r.date! })) : effRows;
    if (rounds.length) {
      setRows(nextRows);
      setRowsTouched(true);
    }
    setDraft(d);
    const marks: string[] = [];
    if (!title.trim() && d.title) {
      setTitle(d.title);
      marks.push("title");
    }
    if (!theme.trim() && d.theme) {
      setTheme(d.theme);
      marks.push("theme");
    }
    if (d.category && CATEGORIES.includes(d.category)) {
      setCategory(d.category);
      marks.push("category");
    }
    if (future !== deadline) marks.push("deadline");
    if (rounds.length) marks.push("stages");
    setFilled(marks);
    setDeadline(future);
    if (!name) return setReadError("Guidebook terbaca, tapi nama lomba tidak ditemukan. Isi nama lomba lalu klik Auto-Generate.");
    setPlan(build(d, future, name, th, nextRows.map((r, i) => (i === nextRows.length - 1 ? { ...r, date: future } : r)), d.category && CATEGORIES.includes(d.category) ? d.category : category));
    if (note) setReadError(note);
  }

  function dropTask(id: string) {
    setPlan((p) => (p ? { ...p, tasks: p.tasks.filter((t) => t.id !== id) } : p));
  }

  function generate() {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    setTimeout(() => {
      setPlan(build());
      setBusy(false);
    }, 900);
  }

  function create() {
    setTouched(true);
    if (!valid) return;
    const p = plan ?? build();
    dispatch({
      type: "addPlan",
      ...p,
      members: [{ competitionId: p.competition.id, userId: me, role: "leader", teamRole }],
    });
    onCreated(p.competition.id);
    setTitle("");
    setTheme("");
    setGuidebook("");
    setDraft(null);
    setFilled([]);
    setFileName("");
    setReadError(null);
    setOnedrive("");
    setGdrive("");
    setAdvisorName("");
    setAdvisorEmail("");
    setPlan(null);
    onClose();
  }

  const err = (k: keyof typeof errors) => touched && errors[k] && <p className="mt-1 text-xs text-danger">{errors[k]}</p>;


  const auto = (key: string) =>
    filled.includes(key) ? <span className="ml-1.5 rounded-full bg-safe/15 px-1.5 py-0.5 text-[10px] font-semibold text-safe">✨ Terisi otomatis dari guidebook</span> : null;
  const ring = (key: string) => (filled.includes(key) ? " !ring-2 !ring-safe/40" : "");
  const unfill = (key: string) => setFilled((p) => p.filter((k) => k !== key));

  const footer = (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button className="btn-ghost" onClick={generate} disabled={busy || reading}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="text-active" />} Auto-Generate Timeline &amp; Tugas via AI
      </button>
      <button className="btn-primary" onClick={create} disabled={busy || reading}>
        <Check size={16} /> Buat Lomba
      </button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Buat Lomba Baru" wide footer={footer}>
      <div className="space-y-5 p-5">
        {/* Guidebook first: one upload fills the whole form. */}
        <section className="rounded-2xl border border-active/25 bg-active/[0.06] p-4" aria-labelledby="gb-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="gb-h" className="text-sm font-bold">✨ Isi form otomatis dari Guidebook</h3>
            <span className="text-[11px] text-white/45">PDF, TXT, atau MD · teks dikirim ke Google Gemini, jangan unggah dokumen rahasia</span>
          </div>
          <label className={`mt-3 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-active/30 px-4 py-4 transition hover:bg-active/[0.06] ${reading ? "pointer-events-none opacity-70" : ""}`}>
            {reading ? <Loader2 size={20} className="animate-spin text-active" /> : <FileUp size={20} className="text-active" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{fileName || "Pilih atau seret berkas guidebook ke sini"}</span>
              <span className="block text-xs text-white/50">Nama lomba, kategori, tema, deadline, babak, rubrik, dan tugas akan terisi sendiri.</span>
            </span>
            <input
              type="file"
              accept="application/pdf,.txt,.md,text/plain"
              className="sr-only"
              disabled={reading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setFileName(file.name);
                readGuidebook(file);
              }}
            />
          </label>
          {progress && (
            <div className="mt-3" role="status" aria-live="polite">
              <div className="mb-1 flex justify-between text-xs text-white/60">
                <span>{progress.label.startsWith("Membaca halaman") ? `📄 ${progress.label}` : progress.label.startsWith("Menganalisis") ? `✨ ${progress.label}` : progress.label}</span>
                {progress.pct !== null && <span className="tabular-nums">{progress.pct}%</span>}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full bg-active transition-all ${progress.pct === null ? "w-1/3 animate-pulse" : ""}`} style={progress.pct === null ? undefined : { width: `${progress.pct}%` }} />
              </div>
            </div>
          )}
          {readError && (
            <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
              {readError}
            </p>
          )}
          {draft && !readError && (
            <p role="status" className="mt-3 rounded-xl bg-safe/10 px-3 py-2 text-xs text-safe">
              Terbaca: {draft.stages.length} tahapan, {draft.tasks.length} tugas, {draft.rubric?.length ?? 0} kriteria rubrik, dan {draft.rules?.length ?? 0} aturan. Periksa isi form dan pratinjau, lalu klik Buat Lomba.
            </p>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-white/70">Atau tempel teks guidebook{guidebook ? ` (${guidebook.length.toLocaleString("id-ID")} karakter)` : ""}</summary>
            <textarea
              id="c-gb"
              rows={3}
              className="field mt-2 max-h-32 resize-none overflow-y-auto"
              value={guidebook}
              onChange={(e) => setGuidebook(e.target.value)}
              placeholder={"mis.\n- Proposal maksimal 15 halaman\n- Wajib unggah video demo 3 menit"}
              aria-label="Teks guidebook"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => readGuidebook()} disabled={reading || guidebook.trim().length < 40}>
                <Sparkles size={14} className="text-active" /> ⚡ Ekstrak dengan AI
              </button>
              <span className="text-[11px] text-white/45">Tanpa AI, poin-poin dari teks tempel tetap menjadi tugas di milestone pertama.</span>
            </div>
          </details>
        </section>

        <div className="grid gap-5 md:grid-cols-2 md:items-start">
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="c-title">Nama lomba{auto("title")}</label>
              <input
                id="c-title"
                className={`field${ring("title")}`}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  unfill("title");
                }}
                placeholder="mis. Gemastik Data Mining"
              />
              {err("title")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="c-cat">Kategori{auto("category")}</label>
                <select
                  id="c-cat"
                  className={`field${ring("category")}`}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    unfill("category");
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="c-dl">Deadline final{auto("deadline")}</label>
                <input
                  id="c-dl"
                  type="date"
                  className={`field${ring("deadline")}`}
                  value={deadline}
                  min={new Date(now + 86400_000).toISOString().slice(0, 10)}
                  onChange={(e) => {
                    changeDeadline(e.target.value);
                    unfill("deadline");
                  }}
                />
                {err("deadline")}
              </div>
            </div>
            <div>
              <span className="label">Babak lomba{auto("stages")}</span>
              <ol className={`space-y-1.5${filled.includes("stages") ? " rounded-xl p-1.5 ring-2 ring-safe/40" : ""}`}>
                {effRows.map((r, i) => {
                  const last = i === effRows.length - 1;
                  return (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-active/15 text-xs font-bold text-active">{i + 1}</span>
                      <input className="field !py-1.5" value={r.name} onChange={(e) => editRow(i, { name: e.target.value })} aria-label={`Nama babak ${i + 1}`} />
                      <input
                        type="date"
                        className="field !w-40 shrink-0 !py-1.5"
                        value={r.date}
                        disabled={last}
                        title={last ? "Mengikuti deadline final" : undefined}
                        onChange={(e) => editRow(i, { date: e.target.value })}
                        aria-label={`Tenggat babak ${i + 1}`}
                      />
                      <button type="button" onClick={() => removeRow(i)} disabled={effRows.length === 1} className="rounded-lg p-1.5 text-white/40 hover:bg-danger/15 hover:text-danger disabled:opacity-30" aria-label={`Hapus babak ${i + 1}`}>
                        <Trash2 size={15} />
                      </button>
                    </li>
                  );
                })}
              </ol>
              <button type="button" className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-active hover:underline" onClick={addRow}>
                <Plus size={13} /> Tambah babak (mis. Pra-Kualifikasi, Bootcamp)
              </button>
              {err("stages")}
              <p className="mt-1 text-[11px] text-white/40">Hanya babak pertama yang dijadwalkan sekarang. Babak berikutnya terbuka saat tim dinyatakan lolos.</p>
            </div>
            <div>
              <label className="label" htmlFor="c-theme">Tema (opsional){auto("theme")}</label>
              <input
                id="c-theme"
                className={`field${ring("theme")}`}
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  unfill("theme");
                }}
                placeholder="Opsional, bisa diisi nanti"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="c-an">Nama Pembina (opsional)</label>
                <input id="c-an" className="field" value={advisorName} onChange={(e) => setAdvisorName(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="c-ae">Email Pembina (opsional)</label>
                <input id="c-ae" type="email" className="field" value={advisorEmail} onChange={(e) => setAdvisorEmail(e.target.value)} placeholder="nama@binus.ac.id" />
                {err("advisorEmail")}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="c-od">Folder OneDrive Pro Binus (opsional)</label>
              <input id="c-od" className="field" value={onedrive} onChange={(e) => setOnedrive(e.target.value)} placeholder="https://binus-my.sharepoint.com/…" />
              {err("onedrive")}
            </div>
            <div>
              <label className="label" htmlFor="c-gd">Folder Google Drive (opsional)</label>
              <input id="c-gd" className="field" value={gdrive} onChange={(e) => setGdrive(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
              {err("gdrive")}
            </div>
            <div>
              <label className="label" htmlFor="c-role">Peran Anda di tim</label>
              <select id="c-role" className="field" value={teamRole} onChange={(e) => setTeamRole(e.target.value)}>
                {TEAM_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview column: sticky, never stretched to the height of the form. */}
          <aside className="space-y-3 md:sticky md:top-0" aria-label="Pratinjau">
            {draft && (
              <details open className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                <summary className="cursor-pointer text-sm font-bold">📋 Pratinjau hasil ekstraksi guidebook</summary>
                <div className="mt-3 space-y-3 text-xs">
                  {draft.summary && <p className="text-white/70">{draft.summary}</p>}
                  <div>
                    <div className="mb-1 font-semibold text-white/60">Tahapan terdeteksi</div>
                    <ul className="space-y-1">
                      {(plan?.stages ?? []).map((s, i) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5">
                          <span className="min-w-0 truncate">
                            Babak {i + 1}: {s.name}
                          </span>
                          <span className="shrink-0 text-white/50">
                            {fmtDate(s.deadline)} · {i === 0 ? plan!.tasks.length : (s.plan?.tasks.length ?? 0)} tugas
                          </span>
                        </li>
                      ))}
                      {!plan && <li className="text-white/40">Isi nama lomba untuk melihat jadwal babak.</li>}
                    </ul>
                  </div>
                  {!!draft.rubric?.length && (
                    <div>
                      <div className="mb-1 font-semibold text-white/60">Bobot penilaian juri</div>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.rubric.map((r) => (
                          <span key={r.criterion} className="rounded-full bg-active/10 px-2.5 py-1 font-medium text-active">
                            {r.criterion}
                            {r.weight && ` · ${r.weight}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!draft.deliverables?.length && (
                    <div>
                      <div className="mb-1 font-semibold text-white/60">Deliverables wajib</div>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.deliverables.map((d) => (
                          <Badge key={d} tone="warn">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!draft.rules?.length && (
                    <details>
                      <summary className="cursor-pointer font-semibold text-white/60">Aturan penting ({draft.rules.length})</summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-white/70">
                        {draft.rules.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </details>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              {!plan ? (
                <div className="p-3 text-center text-sm text-white/45">
                  <Sparkles className="mx-auto mb-2 text-active" />
                  Unggah guidebook di atas, atau klik Auto-Generate di bawah, untuk melihat pratinjau milestone dan tugas. Kode undangan dibuat otomatis saat lomba disimpan.
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-safe/10 px-3 py-2 text-xs text-safe">
                    <KeyRound size={14} /> Kode undangan: <strong className="tracking-wider">{plan.competition.inviteCode}</strong>
                  </div>
                  <p className="mb-2 text-xs text-white/55">
                    Babak: {plan.stages.map((s) => s.name).join(" → ")}. Yang dijadwalkan sekarang hanya <strong>{plan.stages[0]?.name}</strong>.
                  </p>
                  <div className="max-h-[44vh] space-y-3 overflow-y-auto pr-1">
                    {plan.milestones.map((m) => (
                      <div key={m.id}>
                        <div className="text-xs font-semibold">
                          {m.title} <span className="font-normal text-white/40">· target {fmtDate(m.targetDate)}</span>
                        </div>
                        <ul className="mt-1 space-y-1">
                          {plan.tasks
                            .filter((t) => t.milestoneId === m.id)
                            .map((t) => (
                              <li key={t.id} className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2 py-1.5 text-xs">
                                <Avatar user={data.users.find((u) => u.id === t.assignedTo)!} size={18} />
                                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                                <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                                <span className="text-[10px] text-white/40">{fmtDate(t.dueDate)}</span>
                                <button type="button" onClick={() => dropTask(t.id)} className="rounded p-0.5 text-white/40 hover:bg-danger/15 hover:text-danger" aria-label={`Hapus tugas ${t.title}`}>
                                  <X size={13} />
                                </button>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-white/40">Semua tugas awal ditugaskan ke Anda. Setelah anggota bergabung, Ketua dapat membagi ulang lewat menu penanggung jawab.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </Modal>
  );
}
