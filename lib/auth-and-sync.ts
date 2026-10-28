import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Production auth + calendar entry point (client side). The prototype UI signs in against local demo data;
 * wire these helpers into LoginScreen once the Supabase env vars are set.
 *
 *   Google     -> Supabase provider "google"  (Calendar events + Drive file scope, offline access for a refresh token)
 *   Microsoft  -> Supabase provider "azure"   (Binus M365: Calendars.ReadWrite + Files.ReadWrite, offline_access)
 *
 * Calendar dispatch and reminder cancellation run server-side in `lib/integrations/calendar-sync.ts`,
 * triggered through `POST /api/sync-task`; see `syncTask` below.
 */

let client: SupabaseClient | null = null;

/** Browser Supabase client, or null when the env vars are missing (demo mode). */
export function supabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key);
  return client;
}

function requireClient(): SupabaseClient {
  const c = supabaseBrowser();
  if (!c) throw new Error("Supabase belum dikonfigurasi: isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return c;
}

const redirect = () => (typeof window === "undefined" ? undefined : window.location.origin);

export async function signInWithGoogle() {
  const { error } = await requireClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirect(),
      scopes: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file",
      // offline + consent make Google return a refresh token, which calendar sync needs when the user is away.
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw error;
}

export async function signInWithMicrosoft() {
  const { error } = await requireClient().auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo: redirect(),
      scopes: "openid profile email offline_access Calendars.ReadWrite Files.ReadWrite",
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await requireClient().auth.signOut();
}

/**
 * Supabase only exposes provider refresh tokens on the sign-in session, once. Call this from onAuthStateChange
 * (event SIGNED_IN) so the server can store it for later calendar calls.
 */
export async function storeProviderTokens(session: Session): Promise<void> {
  const refresh = session.provider_refresh_token;
  const provider = session.user.app_metadata?.provider;
  if (!refresh || (provider !== "google" && provider !== "azure")) return;
  await fetch("/api/auth/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ provider, refreshToken: refresh, email: session.user.email }),
  });
}

/** Create / update / silence the calendar events for one task (server decides from the task's state). */
export async function syncTask(taskId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { data } = await requireClient().auth.getSession();
  if (!data.session) return { ok: false, error: "Belum masuk" };
  const res = await fetch("/api/sync-task", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ taskId }),
  });
  return res.json();
}

/** Join a competition by invite code (see `join_competition` in supabase/schema_phase3.sql). */
export async function joinByCode(code: string, teamRole: string): Promise<string> {
  const { data, error } = await requireClient().rpc("join_competition", { p_code: code, p_team_role: teamRole });
  if (error) throw error;
  return data as string;
}
