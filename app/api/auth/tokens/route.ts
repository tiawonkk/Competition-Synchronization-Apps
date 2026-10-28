import { NextResponse, type NextRequest } from "next/server";
import { authenticate, serviceClient } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";

/**
 * POST /api/auth/tokens   { provider: "google" | "azure", refreshToken: string, email?: string }
 * Stores the caller's own provider refresh token (service role: the column is not writable through RLS).
 * TODO before production: encrypt at rest (Supabase Vault).
 */
export async function POST(req: NextRequest) {
  const caller = await authenticate(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider, refreshToken, email } = (await req.json().catch(() => ({}))) as { provider?: string; refreshToken?: string; email?: string };
  if ((provider !== "google" && provider !== "azure") || !refreshToken) {
    return NextResponse.json({ error: "provider dan refreshToken wajib diisi" }, { status: 400 });
  }

  const patch = provider === "google" ? { google_refresh_token: refreshToken, email_google: email } : { ms_refresh_token: refreshToken, email_microsoft: email };
  const { error } = await serviceClient().from("users").update(patch).eq("id", caller.user.id);
  if (error) return NextResponse.json({ error: "Gagal menyimpan token" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
