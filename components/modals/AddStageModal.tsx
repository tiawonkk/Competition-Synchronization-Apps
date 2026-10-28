"use client";

import { useEffect, useState } from "react";
import { fmtDate, uid } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Modal } from "../ui";

const dayStr = (iso: string) => iso.slice(0, 10);

/** Adds a custom round (for example Pra-Kualifikasi or Bootcamp) after the running stage or a later one. */
export default function AddStageModal({ competitionId, onClose }: { competitionId: string | null; onClose: () => void }) {
  const { data, now, dispatch } = useStore();
  const stages = data.stages.filter((s) => s.competitionId === competitionId).sort((a, b) => a.orderIndex - b.orderIndex);
  // A new round can only go after the one that is running, never into the past.
  const anchors = stages.filter((s) => s.status === "active" || s.status === "upcoming");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [after, setAfter] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (competitionId) {
      setName("");
      setDate("");
      setAfter(anchors[anchors.length - 1]?.id ?? "");
      setTouched(false);
    }
  }, [competitionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const prev = stages.find((s) => s.id === after);
  const next = prev ? stages[stages.indexOf(prev) + 1] : undefined;
  const t = date ? new Date(`${date}T23:59:00`).getTime() : NaN;
  const error = !name.trim()
    ? "Nama babak wajib diisi."
    : !Number.isFinite(t) || t <= now
      ? "Pilih tanggal di masa depan."
      : prev && t <= new Date(prev.deadline).getTime()
        ? `Tanggal harus setelah tenggat ${prev.name} (${fmtDate(prev.deadline)}).`
        : next && t >= new Date(next.deadline).getTime()
          ? `Tanggal harus sebelum tenggat ${next.name} (${fmtDate(next.deadline)}).`
          : null;

  function save() {
    setTouched(true);
    if (error || !competitionId) return;
    dispatch({
      type: "addStage",
      afterStageId: after || null,
      stage: { id: uid("s"), competitionId, name: name.trim(), orderIndex: 0, status: "upcoming", deadline: new Date(t).toISOString() },
    });
    onClose();
  }

  return (
    <Modal open={!!competitionId} onClose={onClose} title="Tambah Babak">
      <div className="space-y-3 p-5">
        <div>
          <label className="label" htmlFor="st-name">Nama babak</label>
          <input id="st-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Pra-Kualifikasi, Bootcamp" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="st-after">Sisipkan setelah</label>
            <select id="st-after" className="field" value={after} onChange={(e) => setAfter(e.target.value)}>
              {anchors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="st-date">Tenggat babak</label>
            <input id="st-date" type="date" className="field" value={date} min={dayStr(new Date(now + 86400_000).toISOString())} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {touched && error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <p className="text-xs text-white/45">Tugas babak ini dibuat otomatis saat tim lolos ke sana.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={save}>Tambahkan</button>
        </div>
      </div>
    </Modal>
  );
}
