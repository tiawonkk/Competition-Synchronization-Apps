import { computeReadiness, DAY, fmtDateTime, fmtLong, PRIORITY_LABEL } from "./logic";
import { OUTCOME_LABEL, STAGE_STATUS_LABEL } from "./evaluation";
import type { AppData } from "./seed";
import type { Evaluation } from "./types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface GeneratedReport {
  weekNumber: number;
  subject: string;
  html: string;
}

/** Builds a formal Indonesian weekly progress report (email-safe inline-styled HTML) for the advisor. */
export function generateAdvisorReport(data: AppData, competitionId: string, now: number): GeneratedReport {
  const comp = data.competitions.find((c) => c.id === competitionId)!;
  const tasks = data.tasks.filter((t) => t.competitionId === competitionId);
  const team = data.members.filter((m) => m.competitionId === competitionId);
  const userName = (id: string | null) => data.users.find((u) => u.id === id)?.fullName ?? "Belum ditugaskan";
  const readiness = computeReadiness(tasks);
  const weekNumber = Math.max(1, Math.floor((now - new Date(comp.startDate).getTime()) / (7 * DAY)) + 1);

  const done = tasks.filter((t) => t.isCompleted);
  const doneThisWeek = done.filter((t) => t.completedAt && now - new Date(t.completedAt).getTime() <= 7 * DAY);
  const reported = doneThisWeek.length > 0 ? doneThisWeek : done;
  const upcoming = tasks
    .filter((t) => !t.isCompleted && new Date(t.dueDate).getTime() - now <= 7 * DAY)
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  const overdue = tasks.filter((t) => !t.isCompleted && new Date(t.dueDate).getTime() < now);
  const daysLeft = Math.max(0, Math.ceil((new Date(comp.submissionDeadline).getTime() - now) / DAY));

  const contribution = team
    .filter((m) => m.role !== "advisor")
    .map((m) => {
      const mine = tasks.filter((t) => t.assignedTo === m.userId);
      return {
        name: userName(m.userId),
        role: m.role === "leader" ? "Ketua Tim" : "Anggota",
        done: mine.filter((t) => t.isCompleted).length,
        total: mine.length,
      };
    });

  const th = "padding:8px 10px;text-align:left;background:#eef2f7;font-size:12px;color:#334155;border:1px solid #d5dde8;";
  const td = "padding:8px 10px;font-size:13px;color:#0f172a;border:1px solid #d5dde8;vertical-align:top;";
  const h2 = "font-size:15px;color:#0b1b34;margin:22px 0 8px;border-bottom:2px solid #1d4ed8;padding-bottom:4px;";

  const links = [
    comp.onedriveFolderUrl && `<li>OneDrive (Microsoft 365): <a href="${esc(comp.onedriveFolderUrl)}">${esc(comp.onedriveFolderUrl)}</a></li>`,
    comp.gdriveFolderUrl && `<li>Google Drive: <a href="${esc(comp.gdriveFolderUrl)}">${esc(comp.gdriveFolderUrl)}</a></li>`,
  ]
    .filter(Boolean)
    .join("");

  const topIdeas = (data.whiteboard ?? [])
    .filter((e) => e.competitionId === competitionId && e.type === "sticky" && e.votes.length > 0 && e.content.trim())
    .sort((a, b) => b.votes.length - a.votes.length)
    .slice(0, 3);

  const html = `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a;line-height:1.55;background:#ffffff;padding:24px;">
  <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${esc(fmtLong(now))}</p>
  <h1 style="font-size:20px;margin:0 0 14px;color:#0b1b34;">Laporan Progres Mingguan &mdash; ${esc(comp.title)}</h1>
  <p style="margin:0 0 10px;font-size:14px;">Yth. Bapak/Ibu <strong>${esc(comp.advisorName || "Pembina")}</strong>,</p>
  <p style="margin:0 0 10px;font-size:14px;">Dengan hormat, berikut kami sampaikan laporan perkembangan persiapan tim pada <strong>Minggu ke-${weekNumber}</strong> untuk kompetisi <strong>${esc(comp.title)}</strong> (${esc(comp.category)}) dengan tema &ldquo;${esc(comp.theme)}&rdquo;. Batas akhir pengumpulan adalah <strong>${esc(fmtDateTime(comp.submissionDeadline))}</strong> (${daysLeft} hari lagi).</p>

  <h2 style="${h2}">1. Ringkasan Kesiapan</h2>
  <table style="border-collapse:collapse;width:100%;"><tr>
    <td style="${td}width:33%;"><div style="font-size:11px;color:#64748b;">Skor Kesiapan</div><div style="font-size:22px;font-weight:700;color:${readiness >= 70 ? "#047857" : readiness >= 40 ? "#b45309" : "#b91c1c"};">${readiness}%</div></td>
    <td style="${td}width:33%;"><div style="font-size:11px;color:#64748b;">Tugas Selesai</div><div style="font-size:22px;font-weight:700;">${done.length}/${tasks.length}</div></td>
    <td style="${td}width:33%;"><div style="font-size:11px;color:#64748b;">Tugas Terlambat</div><div style="font-size:22px;font-weight:700;color:${overdue.length ? "#b91c1c" : "#047857"};">${overdue.length}</div></td>
  </tr></table>

  <h2 style="${h2}">2. Capaian ${doneThisWeek.length > 0 ? "Minggu Ini" : "Sejauh Ini"}</h2>
  ${
    reported.length === 0
      ? `<p style="font-size:13px;">Belum ada tugas yang diselesaikan pada periode ini.</p>`
      : `<table style="border-collapse:collapse;width:100%;"><tr><th style="${th}">Tugas</th><th style="${th}">Penanggung Jawab</th><th style="${th}">Bukti</th></tr>${reported
          .map(
            (t) =>
              `<tr><td style="${td}">${esc(t.title)}</td><td style="${td}">${esc(userName(t.assignedTo))}</td><td style="${td}">${
                t.proofUrl ? `<a href="${esc(t.proofUrl)}">Tautan bukti</a>` : "&ndash;"
              }</td></tr>`,
          )
          .join("")}</table>`
  }

  <h2 style="${h2}">3. Kontribusi Anggota Tim</h2>
  <table style="border-collapse:collapse;width:100%;"><tr><th style="${th}">Nama</th><th style="${th}">Peran</th><th style="${th}">Tugas Selesai</th></tr>${contribution
    .map((c) => `<tr><td style="${td}">${esc(c.name)}</td><td style="${td}">${c.role}</td><td style="${td}">${c.done} dari ${c.total}</td></tr>`)
    .join("")}</table>

  <h2 style="${h2}">4. Rencana 7 Hari ke Depan</h2>
  ${
    upcoming.length === 0
      ? `<p style="font-size:13px;">Tidak ada tugas jatuh tempo dalam 7 hari ke depan.</p>`
      : `<table style="border-collapse:collapse;width:100%;"><tr><th style="${th}">Tugas</th><th style="${th}">PJ</th><th style="${th}">Tenggat</th><th style="${th}">Prioritas</th></tr>${upcoming
          .map(
            (t) =>
              `<tr><td style="${td}">${esc(t.title)}</td><td style="${td}">${esc(userName(t.assignedTo))}</td><td style="${td}">${esc(
                fmtDateTime(t.dueDate),
              )}</td><td style="${td}">${PRIORITY_LABEL[t.priority]}</td></tr>`,
          )
          .join("")}</table>`
  }
  ${overdue.length ? `<p style="font-size:13px;color:#b91c1c;margin-top:10px;"><strong>Catatan risiko:</strong> terdapat ${overdue.length} tugas yang melewati tenggat dan sedang ditangani sebagai prioritas utama.</p>` : ""}

  <h2 style="${h2}">5. Ide Terpopuler Hasil Brainstorming</h2>
  ${
    topIdeas.length === 0
      ? `<p style="font-size:13px;">Belum ada ide yang dipilih melalui pemungutan suara tim.</p>`
      : `<table style="border-collapse:collapse;width:100%;"><tr><th style="${th}">Ide</th><th style="${th}">Suara</th><th style="${th}">Status</th></tr>${topIdeas
          .map(
            (n) =>
              `<tr><td style="${td}">${esc(n.content)}</td><td style="${td}">${n.votes.length}</td><td style="${td}">${n.taskId ? "Sudah dijadwalkan sebagai tugas" : "Menunggu keputusan tim"}</td></tr>`,
          )
          .join("")}</table>`
  }

  <h2 style="${h2}">6. Repositori Dokumen</h2>
  <ul style="font-size:13px;padding-left:18px;margin:0;">${links || "<li>Belum ada folder yang ditautkan.</li>"}</ul>

  <p style="margin:22px 0 4px;font-size:14px;">Kami mohon arahan dan masukan Bapak/Ibu agar persiapan berikutnya semakin optimal. Atas perhatian dan bimbingannya, kami ucapkan terima kasih.</p>
  <p style="margin:14px 0 0;font-size:14px;">Hormat kami,<br/><strong>Tim ${esc(comp.title)}</strong></p>
  <p style="margin:18px 0 0;font-size:11px;color:#94a3b8;">Laporan ini dihasilkan otomatis oleh CompeteSync.</p>
</div>`.trim();

  return { weekNumber, subject: `[Laporan Progres Minggu ${weekNumber}] ${comp.title} - Skor Kesiapan ${readiness}%`, html };
}

