import { createClient, type SupabaseClient, type User as AuthUser } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { AppData } from "../seed";
import type { Competition, Priority, Role, WhiteboardElement } from "../types";

/** Service-role client: bypasses RLS. Server only — never import from client components. */
export function serviceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export interface Caller {
  user: AuthUser;
  /** Client that carries the caller's JWT, so Postgres RLS applies to every query. */
  db: SupabaseClient;
}

/** Resolves the caller from `Authorization: Bearer <supabase access token>`; null if missing/invalid. */
export async function authenticate(req: NextRequest): Promise<Caller | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, db };
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Loads everything the report generator needs for one competition and maps snake_case rows to app types. */
export async function loadCompetitionData(db: SupabaseClient, competitionId: string): Promise<AppData | null> {
  const [comp, members, milestones, tasks, board] = await Promise.all([
    db.from("competitions").select("*").eq("id", competitionId).single(),
    db.from("competition_members").select("*, users(*)").eq("competition_id", competitionId),
    db.from("milestones").select("*").eq("competition_id", competitionId),
    db.from("tasks").select("*").eq("competition_id", competitionId),
    db.from("whiteboard_elements").select("*").eq("competition_id", competitionId).eq("type", "sticky"),
  ]);
  if (comp.error || !comp.data) return null;
  const c = comp.data as Row;

  const competition: Competition = {
    id: c.id,
    title: c.title,
    category: c.category,
    theme: c.theme ?? "",
    startDate: c.start_date,
    submissionDeadline: c.submission_deadline,
    advisorName: c.advisor_name ?? "Pembina",
    advisorEmail: c.advisor_email ?? "",
    onedriveFolderUrl: c.onedrive_folder_url ?? undefined,
    gdriveFolderUrl: c.gdrive_folder_url ?? undefined,
    status: c.status,
    accent: "#2563EB",
    inviteCode: c.invite_code ?? "",
  };

  const memberRows = (members.data ?? []) as Row[];
  return {
    competitions: [competition],
    users: memberRows.map((m) => ({
      id: m.users.id,
      fullName: m.users.full_name,
      emailGoogle: m.users.email_google ?? undefined,
      emailMicrosoft: m.users.email_microsoft ?? undefined,
      color: "#2563EB",
    })),
    members: memberRows.map((m) => ({ competitionId: m.competition_id, userId: m.user_id, role: m.role as Role, teamRole: m.team_role ?? undefined })),
    milestones: ((milestones.data ?? []) as Row[]).map((m) => ({
      id: m.id,
      competitionId: m.competition_id,
      title: m.title,
      targetDate: m.target_date,
      orderIndex: m.order_index,
    })),
    tasks: ((tasks.data ?? []) as Row[]).map((t) => ({
      id: t.id,
      competitionId: t.competition_id,
      milestoneId: t.milestone_id,
      assignedTo: t.assigned_to,
      title: t.title,
      description: t.description ?? "",
      dueDate: t.due_date,
      priority: t.priority as Priority,
      isCompleted: t.is_completed,
      completedAt: t.completed_at ?? undefined,
      proofUrl: t.proof_url ?? undefined,
      gcalEventId: t.gcal_event_id ?? undefined,
      outlookEventId: t.outlook_event_id ?? undefined,
      alarmActive: t.alarm_active,
      sourceNoteId: t.source_note_id ?? undefined,
    })),
    resources: [],
    reports: [],
    notices: [],
    session: null,
    whiteboard: ((board.data ?? []) as Row[]).map(
      (e): WhiteboardElement => ({
        id: e.id,
        competitionId: e.competition_id,
        type: e.type,
        kind: e.kind ?? undefined,
        content: e.content,
        color: e.color,
        x: e.position_x,
        y: e.position_y,
        votes: e.votes ?? [],
        createdBy: e.created_by,
        updatedAt: e.updated_at,
        taskId: e.task_id ?? undefined,
      }),
    ),
  };
}
