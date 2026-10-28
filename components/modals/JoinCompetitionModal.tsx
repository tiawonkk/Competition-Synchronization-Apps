"use client";

import { CheckCircle2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { normalizeInviteCode } from "@/lib/logic";
import { TEAM_ROLES } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { Badge, Modal } from "../ui";

const MAX_TEAM = 5;

export default function JoinCompetitionModal({ open, onClose, onJoined }: { open: boolean; onClose: () => void; onJoined: (id: string, message?: string) => void }) {
  const { data, me, dispatch } = useStore();
  const [code, setCode] = useState("");
  const [role, setRole] = useState<string>(TEAM_ROLES[1]);
  const [roleTouched, setRoleTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      setRoleTouched(false);
    }
  }, [open]);

  // Demo mode keeps every account in this browser, so listing the codes is a testing convenience.
  // With a real backend invite codes are secrets the leader hands out, so the list must not exist.
  const demo = !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const joinable = data.competitions.filter((c) => c.status !== "archived");

  const teamSize = (id: string) => data.members.filter((m) => m.competitionId === id && m.role !== "advisor").length;
  const isMember = (id: string) => data.members.some((m) => m.competitionId === id && m.userId === me);

  function join(raw = code) {
    // "stack-88", "STACK 88" and "STACK88" are the same code.
    const entered = normalizeInviteCode(raw);
    if (!entered) return setError("Masukkan kode undangan dari Ketua tim.");
    const comp = data.competitions.find((c) => normalizeInviteCode(c.inviteCode) === entered);
    if (!comp) {
      return setError(
        data.competitions.length === 0
          ? "Belum ada lomba di browser ini. Data lomba tersimpan per browser, jadi akun di perangkat lain belum bisa melihat lomba yang dibuat di sini."
          : "Kode tidak ditemukan. Huruf besar-kecil, spasi, dan tanda hubung tidak berpengaruh, jadi periksa huruf dan angkanya. Data lomba hanya ada di browser tempat lomba dibuat.",
      );
    }
    if (isMember(comp.id)) {
      // Not an error: take them to the room, and apply the role only if they picked a new one.
      if (roleTouched) dispatch({ type: "setTeamRole", competitionId: comp.id, userId: me, teamRole: role });
      onJoined(comp.id, "✅ Kamu sudah terdaftar di tim ini! Membuka ruang lomba…");
      onClose();
      return;
    }
    if (teamSize(comp.id) >= MAX_TEAM) return setError(`Tim "${comp.title}" sudah penuh (maksimal ${MAX_TEAM} anggota).`);
    dispatch({ type: "join", competitionId: comp.id, userId: me, teamRole: role });
    onJoined(comp.id, `🎉 Berhasil bergabung ke lomba ${comp.title} sebagai ${role}!`);
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
              placeholder="Kode dari Ketua tim"
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
          <select
            id="j-role"
            className="field"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setRoleTouched(true);
            }}
          >
            {TEAM_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>

        {demo && joinable.length > 0 && (
          <div>
            <span className="label">Daftar kode lomba aktif (klik untuk isi otomatis)</span>
            <ul className="space-y-1.5">
              {joinable.map((c) => {
                const joined = isMember(c.id);
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
                      {joined && (
                        <Badge tone="safe">
                          <CheckCircle2 size={11} /> Sudah gabung
                        </Badge>
                      )}
                      <span className="font-mono text-xs font-semibold tracking-wider text-active">{c.inviteCode}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-[11px] text-white/40">Hanya tampil di mode demo, karena semua akun ada di browser ini. Setelah memakai Supabase, daftar ini hilang dan kode hanya dibagikan oleh Ketua.</p>
          </div>
        )}

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
