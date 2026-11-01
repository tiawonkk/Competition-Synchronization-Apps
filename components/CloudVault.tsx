"use client";

import { CloudUpload, ExternalLink, FileArchive, FileText, FolderOpen, Network, Plus, Presentation, Sparkles } from "lucide-react";
import { useState } from "react";
import { isValidProofUrl, uid } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Provider, ResourceKind } from "@/lib/types";
import GuidebookReaderModal from "./modals/GuidebookReaderModal";
import LargeUploadModal from "./modals/LargeUploadModal";
import { Badge, Modal } from "./ui";

const KIND_ICON: Record<ResourceKind, typeof FileText> = {
  guidebook: FileText,
  diagram: Network,
  deck: Presentation,
  zip: FileArchive,
  other: FileText,
};
const KIND_LABEL: Record<ResourceKind, string> = { guidebook: "Guidebook (PDF)", diagram: "Diagram / Desain", deck: "Pitch Deck", zip: "Source Code / ZIP", other: "Lainnya" };

const PROVIDER_LABEL: Record<Provider, string> = { onedrive: "OneDrive Pro", gdrive: "Google Drive", supabase: "Supabase Storage" };
const PROVIDER_STYLE: Record<Provider, string> = {
  onedrive: "bg-[#dff0ff] text-[#1e3a8a] dark:bg-[#172736] dark:text-[#93c5fd]",
  gdrive: "bg-[#dcfce7] text-[#14532d] dark:bg-[#142e22] dark:text-[#86efac]",
  supabase: "bg-[#fef4c7] text-[#78350f] dark:bg-[#302615] dark:text-[#fcd34d]",
};

type Filter = "all" | Provider;

/** Cloud Vault tab: shared folders plus a filterable file list backed by OneDrive Pro and Google Drive links. */
export default function CloudVault({ competitionId }: { competitionId: string }) {
  const { data, me } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [bigOpen, setBigOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const isLeader = data.members.some((m) => m.competitionId === competitionId && m.userId === me && m.role === "leader");
  const comp = data.competitions.find((c) => c.id === competitionId)!;
  const all = data.resources.filter((r) => r.competitionId === competitionId);
  const files = all.filter((r) => filter === "all" || r.provider === filter);
  const count = (p: Provider) => all.filter((r) => r.provider === p).length;

  return (
    <section className="card p-6 sm:p-7" aria-labelledby="vault-h">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="vault-h" className="text-base font-bold tracking-tight">
          Cloud Vault
        </h2>
        <div className="flex flex-wrap gap-2">
          {isLeader && (
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setReaderOpen(true)}>
              <Sparkles size={15} /> Baca Guidebook (AI)
            </button>
          )}
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => setBigOpen(true)}>
            <CloudUpload size={15} /> Unggah Berkas Besar
          </button>
          <button className="btn-primary !py-1.5 text-xs" onClick={() => setAdding(true)}>
            <Plus size={15} /> Tambah Link Berkas
          </button>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <FolderCard url={comp.onedriveFolderUrl} name="OneDrive Pro" hint="Folder bersama Microsoft 365 Binus" tone="sky" />
        <FolderCard url={comp.gdriveFolderUrl} name="Google Drive" hint="Folder bersama akun Gmail" tone="mint" />
      </div>

      <div className="mb-3 mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter penyimpanan">
        {(
          [
            ["all", `Semua (${all.length})`],
            ["onedrive", `OneDrive (${count("onedrive")})`],
            ["gdrive", `Google Drive (${count("gdrive")})`],
            ["supabase", `Supabase (${count("supabase")})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              filter === id
                ? "border-[#141416] bg-[#141416] text-[#ffffff] dark:border-[#f4f4f6] dark:bg-[#f4f4f6] dark:text-[#141416]"
                : "border-[#e4e2dc] bg-[#faf9f6] text-white/65 hover:bg-[#f0efea] dark:border-white/10 dark:bg-[#202024]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {files.map((r) => {
          const Icon = KIND_ICON[r.kind];
          const adder = data.users.find((u) => u.id === r.addedBy);
          return (
            <li key={r.id}>
              <RowLink url={r.url}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${PROVIDER_STYLE[r.provider]}`}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.title}</span>
                  <span className="text-xs text-white/50">
                    {PROVIDER_LABEL[r.provider]} · {r.meta}
                    {adder ? ` · oleh ${adder.fullName.split(" ")[0]}` : ""}
                  </span>
                </span>
                {r.simulated ? <Badge tone="warn">Simulasi</Badge> : <ExternalLink size={15} className="text-white/30 group-hover:text-white/80" />}
              </RowLink>
            </li>
          );
        })}
        {files.length === 0 && <li className="py-8 text-center text-xs text-white/45">Belum ada berkas di sini. Tambahkan tautan guidebook, deck, atau ZIP tim.</li>}
      </ul>

      <AddFileModal open={adding} competitionId={competitionId} onClose={() => setAdding(false)} />
      <LargeUploadModal open={bigOpen} competitionId={competitionId} onClose={() => setBigOpen(false)} />
      <GuidebookReaderModal open={readerOpen} competitionId={competitionId} onClose={() => setReaderOpen(false)} />
    </section>
  );
}

/** A vault row: a link when the file has a cloud URL, a plain row for demo uploads that have none. */
function RowLink({ url, children }: { url: string; children: React.ReactNode }) {
  const cls = "group flex items-center gap-3.5 rounded-2xl border border-[#eae8e1] bg-[#faf9f6] px-4 py-3 transition hover:bg-[#ffffff] hover:shadow-sm dark:border-white/10 dark:bg-[#202024] dark:hover:bg-[#25252a]";
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <div className={cls}>{children}</div>
  );
}

function FolderCard({ url, name, hint, tone }: { url?: string; name: string; hint: string; tone: "sky" | "mint" }) {
  if (!url) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#d4d2ca] bg-[#faf9f6]/60 p-4 text-xs text-white/45 dark:border-white/15 dark:bg-white/[0.02]">
        <FolderOpen size={19} />
        <div className="mt-2 font-bold text-white/75">{name}</div>
        Folder belum ditautkan
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{ background: `var(--tile-${tone})` }}
      className="rounded-[24px] border border-black/[0.05] p-4 transition hover:-translate-y-0.5 hover:shadow-sm dark:border-white/10"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ffffff]/80 text-[#141416] shadow-sm dark:bg-[#141416]/40 dark:text-[#f4f4f6]">
        <FolderOpen size={17} />
      </span>
      <div className="mt-2.5 text-sm font-bold">{name}</div>
      <div className="mt-0.5 text-xs text-white/60">{hint}</div>
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
      <div className="space-y-4 p-6">
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
        <div className="grid grid-cols-2 gap-3.5">
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
        <div className="flex justify-end gap-2 pt-2">
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
