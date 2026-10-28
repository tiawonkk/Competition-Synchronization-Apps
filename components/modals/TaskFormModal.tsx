"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { dayKey, fromLocalInput, PRIORITY_LABEL, toLocalInput, uid } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Priority } from "@/lib/types";
import { Modal } from "../ui";

export interface TaskFormCtx {
  competitionId: string;
  stageId: string;
  milestoneId: string | null;
  taskId?: string; // set when editing
  defaultDue?: string; // ISO; pre-fills the deadline (e.g. a date clicked on the calendar)
}

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

/** Add or edit one task: title, description, assignee, priority, deadline and the milestone it belongs to. */
export default function TaskFormModal({ ctx, onClose }: { ctx: TaskFormCtx | null; onClose: () => void }) {
  const { data, me, dispatch } = useStore();
  const task = ctx?.taskId ? data.tasks.find((t) => t.id === ctx.taskId) : undefined;
  const team = data.members.filter((m) => m.competitionId === ctx?.competitionId && m.role !== "advisor");
  const milestones = data.milestones.filter((m) => m.competitionId === ctx?.competitionId && m.stageId === ctx?.stageId).sort((a, b) => a.orderIndex - b.orderIndex);
  const isLeader = data.members.some((m) => m.competitionId === ctx?.competitionId && m.userId === me && m.role === "leader");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [due, setDue] = useState("");
  const [milestoneId, setMilestoneId] = useState<string>("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!ctx) return;
    setTouched(false);
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAssignee(task.assignedTo ?? me);
      setPriority(task.priority);
      setDue(toLocalInput(task.dueDate));
      setMilestoneId(task.milestoneId ?? "");
      return;
    }
    const ms = milestones.find((m) => m.id === ctx.milestoneId);
    // Default deadline: the clicked date, else the milestone's target day, both at 23:59.
    const day = ctx.defaultDue ? dayKey(ctx.defaultDue) : ms ? dayKey(ms.targetDate) : dayKey(Date.now() + 86400_000);
    setTitle("");
    setDescription("");
    setAssignee(me);
    setPriority("medium");
    setDue(`${day}T23:59`);
    setMilestoneId(ctx.milestoneId ?? "");
  }, [ctx?.taskId, ctx?.milestoneId, ctx?.defaultDue, ctx?.competitionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dueIso = fromLocalInput(due);
  const errors = { title: !title.trim() && "Judul pekerjaan wajib diisi.", due: !dueIso && "Pilih tanggal dan jam deadline." };

  function save() {
    setTouched(true);
    if (!ctx || errors.title || errors.due || !dueIso) return;
    if (task) {
      dispatch({
        type: "updateTask",
        id: task.id,
        patch: { title: title.trim(), description: description.trim(), assignedTo: assignee, priority, dueDate: dueIso, milestoneId: milestoneId || null },
      });
    } else {
      dispatch({
        type: "addTask",
        task: {
          id: uid("t"),
          competitionId: ctx.competitionId,
          stageId: ctx.stageId,
          milestoneId: milestoneId || null,
          assignedTo: assignee,
          title: title.trim(),
          description: description.trim(),
          dueDate: dueIso,
          priority,
          isCompleted: false,
          alarmActive: true,
        },
      });
    }
    onClose();
  }

  function remove() {
    if (!task) return;
    if (!window.confirm(`Hapus tugas "${task.title}"? Penanda kalender dan skor kesiapan ikut diperbarui.`)) return;
    dispatch({ type: "deleteTask", id: task.id });
    onClose();
  }

  return (
    <Modal open={!!ctx} onClose={onClose} title={task ? "Edit Tugas" : "Tambah Tugas"}>
      <div className="space-y-3 p-5">
        <div>
          <label className="label" htmlFor="tf-title">Judul pekerjaan</label>
          <input id="tf-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Upload Twibbon & bukti broadcast" autoFocus />
          {touched && errors.title && <p className="mt-1 text-xs text-danger">{errors.title}</p>}
        </div>
        <div>
          <label className="label" htmlFor="tf-desc">Deskripsi singkat</label>
          <textarea id="tf-desc" rows={2} className="field resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="tf-who">Penanggung jawab</label>
            <select id="tf-who" className="field" value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={!isLeader}>
              {team.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {data.users.find((u) => u.id === m.userId)?.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tf-prio">Prioritas</label>
            <select id="tf-prio" className="field" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="tf-due">Tanggal &amp; jam deadline</label>
            <input id="tf-due" type="datetime-local" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
            {touched && errors.due && <p className="mt-1 text-xs text-danger">{errors.due}</p>}
          </div>
          <div>
            <label className="label" htmlFor="tf-ms">Milestone</label>
            <select id="tf-ms" className="field" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
              <option value="">Tanpa milestone</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!isLeader && <p className="text-xs text-white/45">Hanya Ketua yang dapat mengganti penanggung jawab.</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          {task && isLeader ? (
            <button className="btn-ghost !border-danger/40 !text-danger hover:!bg-danger/10" onClick={remove}>
              <Trash2 size={15} /> Hapus
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Batal</button>
            <button className="btn-primary" onClick={save}>{task ? "Simpan" : "Tambahkan"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
