"use client";

import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CLOUD_ERROR_TEXT, CLOUD_PROBLEM_TEXT } from "@/lib/cloud";
import { normalizeInviteCode } from "@/lib/logic";
import { TEAM_ROLES } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { Badge, Modal } from "../ui";

const MAX_TEAM = 5;

export default function JoinCompetitionModal({
  open,
  initialCode,
  onClose,
  onJoined,
}: {
  open: boolean;
  initialCode?: string;
  onClose: () => void;
  onJoined: (id: string, message?: string) => void;
}) {
  const { data, me, dispatch, cloud } = useStore();
  const [code, setCode] = useState("");
  const [role, setRole] = useState<string>(TEAM_ROLES[1]);
  const [roleTouched, setRoleTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCode(initialCode ?? "");
      setError(null);
      setRoleTouched(false);
      setBusy(false);
    }
  }, [open, initialCode]);

  const online = cloud.mode === "supabase" || cloud.mode === "memory";
  // Local-only mode keeps every account in this browser, so listing codes is a testing convenience there.
  // Once rooms live in the cloud, invite codes are secrets the leader hands out and the list must not exist.
  const showList = cloud.mode === "off" && !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const joinable = data.competitions.filter((c) => c.status !== "archived");

  const teamSize = (id: string) => data.members.filter((m) => m.competitionId === id && m.role !== "advisor").length;
  const isMember = (id: string) => data.members.some((m) => m.competitionId === id && m.userId === me);

  async function join(raw = code) {
    // "stack-88", "STACK 88" and "STACK88" are the same code.
    const entered = normalizeInviteCode(raw);
    if (!entered) return setError("Masukkan kode undangan dari Ketua tim.");
    setBusy(true);
    setError(null);

    // Always ask the cloud first, so a competition created on another device is found.
    let remote: { roomId: string; title: string; memberIds: string[] } | null = null;
    if (online) {
      const r = await cloud.joinByCode(raw);
      if (r.ok) remote = r;
      else if (r.error !== "not_found") {
        setBusy(false);
        return setError(CLOUD_ERROR_TEXT[r.error]);
      }
    }

    const local = data.competitions.find((c) => normalizeInviteCode(c.inviteCode) === entered);
    const target = remote ? { id: remote.roomId, title: remote.title } : local ? { id: local.id, title: local.title } : null;
    if (!target) {
      setBusy(false);
      return setError(
        online
          ? "Kode tidak ditemukan di cloud maupun di browser ini. Huruf besar-kecil, spasi, dan tanda hubung tidak berpengaruh, jadi periksa huruf dan angkanya."
          : "Kode tidak ditemukan di browser ini. Cloud belum aktif, jadi lomba hanya dikenali di browser tempat ia dibuat. Minta Ketua menyalin Link Undangan dari kartu Tim; link itu membawa data lomba.",
      );
    }

    const already = remote ? remote.memberIds.includes(me) || isMember(target.id) : isMember(target.id);
    if (already) {
      // Not an error: take them to the room, and apply the role only if they picked a new one.
      if (roleTouched) dispatch({ type: "setTeamRole", competitionId: target.id, userId: me, teamRole: role });
      setBusy(false);
      onJoined(target.id, "✅ Kamu sudah terdaftar di tim ini! Membuka ruang lomba…");
      onClose();
      return;
    }
    const size = remote ? remote.memberIds.length : teamSize(target.id);
    if (size >= MAX_TEAM) {
      setBusy(false);
      return setError(`Tim "${target.title}" sudah penuh (maksimal ${MAX_TEAM} anggota).`);
    }
    dispatch({ type: "join", competitionId: target.id, userId: me, teamRole: role });
    setBusy(false);
    onJoined(target.id, `🎉 Berhasil bergabung ke lomba ${target.title} sebagai ${role}!`);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Gabung Lomba dengan Kode">
      <div className="space-y-4 p-5">
        {cloud.mode === "checking" && <p className="rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white/60">Memeriksa koneksi cloud…</p>}
        {online && (
          <p className="rounded-xl bg-safe/10 px-3 py-2 text-xs font-medium text-safe">🔄 Terhubung ke Cloud Server — Masukkan kode undangan dari ketua tim Anda.</p>
        )}
        {cloud.mode === "off" && (
          <p className="rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">
            {cloud.problem ? CLOUD_PROBLEM_TEXT[cloud.problem] : "Cloud belum aktif di server ini."} Sampai itu beres, lomba hanya dikenali di browser tempat ia dibuat. Untuk bergabung dari perangkat lain, pakai <strong>Link Undangan</strong> dari kartu Tim milik Ketua.
          </p>
        )}

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
              onKeyDown={(e) => e.key === "Enter" && !busy && join()}
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

        {showList && joinable.length > 0 && (
          <div>
            <span className="label">Daftar kode lomba aktif (klik untuk isi otomatis)</span>
            <ul className="space-y-1.5">
              {joinable.map((c) => (
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
                    {isMember(c.id) && (
                      <Badge tone="safe">
                        <CheckCircle2 size={11} /> Sudah gabung
                      </Badge>
                    )}
                    <span className="font-mono text-xs font-semibold tracking-wider text-active">{c.inviteCode}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-white/40">Hanya tampil saat cloud belum aktif, karena semua akun ada di browser ini. Setelah cloud aktif, kode hanya dibagikan oleh Ketua.</p>
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
          Setelah bergabung, lomba langsung muncul di beranda Anda dan semua tenggatnya disinkronkan ke Google Calendar dan Outlook akun Anda.
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" onClick={() => join()} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Gabung Sekarang
          </button>
        </div>
      </div>
    </Modal>
  );
}
