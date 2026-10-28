"use client";

import { ExternalLink, FileArchive, FileText, FolderOpen, Network, Plus, Presentation } from "lucide-react";
import { useState } from "react";
import { isValidProofUrl, uid } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Provider, ResourceKind } from "@/lib/types";
import { Modal } from "./ui";

const KIND_ICON: Record<ResourceKind, typeof FileText> = {
  guidebook: FileText,
  diagram: Network,
  deck: Presentation,
  zip: FileArchive,
  other: FileText,
};
const KIND_LABEL: Record<ResourceKind, string> = { guidebook: "Guidebook (PDF)", diagram: "Diagram / Desain", deck: "Pitch Deck", zip: "Source Code / ZIP", other: "Lainnya" };

type Filter = "all" | Provider;

/** Cloud Vault tab: shared folders plus a filterable file list backed by OneDrive Pro and Google Drive links. */
export default function CloudVault({ competitionId }: { competitionId: string }) {
  const { data } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const comp = data.competitions.find((c) => c.id === competitionId)!;
  const all = data.resources.filter((r) => r.competitionId === competitionId);
  const files = all.filter((r) => filter === "all" || r.provider === filter);
  const count = (p: Provider) => all.filter((r) => r.provider === p).length;

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="vault-h">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="vault-h" className="text-sm font-semibold">
          Cloud Vault
        </h2>
        <button className="btn-primary !py-1.5 text-xs" onClick={() => setAdding(true)}>
          <Plus size={15} /> Unggah / Tambah Link Berkas
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <FolderCard url={comp.onedriveFolderUrl} name="OneDrive Pro" hint="Folder bersama Microsoft 365 Binus" tone="active" />
        <FolderCard url={comp.gdriveFolderUrl} name="Google Drive" hint="Folder bersama akun Gmail" tone="safe" />
      </div>

      <div className="mb-2 mt-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter penyimpanan">
        {(
          [
            ["all", `Semua (${all.length})`],
            ["onedrive", `OneDrive (${count("onedrive")})`],
            ["gdrive", `Google Drive (${count("gdrive")})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`rounded-full border px-3 py-1 text-xs transition ${filter === id ? "border-active bg-active/15 text-active" : "border-white/10 text-white/60 hover:bg-white/10"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="space-y-1.5">
        {files.map((r) => {
          const Icon = KIND_ICON[r.kind];
          const adder = data.users.find((u) => u.id === r.addedBy);
          return (
            <li key={r.id}>
              <a href={r.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/[0.06]">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${r.provider === "onedrive" ? "bg-active/15 text-active" : "bg-safe/15 text-safe"}`}>
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="text-[11px] text-white/45">
                    {r.provider === "onedrive" ? "OneDrive Pro" : "Google Drive"} · {r.meta}
                    {adder ? ` · oleh ${adder.fullName.split(" ")[0]}` : ""}
                  </span>
                </span>
                <ExternalLink size={14} className="text-white/20 group-hover:text-white/70" />
              </a>
            </li>
          );
        })}
        {files.length === 0 && <li className="py-6 text-center text-xs text-white/40">Belum ada berkas di sini. Tambahkan tautan guidebook, deck, atau ZIP tim.</li>}
      </ul>

      <AddFileModal open={adding} competitionId={competitionId} onClose={() => setAdding(false)} />
    </section>
  );
}

function FolderCard({ url, name, hint, tone }: { url?: string; name: string; hint: string; tone: "active" | "safe" }) {
  const cls = tone === "active" ? "border-active/30 bg-active/10 hover:bg-active/20 text-active" : "border-safe/30 bg-safe/10 hover:bg-safe/20 text-safe";
  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 p-3 text-xs text-white/40">
        <FolderOpen size={18} />
        <div className="mt-1.5 font-semibold">{name}</div>
        Folder belum ditautkan
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`rounded-xl border p-3 transition ${cls}`}>
      <FolderOpen size={18} />
      <div className="mt-1.5 text-xs font-semibold text-white">{name}</div>
      <div className="text-[10px] text-white/50">{hint}</div>
    </a>
  );
}

function AddFileModal({ open, competitionId, onClose }: { open: boolean; competitionId: string; onClose: () => void }) {
  const { me, dispatch } = useStore();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<ResourceKind>("guidebook");
  const [meta, setMeta] = useState("");
  const [touched, setTouched] = useState(false);

  const urlOk = isValidProofUrl(url);
  const provider: Provider = /google\.com/i.test(url) ? "gdrive" : "onedrive";

  function submit() {
    setTouched(true);
    if (!title.trim() || !urlOk) return;
    dispatch({
      type: "addResource",
      resource: { id: uid("r"), competitionId, kind, title: title.trim(), provider, url: url.trim(), meta: meta.trim() || "Tautan", addedBy: me },
    });
    setTitle("");
    setUrl("");
    setMeta("");
    setTouched(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Tambah Link Berkas">
      <div className="space-y-3 p-5">
        <div>
          <label className="label" htmlFor="f-title">Nama berkas</label>
          <input id="f-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Pitch Deck v2.pptx" autoFocus />
          {touched && !title.trim() && <p className="mt-1 text-xs text-danger">Nama berkas wajib diisi.</p>}
        </div>
        <div>
          <label className="label" htmlFor="f-url">Tautan OneDrive atau Google Drive</label>
          <input id="f-url" className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/file/d/… atau https://1drv.ms/…" />
          {touched && !urlOk && <p className="mt-1 text-xs text-danger">Gunakan tautan https dari drive.google.com, docs.google.com, 1drv.ms, atau SharePoint Binus.</p>}
          {urlOk && <p className="mt-1 text-xs text-safe">Terdeteksi: {provider === "gdrive" ? "Google Drive" : "OneDrive Pro"}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="f-kind">Jenis</label>
            <select id="f-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as ResourceKind)}>
              {(Object.keys(KIND_LABEL) as ResourceKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-meta">Keterangan (opsional)</label>
            <input id="f-meta" className="field" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="PDF · 2 MB" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" onClick={submit}>
            <Plus size={16} /> Tambahkan
          </button>
        </div>
      </div>
    </Modal>
  );
}
