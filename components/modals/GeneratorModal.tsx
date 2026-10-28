"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { generatePlan, type GeneratedPlan } from "@/lib/generator";
import { fmtDate, PRIORITY_LABEL } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Avatar, Badge, Modal, PRIORITY_TONE } from "../ui";

const CATEGORIES = ["UI/UX", "Hackathon", "CTF", "Business Case"];

function defaultDeadline(now: number) {
  const d = new Date(now + 21 * 86400_000);
  d.setHours(23, 59, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function GeneratorModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { data, now, me, dispatch } = useStore();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [theme, setTheme] = useState("");
  const [deadline, setDeadline] = useState(() => defaultDeadline(now));
  const [advisorName, setAdvisorName] = useState("");
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [team, setTeam] = useState<string[]>([me]);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);

  useEffect(() => {
    if (open) setPlan(null);
  }, [open]);

  const valid = title.trim() && deadline && advisorEmail.includes("@") && team.length >= 1 && team.length <= 5;

  function generate() {
    setBusy(true);
    setTimeout(() => {
      const end = new Date(`${deadline}T23:59:00`).toISOString();
      setPlan(
        generatePlan(
          {
            title: title.trim(),
            category,
            theme: theme.trim(),
            deadline: end,
            advisorName: advisorName.trim() || "Pembina",
            advisorEmail: advisorEmail.trim(),
            leaderId: me,
            memberIds: team,
            now,
          },
          data.competitions.length,
        ),
      );
      setBusy(false);
    }, 900);
  }

  function save() {
    if (!plan) return;
    dispatch({
      type: "addPlan",
      ...plan,
      members: team.map((id) => ({ competitionId: plan.competition.id, userId: id, role: id === me ? "leader" : "member" })),
    });
    onCreated(plan.competition.id);
    setTitle("");
    setTheme("");
    setPlan(null);
    onClose();
  }

  const toggle = (id: string) =>
    setTeam((t) => (id === me ? t : t.includes(id) ? t.filter((x) => x !== id) : t.length < 5 ? [...t, id] : t));

  return (
    <Modal open={open} onClose={onClose} title="Generator Jadwal AI" wide>
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="g-title">Nama kompetisi</label>
            <input id="g-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Gemastik Data Mining" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="g-cat">Kategori</label>
              <select id="g-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="g-dl">Deadline final</label>
              <input id="g-dl" type="date" className="field" value={deadline} min={new Date(now + 86400_000).toISOString().slice(0, 10)} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="g-theme">Tema</label>
            <input id="g-theme" className="field" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="mis. Pemanfaatan AI untuk pendidikan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="g-an">Nama Pembina</label>
              <input id="g-an" className="field" value={advisorName} onChange={(e) => setAdvisorName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="g-ae">Email Pembina</label>
              <input id="g-ae" type="email" className="field" value={advisorEmail} onChange={(e) => setAdvisorEmail(e.target.value)} placeholder="nama@binus.ac.id" />
            </div>
          </div>
          <div>
            <span className="label">Anggota tim (3–5 orang, Anda sebagai Ketua)</span>
            <div className="flex flex-wrap gap-1.5">
              {data.users.map((u) => {
                const on = team.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition ${on ? "border-active bg-active/15" : "border-white/10 hover:bg-white/10"}`}
                  >
                    <Avatar user={u} size={22} /> {u.fullName.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn-primary w-full" onClick={generate} disabled={!valid || busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Hasilkan Timeline
          </button>
        </div>

        <div className="min-h-[220px] rounded-xl border border-white/10 bg-white/[0.03] p-3">
          {!plan ? (
            <div className="grid h-full place-items-center p-4 text-center text-sm text-white/40">
              <div>
                <Sparkles className="mx-auto mb-2 text-active" />
                Isi detail kompetisi, lalu klik &ldquo;Hasilkan Timeline&rdquo; untuk membuat milestone mingguan dan tugas otomatis.
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="max-h-[46vh] flex-1 space-y-3 overflow-y-auto pr-1">
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
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
              <button className="btn-safe mt-3" onClick={save}>
                Simpan &amp; Buat Ruang Kompetisi
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
