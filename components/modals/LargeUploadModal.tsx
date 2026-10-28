"use client";

import { CheckCircle2, CloudUpload, Pause, Play, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { chunkCount, fmtBytes, simulatedSender, UPLOAD_TARGETS, uploadInChunks, type UploadTarget } from "@/lib/chunked-upload";
import { uid } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { ResourceKind } from "@/lib/types";
import { Modal } from "../ui";

interface Item {
  id: string;
  file: File;
  target: UploadTarget;
  chunkSize: number;
  total: number;
  done: number;
  status: "uploading" | "paused" | "done" | "error";
}

function kindOf(name: string): ResourceKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "guidebook";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "zip";
  if (["ppt", "pptx", "key"].includes(ext)) return "deck";
  if (["fig", "drawio", "png", "jpg", "jpeg", "svg"].includes(ext)) return "diagram";
  return "other";
}

/** Drag-and-drop uploader for big files: chunked, with progress, pause and resume. The transfer itself is simulated. */
export default function LargeUploadModal({ open, competitionId, onClose }: { open: boolean; competitionId: string; onClose: () => void }) {
  const { me, dispatch } = useStore();
  const [target, setTarget] = useState<UploadTarget>("supabase");
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const latest = useRef<Item[]>([]);
  latest.current = items;

  useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  const patch = (id: string, p: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

  async function run(item: Item) {
    const ac = new AbortController();
    controllers.current.set(item.id, ac);
    patch(item.id, { status: "uploading" });
    try {
      const done = await uploadInChunks(item.file, {
        chunkSize: item.chunkSize,
        startIndex: item.done,
        send: simulatedSender,
        signal: ac.signal,
        onChunk: (d) => patch(item.id, { done: d }),
      });
      if (done < item.total) return patch(item.id, { status: "paused", done });
      patch(item.id, { status: "done", done: item.total });
      dispatch({
        type: "addResource",
        resource: {
          id: uid("r"),
          competitionId,
          kind: kindOf(item.file.name),
          title: item.file.name,
          provider: item.target === "supabase" ? "supabase" : "onedrive",
          url: "",
          meta: `${fmtBytes(item.file.size)} · ${item.total} potongan · simulasi`,
          addedBy: me,
          sizeBytes: item.file.size,
          chunks: item.total,
          simulated: true,
        },
      });
    } catch {
      patch(item.id, { status: "error" });
    }
  }

  function add(list: FileList | File[]) {
    for (const file of Array.from(list)) {
      const chunkSize = UPLOAD_TARGETS[target].chunkSize;
      const item: Item = { id: uid("u"), file, target, chunkSize, total: chunkCount(file.size, chunkSize), done: 0, status: "uploading" };
      setItems((prev) => [...prev, item]);
      run(item);
    }
  }

  const pause = (id: string) => controllers.current.get(id)?.abort();
  const resume = (id: string) => {
    const item = latest.current.find((i) => i.id === id);
    if (item) run(item);
  };
  const remove = (id: string) => {
    controllers.current.get(id)?.abort();
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <Modal open={open} onClose={onClose} title="Unggah Berkas Besar" wide>
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-2.5 rounded-2xl bg-warn/10 p-3 text-xs text-warn">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>Mode simulasi.</strong> Berkas dipotong dan progresnya dihitung seperti unggahan sungguhan, tetapi isinya belum dikirim ke penyimpanan mana pun. Yang tercatat di Cloud Vault hanya nama, ukuran, dan jumlah potongan. Unggahan sungguhan menunggu Supabase Storage atau akun Microsoft 365 tersambung.
          </span>
        </div>

        <div role="radiogroup" aria-label="Tujuan penyimpanan" className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(UPLOAD_TARGETS) as UploadTarget[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={target === t}
              onClick={() => setTarget(t)}
              className={`rounded-2xl border p-3 text-left transition ${target === t ? "border-active bg-active/[0.08]" : "border-white/10 hover:bg-white/[0.05]"}`}
            >
              <div className="text-sm font-semibold">{UPLOAD_TARGETS[t].label}</div>
              <div className="text-[11px] text-white/50">
                {UPLOAD_TARGETS[t].protocol} · potongan {fmtBytes(UPLOAD_TARGETS[t].chunkSize)}
              </div>
            </button>
          ))}
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) add(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${dragging ? "border-active bg-active/[0.08]" : "border-white/15 hover:bg-white/[0.04]"}`}
        >
          <CloudUpload size={26} className="text-active" />
          <span className="text-sm font-semibold">Tarik berkas ke sini atau klik untuk memilih</span>
          <span className="text-xs text-white/50">Guidebook PDF, pitch deck, prototype ZIP. Ukuran besar (ratusan MB sampai GB) tidak masalah.</span>
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((i) => {
              const sent = Math.min(i.file.size, i.done * i.chunkSize);
              const pct = Math.round((100 * i.done) / i.total);
              return (
                <li key={i.id} className="rounded-2xl border border-white/10 p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{i.file.name}</div>
                      <div className="text-[11px] text-white/50">
                        {i.status === "done" ? (
                          <span className="inline-flex items-center gap-1 text-safe">
                            <CheckCircle2 size={12} /> Selesai · {fmtBytes(i.file.size)} · {i.total} potongan
                          </span>
                        ) : (
                          `Potongan ${i.done}/${i.total} · ${fmtBytes(sent)} dari ${fmtBytes(i.file.size)}${i.status === "paused" ? " · dijeda" : i.status === "error" ? " · gagal" : ""}`
                        )}
                      </div>
                    </div>
                    {i.status === "uploading" && (
                      <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => pause(i.id)} aria-label={`Jeda ${i.file.name}`}>
                        <Pause size={16} />
                      </button>
                    )}
                    {(i.status === "paused" || i.status === "error") && (
                      <button className="rounded-lg p-1.5 text-active hover:bg-white/10" onClick={() => resume(i.id)} aria-label={`Lanjutkan ${i.file.name}`}>
                        <Play size={16} />
                      </button>
                    )}
                    <button className="rounded-lg p-1.5 text-white/40 hover:bg-danger/15 hover:text-danger" onClick={() => remove(i.id)} aria-label={`Hapus ${i.file.name} dari daftar`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progres ${i.file.name}`}>
                    <div className={`h-full rounded-full transition-all ${i.status === "done" ? "bg-safe" : i.status === "error" ? "bg-danger" : "bg-active"}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end">
          <button className="btn-primary" onClick={onClose}>Selesai</button>
        </div>
      </div>
    </Modal>
  );
}
