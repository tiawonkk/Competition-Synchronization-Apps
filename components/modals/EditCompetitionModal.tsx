"use client";

import { useEffect, useState } from "react";
import { isValidProofUrl } from "@/lib/logic";
import { isEmail } from "@/lib/passwords";
import { useStore } from "@/lib/store";
import { Modal } from "../ui";

/** Leader-only form to fill in or change the details that were left empty when the competition was created. */
export default function EditCompetitionModal({ competitionId, onClose }: { competitionId: string | null; onClose: () => void }) {
  const { data, dispatch } = useStore();
  const comp = data.competitions.find((c) => c.id === competitionId);
  const [f, setF] = useState({ title: "", theme: "", advisorName: "", advisorEmail: "", onedriveFolderUrl: "", gdriveFolderUrl: "" });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!comp) return;
    setF({
      title: comp.title,
      theme: comp.theme,
      advisorName: comp.advisorName,
      advisorEmail: comp.advisorEmail,
      onedriveFolderUrl: comp.onedriveFolderUrl ?? "",
      gdriveFolderUrl: comp.gdriveFolderUrl ?? "",
    });
    setTouched(false);
  }, [comp?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const errors = {
    title: !f.title.trim() && "Nama lomba wajib diisi.",
    advisorEmail: f.advisorEmail.trim() && !isEmail(f.advisorEmail.trim()) && "Format email belum valid.",
    onedriveFolderUrl: f.onedriveFolderUrl.trim() && !isValidProofUrl(f.onedriveFolderUrl) && "Gunakan tautan https dari OneDrive atau SharePoint.",
    gdriveFolderUrl: f.gdriveFolderUrl.trim() && !isValidProofUrl(f.gdriveFolderUrl) && "Gunakan tautan https dari Google Drive.",
  };
  const err = (k: keyof typeof errors) => touched && errors[k] && <p className="mt-1 text-xs text-danger">{errors[k]}</p>;

  function save() {
    setTouched(true);
    if (!comp || Object.values(errors).some(Boolean)) return;
    dispatch({
      type: "updateCompetition",
      id: comp.id,
      patch: {
        title: f.title.trim(),
        theme: f.theme.trim(),
        advisorName: f.advisorName.trim(),
        advisorEmail: f.advisorEmail.trim(),
        onedriveFolderUrl: f.onedriveFolderUrl.trim() || undefined,
        gdriveFolderUrl: f.gdriveFolderUrl.trim() || undefined,
      },
    });
    onClose();
  }

  return (
    <Modal open={!!comp} onClose={onClose} title="Detail Lomba">
      <div className="space-y-3 p-5">
        <div>
          <label className="label" htmlFor="e-title">Nama lomba</label>
          <input id="e-title" className="field" value={f.title} onChange={set("title")} />
          {err("title")}
        </div>
        <div>
          <label className="label" htmlFor="e-theme">Tema</label>
          <input id="e-theme" className="field" value={f.theme} onChange={set("theme")} placeholder="Belum diisi" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="e-an">Nama Pembina</label>
            <input id="e-an" className="field" value={f.advisorName} onChange={set("advisorName")} placeholder="Belum diisi" />
          </div>
          <div>
            <label className="label" htmlFor="e-ae">Email Pembina</label>
            <input id="e-ae" type="email" className="field" value={f.advisorEmail} onChange={set("advisorEmail")} placeholder="nama@binus.ac.id" />
            {err("advisorEmail")}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="e-od">Folder OneDrive Pro</label>
          <input id="e-od" className="field" value={f.onedriveFolderUrl} onChange={set("onedriveFolderUrl")} placeholder="https://binus-my.sharepoint.com/…" />
          {err("onedriveFolderUrl")}
        </div>
        <div>
          <label className="label" htmlFor="e-gd">Folder Google Drive</label>
          <input id="e-gd" className="field" value={f.gdriveFolderUrl} onChange={set("gdriveFolderUrl")} placeholder="https://drive.google.com/drive/folders/…" />
          {err("gdriveFolderUrl")}
        </div>
        <p className="text-xs text-white/45">Semua kolom selain nama lomba boleh dikosongkan dan diisi nanti.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={save}>Simpan</button>
        </div>
      </div>
    </Modal>
  );
}
