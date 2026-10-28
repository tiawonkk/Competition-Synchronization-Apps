import { NextResponse, type NextRequest } from "next/server";
import { silenceTaskReminders, summarize, syncTaskToCalendars, type SyncTask } from "@/lib/integrations/calendar-sync";
import { authenticate, serviceClient } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";

/**
 * POST /api/sync-task   { taskId: string }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Call after a task is created, edited, re-assigned, or completed. The route decides what to do from the task's state:
 *  - open task      -> create/update the event on the assignee's Google Calendar and Outlook
 *  - completed task -> silence reminders on both calendars (Stop-on-Confirm)
 */
export async function POST(req: NextRequest) {
  const caller = await authenticate(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = (await req.json().catch(() => ({}))) as { taskId?: string };
  if (!taskId) return NextResponse.json({ error: "taskId wajib diisi" }, { status: 400 });

  // RLS-bound read: only returns the task if the caller is a member of its competition.
  const { data: task, error } = await caller.db
    .from("tasks")
    .select("*, competitions(title, created_by)")
    .eq("id", taskId)
    .single();
  if (error || !task) return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });

  const { data: membership } = await caller.db
    .from("competition_members")
    .select("role")
    .eq("competition_id", task.competition_id)
    .eq("user_id", caller.user.id)
    .single();
  if (membership?.role !== "leader" && task.assigned_to !== caller.user.id) {
    return NextResponse.json({ error: "Hanya Ketua atau penanggung jawab yang dapat menyinkronkan tugas" }, { status: 403 });
  }
  if (!task.assigned_to) return NextResponse.json({ ok: true, skipped: "Tugas belum ditugaskan" });

  // Refresh tokens are never readable through RLS — fetch them with the service role.
  const admin = serviceClient();
  const { data: assignee } = await admin
    .from("users")
    .select("email_google, email_microsoft, google_refresh_token, ms_refresh_token")
    .eq("id", task.assigned_to)
    .single();
  if (!assignee) return NextResponse.json({ error: "Penanggung jawab tidak ditemukan" }, { status: 404 });

  const syncTask: SyncTask = {
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.due_date,
    priority: task.priority,
    isCompleted: task.is_completed,
    competitionTitle: task.competitions?.title ?? "",
    gcalEventId: task.gcal_event_id,
    outlookEventId: task.outlook_event_id,
  };
  const who = {
    emailGoogle: assignee.email_google,
    emailMicrosoft: assignee.email_microsoft,
    googleRefreshToken: assignee.google_refresh_token,
    msRefreshToken: assignee.ms_refresh_token,
  };

  const result = task.is_completed ? await silenceTaskReminders(syncTask, who) : await syncTaskToCalendars(syncTask, who);
  const status = task.is_completed ? "silenced" : summarize(result);

  await admin
    .from("tasks")
    .update({
      gcal_event_id: result.google.eventId ?? task.gcal_event_id,
      outlook_event_id: result.microsoft.eventId ?? task.outlook_event_id,
      calendar_sync_status: status,
      calendar_synced_at: new Date().toISOString(),
    })
    .eq("id", task.id);

  return NextResponse.json({ ok: status !== "failed", status, result }, { status: status === "failed" ? 502 : 200 });
}
