"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { dayKey, fromLocalInput, toLocalInput, uid } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Modal } from "../ui";

export interface MilestoneFormCtx {
  competitionId: string;
  stageId: string;
  milestoneId?: string; // set when editing
}

/** Add or edit a milestone (an internal checkpoint inside a stage). */
export default function MilestoneFormModal({ ctx, onClose }: { ctx: MilestoneFormCtx | null; onClose: () => void }) {
  const { data, dispatch } = useStore();
  const ms = ctx?.milestoneId ? data.milestones.find((m) => m.id === ctx.milestoneId) : undefined;
  const stage = data.stages.find((s) => s.id === ctx?.stageId);
  const taskCount = ms ? data.tasks.filter((t) => t.milestoneId === ms.id).length : 0;
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!ctx) return;
    setTouched(false);
    setTitle(ms?.title ?? "");
    setTarget(ms ? toLocalInput(ms.targetDate) : `${dayKey(stage?.deadline ?? Date.now() + 7 * 86400_000)}T23:59`);
  }, [ctx?.milestoneId, ctx?.stageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const iso = fromLocalInput(target);
  const error = !title.trim() ? "Judul milestone wajib diisi." : !iso ? "Pilih tanggal target." : null;

  function save() {
    setTouched(true);
    if (!ctx || error || !iso) return;
    if (ms) dispatch({ type: "updateMilestone", id: ms.id, patch: { title: title.trim(), targetDate: iso } });
    else {
      const count = data.milestones.filter((m) => m.competitionId === ctx.competitionId && m.stageId === ctx.stageId).length;
      dispatch({ type: "addMilestone", milestone: { id: uid("m"), competitionId: ctx.competitionId, stageId: ctx.stageId, title: title.trim(), targetDate: iso, orderIndex: count } });
    }
    onClose();
  }

  function remove() {
    if (!ms) return;
    const extra = taskCount > 0 ? ` beserta ${taskCount} tugasnya` : "";
    if (!window.confirm(`Hapus milestone "${ms.title}"${extra}?`)) return;
    dispatch({ type: "deleteMilestone", id: ms.id });
    onClose();
  }

  return (
    <Modal open={!!ctx} onClose={onClose} title={ms ? "Edit Milestone" : "Tambah Milestone"}>
      <div className="space-y-3 p-5">
        <div>
          <label className="label" htmlFor="mf-title">Judul milestone</label>
          <input id="mf-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Draf proposal selesai" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="mf-date">Target tanggal &amp; jam</label>
          <input id="mf-date" type="datetime-local" className="field" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        {touched && error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          {ms ? (
            <button className="btn-ghost !border-danger/40 !text-danger hover:!bg-danger/10" onClick={remove}>
              <Trash2 size={15} /> Hapus
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Batal</button>
            <button className="btn-primary" onClick={save}>{ms ? "Simpan" : "Tambahkan"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
