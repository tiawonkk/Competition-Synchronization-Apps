"use client";

import { CheckCircle2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { TEAM_ROLES } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { Badge, Modal } from "../ui";

const MAX_TEAM = 5;

export default function JoinCompetitionModal({ open, onClose, onJoined }: { open: boolean; onClose: () => void; onJoined: (id: string) => void }) {
  const { data, me, dispatch } = useStore();
  const [code, setCode] = useState("");
  const [role, setRole] = useState<string>(TEAM_ROLES[1]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
    }
  }, [open]);

  const teamSize = (id: string) => data.members.filter((m) => m.competitionId === id && m.role !== "advisor").length;
  const isMember = (id: string) => data.members.some((m) => m.competitionId === id && m.userId === me);

  function join(raw = code) {
    const entered = raw.trim().toUpperCase();
    const comp = data.competitions.find((c) => c.inviteCode.toUpperCase() === entered);
    if (!entered) return setError("Masukkan kode undangan dari Ketua tim.");
    if (!comp) return setError("Kode tidak ditemukan. Periksa kembali huruf dan angkanya.");
    if (isMember(comp.id)) return setError(`Anda sudah menjadi anggota "${comp.title}".`);
    if (teamSize(comp.id) >= MAX_TEAM) return setError(`Tim "${comp.title}" sudah penuh (maksimal ${MAX_TEAM} anggota).`);
    dispatch({ type: "join", competitionId: comp.id, userId: me, teamRole: role });
    onJoined(comp.id);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Gabung Lomba dengan Kode">
      <div className="space-y-4 p-5">
        <div>
          <label className="label" htmlFor="j-code">Kode undangan</label>
          <div className="relative">
            <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              id="j-code"
              className="field !pl-9 font-mono uppercase tracking-widest"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="mis. HACK-88"
              autoFocus
              autoComplete="off"
            />
          </div>
          {error && (
            <p role="alert" className="mt-1.5 text-xs text-danger">
              {error}
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="j-role">Peran Anda di tim</label>
          <select id="j-role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
            {TEAM_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">Kode contoh (klik untuk mencoba)</span>
          <ul className="space-y-1.5">
            {data.competitions.map((c) => {
              const joined = isMember(c.id);
              const full = teamSize(c.id) >= MAX_TEAM;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCode(c.inviteCode);
                      setError(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.08]"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.accent }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{c.title}</span>
                      <span className="text-[10px] text-white/45">
                        {teamSize(c.id)}/{MAX_TEAM} anggota
                      </span>
                    </span>
                    {joined ? (
                      <Badge tone="safe">
                        <CheckCircle2 size={11} /> Sudah gabung
                      </Badge>
                    ) : full ? (
                      <Badge tone="warn">Penuh</Badge>
                    ) : (
                      <span className="font-mono text-xs font-semibold tracking-wider text-active">{c.inviteCode}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
          Setelah bergabung, lomba langsung muncul di beranda Anda dan semua tenggatnya disinkronkan ke Google Calendar dan Outlook akun Anda.
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" onClick={() => join()}>
            <KeyRound size={16} /> Gabung Sekarang
          </button>
        </div>
      </div>
    </Modal>
  );
}
