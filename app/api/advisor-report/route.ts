import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { authenticate, loadCompetitionData, serviceClient } from "@/lib/integrations/supabase-server";
import { generateAdvisorReport } from "@/lib/report";

export const runtime = "nodejs";

interface Dispatched {
  competitionId: string;
  weekNumber: number;
  subject: string;
  html: string;
  status: "draft" | "sent" | "failed";
  sentTo?: string;
  error?: string;
}

/** Compile the weekly report, optionally e-mail it (Resend) and record it in `advisor_reports`. */
async function dispatchReport(db: SupabaseClient, competitionId: string, send: boolean): Promise<Dispatched | { error: string; status: number }> {
  const data = await loadCompetitionData(db, competitionId);
  if (!data) return { error: "Kompetisi tidak ditemukan", status: 404 };
  const comp = data.competitions[0];

  const { weekNumber, subject, html } = generateAdvisorReport(data, competitionId, Date.now());
  const base = { competitionId, weekNumber, subject, html };
  if (!send) return { ...base, status: "draft" };
  if (!comp.advisorEmail) return { error: "Email Pembina belum diisi", status: 422 };

  const key = process.env.RESEND_API_KEY;
  let status: Dispatched["status"] = "failed";
  let error: string | undefined;
  if (!key) {
    error = "RESEND_API_KEY belum diatur — laporan hanya disimpan sebagai draf";
    status = "failed";
  } else {
    const leader = data.members.find((m) => m.role === "leader");
    const leaderEmail = data.users.find((u) => u.id === leader?.userId);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.REPORT_FROM ?? "CompeteSync <laporan@competesync.app>",
        to: [comp.advisorEmail],
        cc: [leaderEmail?.emailMicrosoft ?? leaderEmail?.emailGoogle].filter(Boolean),
        reply_to: leaderEmail?.emailMicrosoft ?? leaderEmail?.emailGoogle,
        subject,
        html,
      }),
    });
    if (res.ok) status = "sent";
    else error = `Resend ${res.status}: ${(await res.text()).slice(0, 200)}`;
  }

  // Upsert so a re-send in the same week replaces the previous row instead of violating unique(competition_id, week_number).
  await serviceClient()
    .from("advisor_reports")
    .upsert(
      {
        competition_id: competitionId,
        week_number: weekNumber,
        report_html: html,
        sent_to_email: comp.advisorEmail,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        status,
      },
      { onConflict: "competition_id,week_number" },
    );

  return { ...base, status, sentTo: comp.advisorEmail, error };
}

/**
 * POST /api/advisor-report   { competitionId: string, send?: boolean }
 * Leader only. `send: false` (default) returns the HTML preview; `send: true` e-mails the advisor.
 */
export async function POST(req: NextRequest) {
  const caller = await authenticate(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { competitionId, send = false } = (await req.json().catch(() => ({}))) as { competitionId?: string; send?: boolean };
  if (!competitionId) return NextResponse.json({ error: "competitionId wajib diisi" }, { status: 400 });

  const { data: membership } = await caller.db
    .from("competition_members")
    .select("role")
    .eq("competition_id", competitionId)
    .eq("user_id", caller.user.id)
    .single();
  if (!membership) return NextResponse.json({ error: "Bukan anggota kompetisi ini" }, { status: 403 });
  if (send && membership.role !== "leader") return NextResponse.json({ error: "Hanya Ketua yang dapat mengirim laporan" }, { status: 403 });

  const out = await dispatchReport(caller.db, competitionId, send);
  if ("status" in out && typeof out.status === "number") return NextResponse.json({ error: (out as { error: string }).error }, { status: out.status });
  return NextResponse.json(out, { status: (out as Dispatched).status === "failed" ? 502 : 200 });
}

/**
 * GET /api/advisor-report — weekly cron (e.g. Vercel Cron "0 1 * * 1" = Monday 08:00 WIB).
 * Authorization: Bearer <CRON_SECRET>. Sends one report per active competition using the service role.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = serviceClient();
  const { data: comps } = await admin.from("competitions").select("id").eq("status", "active").not("advisor_email", "is", null);
  const results = [];
  for (const c of comps ?? []) {
    const r = await dispatchReport(admin, c.id, true);
    results.push("status" in r && typeof r.status === "string" ? { id: c.id, status: r.status, error: (r as Dispatched).error } : { id: c.id, status: "failed", error: (r as { error: string }).error });
  }
  return NextResponse.json({ processed: results.length, results });
}
