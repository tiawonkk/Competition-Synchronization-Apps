# CompeteSync

Aplikasi PWA untuk mahasiswa yang mengikuti beberapa kompetisi sekaligus (Hackathon, CTF, UI/UX, Business Case). CompeteSync membantu tim menghindari bentrok jadwal, menjaga akuntabilitas lewat alarm yang terus berbunyi sampai tugas dikonfirmasi, dan melapor ke Pembina secara otomatis.

> **Status:** prototipe interaktif (Phase 1–2). UI berjalan penuh dengan data dummy di memori. Skema database dan rute API sudah ditulis tetapi **belum tersambung ke UI** (lihat [Roadmap](#roadmap)).

## Fitur

| Fitur | Keterangan |
|---|---|
| **Radar Bentrok Jadwal** | Mendeteksi tenggat berat (prioritas Tinggi/Kritis dan deadline final) dari kompetisi berbeda dalam jendela 48 jam, lengkap dengan saran memajukan jadwal internal. |
| **Skor Kesiapan** | 0–100% per kompetisi: 70% rasio tugas selesai + 30% rasio deliverable bertautan bukti, dibobot menurut prioritas. |
| **Alarm Berdering (Stop-on-Confirm)** | Alarm Web Audio API (tanpa file MP3) untuk tugas yang jatuh tempo < 24 jam atau terlambat. Hanya berhenti setelah tugas ditandai selesai dengan tautan bukti OneDrive/Google Drive. |
| **Ruang Kerja Tim** | 3–5 anggota dengan peran Ketua/Anggota/Pembina, lencana akun Gmail dan M365 Binus, milestone, daftar tugas dengan filter penanggung jawab. |
| **Whiteboard & Ideasi** | Kanvas yang bisa digeser dan di-zoom: catatan tempel berwarna (Ide Utama, Fitur, Riset, Kendala), pena bebas, penghapus, voting +1, dan tombol **⚡ Jadikan Tugas** yang langsung membuat tugas dan menghitung ulang skor kesiapan. |
| **Brankas Cloud** | Tautan folder dan dokumen (guidebook, diagram, pitch deck, ZIP) di OneDrive Pro dan Google Drive. |
| **Laporan Pembina** | Pratinjau laporan formal berbahasa Indonesia (capaian, kontribusi anggota, rencana 7 hari, ide terpopuler, tautan dokumen) dengan aksi kirim email. |
| **Generator Jadwal AI** | Membuat milestone mingguan dan tugas dari nama kompetisi, kategori, tema, dan deadline (berbasis templat, bukan LLM). |
| **Tema Terang/Gelap** | Default terang; pilihan tersimpan. Sidebar desktop dapat diciutkan, navigasi bawah di mobile. |

## Teknologi

- Next.js 14 (App Router), TypeScript, React 18
- Tailwind CSS (token tema lewat CSS variables), Framer Motion, Lucide Icons
- Supabase (PostgreSQL, Auth Google/Azure AD, Realtime)
- Google Calendar API, Microsoft Graph API, Resend (email)

## Menjalankan secara lokal

Prasyarat: Node.js 18+.

```bash
npm install
npm run dev
```

Buka http://localhost:3000. Aplikasi langsung berjalan dengan data dummy; tidak perlu Supabase untuk mencoba UI.

Cara mencoba alur utama:

1. Klik **Aktifkan Alarm** di header. Alarm berbunyi untuk tugas "Finalisasi user flow & IA", lalu pilih **Konfirmasi Selesai** dan tempel tautan Google Drive/OneDrive. Suara berhenti dan skor kesiapan naik.
2. Buka kompetisi **Hackathon Nasional AI** → tab **Whiteboard & Ideasi** → tekan **⚡ Jadikan Tugas** pada sebuah catatan.
3. Buka **Laporan Pembina** di header kompetisi untuk pratinjau dan simulasi kirim.

Perintah lain: `npm run typecheck`, `npm run build`, `npm run start`.

## Struktur proyek

```
app/
  api/sync-task/route.ts        Sinkron tugas ke Google Calendar / Outlook (+ matikan pengingat saat selesai)
  api/advisor-report/route.ts   Susun dan kirim laporan Pembina (POST) + cron mingguan (GET)
components/
  CompeteSyncApp.tsx            Shell: tema, sidebar, bottom bar, modal global
  Dashboard.tsx                 Beranda, radar bentrok, timeline lintas kompetisi
  Workspace.tsx / Whiteboard.tsx
  modals/                       Alarm, konfirmasi selesai, laporan, generator AI
lib/
  logic.ts                      Skor kesiapan, deteksi bentrok, format tanggal
  alarm.ts                      Alarm Web Audio API + notifikasi browser
  seed.ts / store.tsx           Data dummy dan state aplikasi
  report.ts / generator.ts      Pembuat laporan HTML dan jadwal AI
  integrations/                 Kalender, Supabase server, Realtime whiteboard
supabase/
  schema.sql                    Tabel inti, RLS, trigger skor kesiapan
  schema_phase2.sql             Whiteboard, Realtime, asal-usul tugas
```

## Menyiapkan Supabase

1. Di **SQL Editor** jalankan `supabase/schema.sql`, lalu `supabase/schema_phase2.sql`.
2. Di **Authentication → Providers** aktifkan Google dan Azure (Microsoft) bila diperlukan.
3. Salin Project URL, `anon` key, dan `service_role` key dari **Project Settings → API**.

Skema mencakup: trigger yang menghitung ulang `competitions.readiness_score` tiap tugas berubah, constraint agar tugas hanya bisa selesai bila ada `proof_url`, batas 5 anggota per tim, RLS per kompetisi, dan penjaga agar anggota hanya bisa mengubah suaranya sendiri di whiteboard.

## Variabel lingkungan

Salin `.env.example` menjadi `.env.local` dan isi:

| Variabel | Fungsi |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Klien Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Hanya server; membaca token OAuth dan menulis laporan. **Jangan pernah di-commit.** |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Calendar (scope `calendar.events`, `access_type=offline`) |
| `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT_ID` | Microsoft Graph (`Calendars.ReadWrite offline_access`) |
| `RESEND_API_KEY`, `REPORT_FROM` | Pengiriman email laporan |
| `CRON_SECRET` | Melindungi endpoint cron laporan mingguan |

## Rute API

Semua rute memerlukan header `Authorization: Bearer <access token Supabase>`.

- `POST /api/sync-task` dengan `{ "taskId": "..." }` membuat atau memperbarui event di kalender penanggung jawab (popup + email di Google; satu popup di Outlook, karena Graph tidak mendukung pengingat email per event). Jika tugas sudah selesai, pengingat di kedua kalender dimatikan.
- `POST /api/advisor-report` dengan `{ "competitionId": "...", "send": false }` mengembalikan pratinjau HTML. Dengan `send: true` (khusus Ketua) laporan dikirim ke `advisor_email` dan dicatat di `advisor_reports`.
- `GET /api/advisor-report` dengan `Authorization: Bearer <CRON_SECRET>` mengirim laporan untuk semua kompetisi aktif (untuk cron mingguan).

## Deploy ke Vercel

1. Push repo ke GitHub.
2. Di Vercel: **Add New → Project**, impor repo ini (Next.js terdeteksi otomatis).
3. Isi environment variables di atas, lalu **Deploy**.
4. Tambahkan domain Vercel ke **Authentication → URL Configuration** di Supabase.

## Roadmap

- [ ] Login Supabase Auth (Google dan Microsoft) dan penyimpanan token refresh
- [ ] Ganti data dummy dengan query Supabase; panggil `/api/sync-task` dan `/api/advisor-report` dari UI
- [ ] Sambungkan whiteboard ke Supabase Realtime (`lib/integrations/whiteboard-realtime.ts` sudah siap)
- [ ] Service worker untuk notifikasi push saat aplikasi ditutup
- [ ] Generator jadwal berbasis LLM
- [ ] `vercel.json` untuk cron laporan mingguan

## Catatan keamanan

- Token refresh Google/Microsoft sebaiknya dienkripsi (Supabase Vault) di produksi.
- Tautan bukti hanya menerima `https` dari Google Drive, OneDrive, SharePoint, dan domain Binus.
- Rute API belum diuji terhadap layanan sungguhan.
