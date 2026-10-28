"use client";

import { BellRing, CheckCircle2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { alarm, pushNotify } from "@/lib/alarm";
import { fmtDateTime, relative } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Badge, Modal } from "../ui";

/**
 * Persistent ringing alarm. The modal cannot be dismissed — the only way to stop the sound is
 * "Konfirmasi Selesai", which hands over to the completion flow (Stop-on-Confirm).
 */
export default function AlarmModal({ taskId, onConfirm }: { taskId: string | null; onConfirm: (taskId: string) => void }) {
  const { data, now } = useStore();
  const task = data.tasks.find((t) => t.id === taskId);
  const comp = data.competitions.find((c) => c.id === task?.competitionId);
  const ringing = !!task && !task.isCompleted && task.alarmActive;

  useEffect(() => {
    if (ringing && task) {
      alarm.start();
      pushNotify("⏰ Tugas hampir/lewat tenggat", `${task.title} — ${comp?.title ?? ""}`);
    }
    return () => alarm.stop();
    // restart only when the ringing task changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringing, task?.id]);

  return (
    <Modal open={ringing} locked title="⏰ ALARM TENGGAT">
      {task && (
        <div className="p-6 text-center">
          <div className="mx-auto grid h-20 w-20 animate-pulseGlow place-items-center rounded-full bg-danger/20 text-danger">
            <BellRing size={40} className="animate-ring" />
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <Badge tone="danger" pulse>
              {relative(task.dueDate, now)}
            </Badge>
            <Badge tone="neutral">{comp?.title}</Badge>
          </div>
          <h3 className="mt-3 text-xl font-bold">{task.title}</h3>
          <p className="mt-1 text-sm text-white/60">Tenggat: {fmtDateTime(task.dueDate)}</p>
          <p className="mx-auto mt-4 max-w-sm text-xs text-white/50">
            Alarm dan pengingat kalender (Google/Outlook) hanya berhenti setelah Anda menandai tugas selesai dan melampirkan tautan bukti
            (OneDrive/Google Drive).
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button className="btn-danger px-5 py-3 text-base" onClick={() => onConfirm(task.id)}>
              <CheckCircle2 size={18} /> Konfirmasi Selesai (Upload Bukti)
            </button>
            <button className="btn-ghost" onClick={() => alarm.muteFor(60_000)}>
              <VolumeX size={16} /> Redam suara 1 menit
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
