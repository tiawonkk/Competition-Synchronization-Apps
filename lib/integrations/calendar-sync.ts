/**
 * Unified calendar dispatcher: mirrors a task into the assignee's Google Calendar and/or Outlook (Microsoft Graph)
 * and silences those reminders when the task is completed (Stop-on-Confirm).
 *
 * Server-only. Uses the assignee's stored OAuth refresh tokens (users.google_refresh_token / ms_refresh_token).
 * Required scopes: Google `https://www.googleapis.com/auth/calendar.events`, Microsoft `Calendars.ReadWrite offline_access`.
 */

export interface SyncTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string; // ISO
  priority: "low" | "medium" | "high" | "critical";
  isCompleted: boolean;
  competitionTitle: string;
  gcalEventId?: string | null;
  outlookEventId?: string | null;
}

export interface SyncAssignee {
  emailGoogle?: string | null;
  emailMicrosoft?: string | null;
  googleRefreshToken?: string | null;
  msRefreshToken?: string | null;
}

export type Provider = "google" | "microsoft";

export interface ProviderResult {
  provider: Provider;
  ok: boolean;
  eventId?: string;
  error?: string;
  skipped?: string;
}

export interface SyncResult {
  google: ProviderResult;
  microsoft: ProviderResult;
}

/** Reminder offsets in minutes before the due time, by priority. Each fires as popup AND email (Google). */
const REMINDER_MINUTES: Record<SyncTask["priority"], number[]> = {
  low: [60],
  medium: [24 * 60, 60],
  high: [24 * 60, 3 * 60, 30],
  critical: [48 * 60, 24 * 60, 3 * 60, 30],
};

const EVENT_MINUTES = 30; // calendar block length ending at the due time

