"use client";

import { Copy, GraduationCap, Link2, Mail, Pencil, Send, Share2, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { fullOps } from "@/lib/cloud-ops";
import { buildJoinLink } from "@/lib/join-link";
import { isEmail } from "@/lib/passwords";
import { TEAM_ROLES } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { Avatar, Modal } from "./ui";

const MAX_TEAM = 5;

/** "Tim & Pembina": member cards with editable roles and calendar badges, plus the advisor card. */
export default function TeamPanel({
  competitionId,
  assignee,
  onAssignee,
  onReport,
}: {
  competitionId: string;
  assignee: string;
  onAssignee: (id: string) => void;
  onReport: () => void;
}) {
  const { data, me, dispatch, cloud } = useStore();
  const comp = data.competitions.find((c) => c.id === competitionId)!;
  const team = data.members.filter((m) => m.competitionId === competitionId && m.role !== "advisor");
  const isLeader = team.some((m) => m.userId === me && m.role === "leader");
  const finished = comp.status === "archived";
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [invite, setInvite] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const full = team.length >= MAX_TEAM;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(comp.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the code stays visible in the invite dialog */
    }
  }

  /** With cloud sync the code alone is enough; without it the competition itself travels inside the link. */
  async function copyLink() {
    const online = cloud.mode === "supabase" || cloud.mode === "memory";
    try {
      const link = await buildJoinLink(window.location.origin, comp.inviteCode, online ? undefined : fullOps(data, competitionId));
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2200);
    } catch {
      /* clipboard blocked: the code and the invite message are still available */
    }
  }

  const cloudLabel =
    cloud.mode === "off"
      ? cloud.problem === "tables_missing"
        ? "☁️ Cloud belum siap · jalankan schema_cloud_sync.sql di Supabase"
        : cloud.problem
          ? "☁️ Cloud bermasalah · periksa kunci Supabase di Vercel"
          : "☁️ Cloud belum aktif · data hanya di browser ini"
      : cloud.mode === "checking"
        ? "☁️ Memeriksa cloud…"
        : cloud.status === "syncing"
          ? "☁️ Menyimpan…"
          : cloud.status === "error"
            ? "☁️ Gagal sinkron, mencoba lagi"
            : "☁️ Tersinkron ke cloud";

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="team-h">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 id="team-h" className="text-sm font-semibold">Tim &amp; Pembina</h2>
          <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold text-white/70">
            {team.length}/{MAX_TEAM} Anggota
          </span>
          <span className={`text-[11px] ${cloud.mode === "off" ? "text-warn" : cloud.status === "error" ? "text-danger" : "text-white/45"}`} role="status" title={cloud.detail}>
            {cloudLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs">
            <span className="text-white/50">Kode Invite:</span>
            <strong className="font-mono tracking-wider">{comp.inviteCode}</strong>
          </span>
          <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={copyCode}>
            <Link2 size={14} /> {copied ? "Tersalin!" : "📋 Salin Kode"}
          </button>
          <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={copyLink}>
            <Share2 size={14} /> {linkCopied ? "Link tersalin!" : "🔗 Salin Link Undangan"}
          </button>
          {!finished && (
            <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => setInvite(true)} disabled={full} title={full ? `Tim penuh (maksimal ${MAX_TEAM} anggota)` : undefined}>
              <UserPlus size={14} /> Undang Anggota
            </button>
          )}
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {team.map((m) => {
          const u = data.users.find((x) => x.id === m.userId) ?? {
            id: m.userId,
            fullName: m.userId === me ? "Saya" : m.teamRole ? `Anggota (${m.teamRole})` : "Anggota Tim",
            color: "#6366F1",
          };
          const active = assignee === u.id;
          const canEditRole = !finished && (isLeader || m.userId === me);
          const roles = m.teamRole && !(TEAM_ROLES as readonly string[]).includes(m.teamRole) ? [m.teamRole, ...TEAM_ROLES] : TEAM_ROLES;
          return (
            <li key={m.userId} className={`rounded-2xl border p-3 transition ${active ? "border-active bg-active/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex items-start gap-2">
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => onAssignee(active ? "all" : u.id)}
                  aria-pressed={active}
                  title="Tampilkan hanya tugas anggota ini"
                >
                  <Avatar user={u} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{u.fullName}</span>
                    {m.role === "leader" ? (
                      <span className="text-[11px] font-semibold text-warn">★ Lead</span>
                    ) : (
                      <span className="text-[11px] text-white/45">Anggota</span>
                    )}
                  </span>
                </button>
                {isLeader && m.role !== "leader" && !finished && (
                  <button
                    className="rounded-lg p-1.5 text-white/35 hover:bg-danger/15 hover:text-danger"
                    onClick={() => {
                      if (window.confirm(`Keluarkan ${u.fullName} dari tim? Tugas terbukanya dialihkan ke Ketua.`)) dispatch({ type: "removeMember", competitionId, userId: u.id });
                    }}
                    aria-label={`Keluarkan ${u.fullName}`}
                    title="Keluarkan dari tim"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <select
                className="field mt-2.5 !py-1.5 text-xs"
                value={m.teamRole ?? ""}
                disabled={!canEditRole}
                onChange={(e) => dispatch({ type: "setTeamRole", competitionId, userId: u.id, teamRole: e.target.value })}
                aria-label={`Peran ${u.fullName}`}
              >
                {!m.teamRole && <option value="">Pilih peran…</option>}
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                {u.emailMicrosoft && (
                  <span className="rounded-md bg-active/15 px-1.5 py-0.5 text-active" title={u.emailMicrosoft}>
                    M365 ✓
                  </span>
                )}
                {u.emailGoogle && (
                  <span className="rounded-md bg-safe/15 px-1.5 py-0.5 text-safe" title={u.emailGoogle}>
                    GCal ✓
                  </span>
                )}
                {!u.emailMicrosoft && !u.emailGoogle && <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-white/45">Kalender belum terhubung</span>}
              </div>
            </li>
          );
        })}

        <li>
          {comp.advisorEmail || comp.advisorName ? (
            <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-active/15 text-active">
                  <GraduationCap size={18} />
                </span>
                {isLeader && !finished && (
                  <button className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white" onClick={() => setAdvisorOpen(true)} aria-label="Ubah data Pembina">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
              <div className="mt-2 min-w-0">
                <div className="truncate text-sm font-semibold">{comp.advisorName || "Dosen Pembina"}</div>
                <div className="truncate text-[11px] text-white/50" title={comp.advisorEmail}>
                  {comp.advisorEmail || "Email belum diisi"}
                </div>
              </div>
              <button className="btn-ghost mt-auto !justify-center !py-1.5 text-xs" onClick={onReport} style={{ marginTop: "0.75rem" }}>
                <Send size={13} /> Kirim Laporan
              </button>
            </div>
          ) : isLeader && !finished ? (
            <button
              className="grid h-full min-h-[8rem] w-full place-items-center rounded-2xl border border-dashed border-white/20 p-3 text-center transition hover:border-active hover:bg-active/[0.06]"
              onClick={() => setAdvisorOpen(true)}
            >
              <span>
                <span className="mx-auto mb-1 grid h-9 w-9 place-items-center rounded-full bg-active/15 text-active">
                  <GraduationCap size={18} />
                </span>
                <span className="block text-sm font-semibold text-active">+ Atur Dosen Pembina</span>
                <span className="block text-[11px] text-white/45">Nama dan email untuk laporan</span>
              </span>
            </button>
          ) : (
            <div className="grid h-full min-h-[8rem] place-items-center rounded-2xl border border-dashed border-white/15 p-3 text-center text-xs text-white/45">
              <span>
                <GraduationCap size={18} className="mx-auto mb-1" />
                Pembina belum diisi. Minta Ketua mengaturnya.
              </span>
            </div>
          )}
        </li>
      </ul>

      <InviteModal open={invite} onClose={() => setInvite(false)} competitionId={competitionId} />
      <AdvisorModal open={advisorOpen} onClose={() => setAdvisorOpen(false)} competitionId={competitionId} />
    </section>
  );
}

/** Builds a ready-to-send invitation. Nothing is sent from here: the user copies it or opens it in their own mail app. */
function InviteModal({ open, onClose, competitionId }: { open: boolean; onClose: () => void; competitionId: string }) {
  const { data } = useStore();
  const comp = data.competitions.find((c) => c.id === competitionId)!;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(TEAM_ROLES[1]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setCopied(false);
    }
  }, [open]);

  const link = typeof window === "undefined" ? "" : window.location.origin;
  const message = `Halo${name.trim() ? ` ${name.trim()}` : ""}, kamu diundang masuk tim lomba "${comp.title}" di CompeteSync sebagai ${role}.\n\nLangkah: buka ${link}, daftar atau masuk, pilih "Gabung Lomba", lalu masukkan kode undangan ${comp.inviteCode}.`;
  const emailOk = !email.trim() || isEmail(email.trim());

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the message is selectable in the box */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Undang Anggota">
      <div className="space-y-3 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="iv-name">Nama (opsional)</label>
            <input id="iv-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Salsabila" />
          </div>
          <div>
            <label className="label" htmlFor="iv-role">Peran yang diharapkan</label>
            <select id="iv-role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
              {TEAM_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="iv-email">Email (opsional, @binus.ac.id atau @gmail.com)</label>
          <input id="iv-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@binus.ac.id" />
          {!emailOk && <p className="mt-1 text-xs text-danger">Format email belum valid.</p>}
        </div>
        <div>
          <span className="label">Pesan undangan</span>
          <textarea readOnly rows={5} className="field resize-none" value={message} aria-label="Pesan undangan" />
          <p className="mt-1 text-[11px] text-white/45">Aplikasi tidak mengirim email sendiri. Salin pesan ini ke WhatsApp, atau buka di aplikasi email Anda.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={copy}>
            <Copy size={15} /> {copied ? "Tersalin!" : "Salin Pesan"}
          </button>
          <a
            className={`btn-primary ${!email.trim() || !emailOk ? "pointer-events-none opacity-50" : ""}`}
            href={`mailto:${email.trim()}?subject=${encodeURIComponent(`Undangan tim ${comp.title}`)}&body=${encodeURIComponent(message)}`}
            aria-disabled={!email.trim() || !emailOk}
          >
            <Mail size={15} /> Buka di Email
          </a>
        </div>
      </div>
    </Modal>
  );
}

function AdvisorModal({ open, onClose, competitionId }: { open: boolean; onClose: () => void; competitionId: string }) {
  const { data, dispatch } = useStore();
  const comp = data.competitions.find((c) => c.id === competitionId)!;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setName(comp.advisorName);
      setEmail(comp.advisorEmail);
      setTouched(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const bad = email.trim() !== "" && !isEmail(email.trim());

  function save() {
    setTouched(true);
    if (bad) return;
    dispatch({ type: "updateCompetition", id: competitionId, patch: { advisorName: name.trim(), advisorEmail: email.trim() } });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Dosen Pembina">
      <div className="space-y-3 p-5">
        <div>
          <label className="label" htmlFor="ad-name">Nama Pembina</label>
          <input id="ad-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Dr. Hendra Wijaya" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="ad-email">Email Pembina (@binus.ac.id atau @gmail.com)</label>
          <input id="ad-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@binus.ac.id" />
          {touched && bad && <p className="mt-1 text-xs text-danger">Format email belum valid.</p>}
        </div>
        <p className="text-xs text-white/45">Laporan mingguan, kabar lolos babak, dan laporan akhir dikirim ke email ini.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={save}>Simpan</button>
        </div>
      </div>
    </Modal>
  );
}