/** Formal "Laporan Akhir Pertanggungjawaban Lomba" for the advisor: outcome, stage-by-stage journey, deliverables and team evaluation. */
export function generateFinalReport(data: AppData, competitionId: string, ev: Evaluation, now: number): { subject: string; html: string } {
  const comp = data.competitions.find((c) => c.id === competitionId)!;
  const tasks = data.tasks.filter((t) => t.competitionId === competitionId);
  const stages = data.stages.filter((s) => s.competitionId === competitionId).sort((a, b) => a.orderIndex - b.orderIndex);
  const team = data.members.filter((m) => m.competitionId === competitionId && m.role !== "advisor");
  const userName = (id: string | null) => data.users.find((u) => u.id === id)?.fullName ?? "Belum ditugaskan";

  const th = "padding:8px 10px;text-align:left;background:#eef2f7;font-size:12px;color:#334155;border:1px solid #d5dde8;";
  const td = "padding:8px 10px;font-size:13px;color:#0f172a;border:1px solid #d5dde8;vertical-align:top;";
  const h2 = "font-size:15px;color:#0b1b34;margin:22px 0 8px;border-bottom:2px solid #1d4ed8;padding-bottom:4px;";
  const para = (text: string) => (text.trim() ? `<p style="font-size:13px;margin:0 0 6px;white-space:pre-line;">${esc(text.trim())}</p>` : `<p style="font-size:13px;color:#64748b;margin:0;">&ndash;</p>`);
  const link = (label: string, url?: string) => (url ? `<a href="${esc(url)}">${esc(label)}</a>` : "&ndash;");

  const journey = stages
    .map((s) => {
      const st = tasks.filter((t) => t.stageId === s.id);
      return `<tr><td style="${td}">${esc(s.name)}</td><td style="${td}">${STAGE_STATUS_LABEL[s.status]}</td><td style="${td}">${esc(fmtDateTime(s.deadline))}</td><td style="${td}">${st.filter((t) => t.isCompleted).length} dari ${st.length}</td></tr>`;
    })
    .join("");

  const contribution = team
    .map((m) => {
      const mine = tasks.filter((t) => t.assignedTo === m.userId);
      return `<tr><td style="${td}">${esc(userName(m.userId))}</td><td style="${td}">${m.role === "leader" ? "Ketua Tim" : "Anggota"}${m.teamRole ? ` &middot; ${esc(m.teamRole)}` : ""}</td><td style="${td}">${mine.filter((t) => t.isCompleted).length} dari ${mine.length}</td></tr>`;
    })
    .join("");

  const html = `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a;line-height:1.55;background:#ffffff;padding:24px;">
  <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${esc(fmtLong(now))}</p>
  <h1 style="font-size:20px;margin:0 0 14px;color:#0b1b34;">Laporan Akhir Pertanggungjawaban Lomba &mdash; ${esc(comp.title)}</h1>
  <p style="margin:0 0 10px;font-size:14px;">Yth. Bapak/Ibu <strong>${esc(comp.advisorName || "Pembina")}</strong>,</p>
  <p style="margin:0 0 10px;font-size:14px;">Dengan hormat, kami menyampaikan laporan akhir keikutsertaan tim pada kompetisi <strong>${esc(comp.title)}</strong> (${esc(comp.category)}).</p>

  <h2 style="${h2}">1. Hasil Akhir</h2>
  <table style="border-collapse:collapse;width:100%;">
    <tr><td style="${td}width:35%;">Capaian</td><td style="${td}"><strong>${esc(OUTCOME_LABEL[ev.outcome])}</strong></td></tr>
    <tr><td style="${td}">Peringkat</td><td style="${td}">${esc(ev.rank || "–")}</td></tr>
    <tr><td style="${td}">Skor akhir</td><td style="${td}">${esc(ev.score || "–")}</td></tr>
    <tr><td style="${td}">Sertifikat</td><td style="${td}">${link("Tautan sertifikat", ev.certificateUrl)}</td></tr>
    <tr><td style="${td}">Arsip karya final</td><td style="${td}">${link("Tautan arsip", ev.archiveUrl)}</td></tr>
  </table>

  <h2 style="${h2}">2. Perjalanan Antar Babak</h2>
  <table style="border-collapse:collapse;width:100%;"><tr><th style="${th}">Babak</th><th style="${th}">Status</th><th style="${th}">Tenggat</th><th style="${th}">Tugas Selesai</th></tr>${journey}</table>

  <h2 style="${h2}">3. Kontribusi Anggota Tim</h2>
  <table style="border-collapse:collapse;width:100%;"><tr><th style="${th}">Nama</th><th style="${th}">Peran</th><th style="${th}">Tugas Selesai</th></tr>${contribution}</table>

  <h2 style="${h2}">4. Evaluasi Tim</h2>
  <p style="font-size:13px;margin:0 0 4px;"><strong>Hal yang berjalan baik</strong></p>${para(ev.wentWell)}
  <p style="font-size:13px;margin:10px 0 4px;"><strong>Kendala dan hal yang kurang maksimal</strong></p>${para(ev.wentWrong)}
  <p style="font-size:13px;margin:10px 0 4px;"><strong>Masukan juri dan pelajaran</strong></p>${para(ev.judgeFeedback)}
  ${
    ev.insights?.length
      ? `<p style="font-size:13px;margin:10px 0 4px;"><strong>Rencana perbaikan untuk lomba berikutnya</strong></p><ul style="font-size:13px;padding-left:18px;margin:0;">${ev.insights.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
      : ""
  }

  <p style="margin:22px 0 4px;font-size:14px;">Atas bimbingan dan dukungan Bapak/Ibu selama proses lomba, kami mengucapkan terima kasih.</p>
  <p style="margin:14px 0 0;font-size:14px;">Hormat kami,<br/><strong>Tim ${esc(comp.title)}</strong></p>
  <p style="margin:18px 0 0;font-size:11px;color:#94a3b8;">Laporan ini dihasilkan otomatis oleh CompeteSync.</p>
</div>`.trim();

  return { subject: `[Laporan Akhir] ${comp.title} - ${OUTCOME_LABEL[ev.outcome]}`, html };
}

/** Short update for the advisor when the team advances to the next round. */
export function generateStageUpdate(comp: { title: string; advisorName: string }, from: string, to: string, taskCount: number, now: number): { subject: string; html: string } {
  const html = `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a;line-height:1.55;background:#ffffff;padding:24px;">
  <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${esc(fmtLong(now))}</p>
  <h1 style="font-size:20px;margin:0 0 14px;color:#0b1b34;">Kabar Baik &mdash; Lolos ke ${esc(to)}</h1>
  <p style="margin:0 0 10px;font-size:14px;">Yth. Bapak/Ibu <strong>${esc(comp.advisorName || "Pembina")}</strong>,</p>
  <p style="margin:0 0 10px;font-size:14px;">Tim kami dinyatakan <strong>lolos dari babak ${esc(from)}</strong> pada kompetisi <strong>${esc(comp.title)}</strong> dan kini memasuki <strong>${esc(to)}</strong>. Sebanyak ${taskCount} tugas baru sudah dijadwalkan untuk babak ini. Mohon doa dan arahan Bapak/Ibu.</p>
  <p style="margin:14px 0 0;font-size:14px;">Hormat kami,<br/><strong>Tim ${esc(comp.title)}</strong></p>
</div>`.trim();
  return { subject: `[Lolos ke ${to}] ${comp.title}`, html };
}