function eventWindow(task: SyncTask) {
  const end = new Date(task.dueDate);
  const start = new Date(end.getTime() - EVENT_MINUTES * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

const label = (t: SyncTask) => `[${t.competitionTitle}] ${t.title}`;
const body = (t: SyncTask) =>
  `${t.description ?? ""}\n\nPrioritas: ${t.priority.toUpperCase()}\nTugas ini dibuat oleh CompeteSync. Tandai selesai + unggah bukti agar pengingat berhenti.`.trim();

// ---------------------------------------------------------------------------
// OAuth: refresh-token -> access-token
// ---------------------------------------------------------------------------
async function tokenRequest(url: string, params: Record<string, string>): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(json.error_description ?? `Token exchange failed (${res.status})`);
  return json.access_token;
}

const googleAccessToken = (refresh: string) =>
  tokenRequest("https://oauth2.googleapis.com/token", {
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refresh,
    grant_type: "refresh_token",
  });

const microsoftAccessToken = (refresh: string) =>
  tokenRequest(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID ?? "common"}/oauth2/v2.0/token`, {
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    refresh_token: refresh,
    grant_type: "refresh_token",
    scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
  });

async function api<T>(url: string, token: string, method: string, payload?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------------------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------------------
const GCAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

function googleEvent(task: SyncTask) {
  const { start, end } = eventWindow(task);
  return {
    summary: label(task),
    description: body(task),
    start: { dateTime: start },
    end: { dateTime: end },
    colorId: task.priority === "critical" ? "11" : task.priority === "high" ? "6" : "9",
    reminders: {
      useDefault: false,
      // popup + email for every offset
      overrides: REMINDER_MINUTES[task.priority].flatMap((minutes) => [
        { method: "popup", minutes },
        { method: "email", minutes },
      ]),
    },
  };
}

async function upsertGoogle(task: SyncTask, token: string): Promise<string> {
  const event = googleEvent(task);
  if (task.gcalEventId) {
    try {
      const updated = await api<{ id: string }>(`${GCAL}/${task.gcalEventId}`, token, "PATCH", event);
      return updated.id;
    } catch {
      /* event was deleted on the calendar side — fall through and recreate */
    }
  }
  const created = await api<{ id: string }>(GCAL, token, "POST", event);
  return created.id;
}

/** Silence = drop every reminder and mark the event done, but keep it for history. */
async function silenceGoogle(task: SyncTask, token: string) {
  if (!task.gcalEventId) return;
  await api(`${GCAL}/${task.gcalEventId}`, token, "PATCH", {
    summary: `✅ ${label(task)}`,
    colorId: "10",
    transparency: "transparent",
    reminders: { useDefault: false, overrides: [] },
  });
}

// ---------------------------------------------------------------------------
// Microsoft Graph (Outlook / Binus M365)
// ---------------------------------------------------------------------------
const GRAPH = "https://graph.microsoft.com/v1.0/me/events";

function outlookEvent(task: SyncTask) {
  const { start, end } = eventWindow(task);
  // Graph supports ONE pop-up reminder per event (isReminderOn + reminderMinutesBeforeStart); there is no
  // per-event email reminder. We use the earliest-firing offset that still leaves time to act, and rely on the
  // M365 mailbox reminder settings / the Gmail copy for email nudges.
  const offsets = REMINDER_MINUTES[task.priority];
  return {
    subject: label(task),
    body: { contentType: "text", content: body(task) },
    start: { dateTime: start, timeZone: "UTC" },
    end: { dateTime: end, timeZone: "UTC" },
    isReminderOn: true,
    reminderMinutesBeforeStart: offsets[offsets.length - 1] === 30 ? 180 : offsets[0],
    importance: task.priority === "critical" || task.priority === "high" ? "high" : "normal",
    showAs: "busy",
    categories: ["CompeteSync"],
  };
}

async function upsertOutlook(task: SyncTask, token: string): Promise<string> {
  const event = outlookEvent(task);
  if (task.outlookEventId) {
    try {
      const updated = await api<{ id: string }>(`${GRAPH}/${task.outlookEventId}`, token, "PATCH", event);
      return updated.id;
    } catch {
      /* deleted in Outlook — recreate */
    }
  }
  const created = await api<{ id: string }>(GRAPH, token, "POST", event);
  return created.id;
}

async function silenceOutlook(task: SyncTask, token: string) {
  if (!task.outlookEventId) return;
  await api(`${GRAPH}/${task.outlookEventId}`, token, "PATCH", {
    subject: `✅ ${label(task)}`,
    isReminderOn: false,
    showAs: "free",
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
async function runProvider(
  provider: Provider,
  email: string | null | undefined,
  refresh: string | null | undefined,
  exchange: (r: string) => Promise<string>,
  op: (token: string) => Promise<string | void>,
): Promise<ProviderResult> {
  if (!email) return { provider, ok: true, skipped: "Akun belum ditautkan" };
  if (!refresh) return { provider, ok: false, error: "Refresh token tidak ada — minta anggota login ulang" };
  try {
    const eventId = await op(await exchange(refresh));
    return { provider, ok: true, eventId: typeof eventId === "string" ? eventId : undefined };
  } catch (e) {
    return { provider, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Create or update the task's event on every connected calendar. A failure on one provider never blocks the other. */
export async function syncTaskToCalendars(task: SyncTask, assignee: SyncAssignee): Promise<SyncResult> {
  if (task.isCompleted) return silenceTaskReminders(task, assignee);
  const [google, microsoft] = await Promise.all([
    runProvider("google", assignee.emailGoogle, assignee.googleRefreshToken, googleAccessToken, (t) => upsertGoogle(task, t)),
    runProvider("microsoft", assignee.emailMicrosoft, assignee.msRefreshToken, microsoftAccessToken, (t) => upsertOutlook(task, t)),
  ]);
  return { google, microsoft };
}

/** Stop-on-Confirm: remove every reminder from both calendars once the task is completed with proof. */
export async function silenceTaskReminders(task: SyncTask, assignee: SyncAssignee): Promise<SyncResult> {
  const [google, microsoft] = await Promise.all([
    runProvider("google", assignee.emailGoogle, assignee.googleRefreshToken, googleAccessToken, async (t) => {
      await silenceGoogle(task, t);
      return task.gcalEventId ?? undefined;
    }),
    runProvider("microsoft", assignee.emailMicrosoft, assignee.msRefreshToken, microsoftAccessToken, async (t) => {
      await silenceOutlook(task, t);
      return task.outlookEventId ?? undefined;
    }),
  ]);
  return { google, microsoft };
}

export function summarize(result: SyncResult): "synced" | "partial" | "failed" {
  const live = [result.google, result.microsoft].filter((r) => !r.skipped);
  if (live.length === 0 || live.every((r) => r.ok)) return "synced";
  return live.some((r) => r.ok) ? "partial" : "failed";
}
