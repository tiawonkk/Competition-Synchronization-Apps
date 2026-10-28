# CompeteSync

Aplikasi PWA untuk mahasiswa yang mengikuti beberapa kompetisi sekaligus (Hackathon, CTF, UI/UX, Business Case). CompeteSync membantu tim menghindari bentrok jadwal, menjaga akuntabilitas lewat alarm yang terus berbunyi sampai tugas dikonfirmasi, dan melapor ke Pembina secara otomatis.

> **Status:** prototipe interaktif yang berjalan penuh di browser. Data (akun, lomba, tugas, whiteboard) disimpan di `localStorage`, jadi bertahan setelah refresh tetapi **hanya ada di browser itu**. Skema Supabase, rute API, dan helper login sudah ditulis tetapi **belum tersambung ke UI** (lihat [Roadmap](#roadmap)).

## Fitur

| Fitur | Keterangan |
|---|---|
| **Akun & Login** | Daftar dengan nama, email, dan kata sandi (minimal 8 karakter), lalu masuk kembali kapan saja dengan email yang sama. Kata sandi disimpan sebagai hash PBKDF2 di browser, bukan teks asli. Di mode demo, akun hanya ada di browser itu; login lintas perangkat menunggu Supabase Auth. |
| **Buat Lomba & Gabung via Kode** | Ketua membuat lomba (kategori, tema, deadline, email Pembina, folder OneDrive/Drive) dan mendapat kode undangan otomatis, misalnya `HACK-88`. Anggota lain memasukkan kode dan memilih peran tim; batas 5 anggota ditegakkan. Tombol AI membuat milestone dan tugas, termasuk poin dari guidebook yang ditempel. Email/nama Pembina, tema, dan folder Drive opsional dan bisa dilengkapi nanti lewat **Ubah Detail**. |
| **AI Rescheduler** | Satu klik memindahkan tugas internal yang bentrok (deadline final tidak digeser) ke hari kosong terdekat, lalu menulis log pembaruan kalender. |
| **Radar Bentrok Jadwal** | Mendeteksi tenggat berat (prioritas Tinggi/Kritis dan deadline final) dari kompetisi berbeda dalam jendela 48 jam, lengkap dengan saran memajukan jadwal internal. |
| **Skor Kesiapan** | 0–100% per kompetisi: 70% rasio tugas selesai + 30% rasio deliverable bertautan bukti, dibobot menurut prioritas. |
| **Alarm Berdering (Stop-on-Confirm)** | Alarm Web Audio API (tanpa file MP3) untuk tugas yang jatuh tempo < 24 jam atau terlambat. Hanya berhenti setelah tugas ditandai selesai dengan tautan bukti OneDrive/Google Drive. |
| **Ruang Kerja Tim** | 3–5 anggota dengan peran Ketua/Anggota/Pembina, lencana akun Gmail dan M365 Binus, milestone, daftar tugas dengan filter penanggung jawab. |
| **Whiteboard & Ideasi** | Kanvas yang bisa digeser dan di-zoom: catatan tempel berwarna (Ide Utama, Fitur, Riset, Kendala), pena bebas, penghapus, voting +1, dan tombol **⚡ Jadikan Tugas** yang langsung membuat tugas dan menghitung ulang skor kesiapan. |
| **Alur Babak (Kualifikasi → Semifinal → Final)** | Tiap lomba punya babak berurutan yang bisa diubah dan ditambah (mis. Pra-Kualifikasi, Bootcamp). Hanya babak aktif yang punya tugas; babak berikutnya terkunci. Saat hasil diumumkan, Ketua menekan **Lolos** (babak berikutnya terbuka dan tugasnya dibuat otomatis, Pembina mendapat email pembaruan) atau **Gugur** (pengingat tersisa dibatalkan dan form evaluasi terbuka). |
| **Selesai & Evaluasi (Post-Mortem)** | Catat hasil (Juara 1–3, Harapan, Finalis, gugur), peringkat, skor, sertifikat, dan arsip karya, lalu isi evaluasi tim: hal yang berjalan baik, kendala, dan masukan juri. Tombol analisis membaca keterlambatan tugas, pembagian beban, dan catatan tim untuk memberi saran (berbasis aturan, tanpa model eksternal). Laporan Akhir Pertanggungjawaban dapat dikirim ke Pembina. |
| **Riwayat & Evaluasi** | Halaman portofolio: win rate, persentase capai final, tugas selesai telat, daftar lomba dengan perjalanan babaknya, dan pencarian pelajaran dari semua evaluasi. |
| **Baca Guidebook (PDF/teks)** | Teks PDF dibaca di browser halaman demi halaman (ukuran file tidak dibatasi), lalu Gemini mengambil babak bertanggal, rubrik penilaian, format berkas, aturan, dan tugas. PDF scan dikirim sebagai gambar halaman. |
| **Unggah Berkas Besar** | Zona seret-dan-lepas untuk berkas besar dengan progres per potongan, jeda dan lanjut. **Masih simulasi**: tampilan meniru Supabase TUS (6 MB) dan Microsoft Graph createUploadSession (10 MiB), tetapi isi berkas belum dikirim ke mana pun. |
| **Kalender Kompetisi** | Kalender bulanan dan mingguan (grid waktu) lintas semua lomba di Beranda, dengan pil agenda berlabel lomba, filter per lomba, penanda hari padat atau bentrok, dan panel hari berisi aksi Selesai, Edit, Hapus, serta tambah pekerjaan. Di halaman lomba ada kalender mini dengan penanda warna dan filter tanggal. |
| **Tim & Pembina** | Kartu anggota dengan peran yang bisa diubah, lencana kalender terhubung, dan tombol keluarkan anggota (Ketua). Undangan berupa kode dan pesan siap kirim (tidak ada email otomatis). Kartu Pembina bisa diatur langsung dan punya pintasan Kirim Laporan. |
| **Cloud Vault** | Tab khusus untuk tautan folder dan berkas (guidebook, diagram, pitch deck, ZIP) di OneDrive Pro dan Google Drive, dengan filter penyimpanan dan validasi tautan. |
| **Laporan Pembina** | Pratinjau laporan formal berbahasa Indonesia (capaian, kontribusi anggota, rencana 7 hari, ide terpopuler, tautan dokumen), tombol kirim, riwayat pengiriman, dan saklar Auto-Send setiap Minggu 19:00 WIB. Hanya Ketua yang dapat mengirim. Pengiriman di mode demo hanya simulasi. |
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

Buka http://localhost:3000 (atau port yang ditampilkan terminal). Aplikasi berjalan tanpa data bawaan; tidak perlu Supabase untuk mencoba UI. Aplikasi mulai kosong: daftar akun, buat lomba, lalu undang teman dengan kode. Menu profil → **Hapus semua data** mengosongkan data di browser.

Cara mencoba alur utama:

1. Daftar akun baru, buat dua lomba dengan deadline berdekatan, lalu klik **Optimasi Jadwal Bentrok (AI Rescheduler)** pada Radar Bentrok di **Beranda**.
2. Klik **Aktifkan Alarm** di header. Alarm berbunyi untuk tugas "Finalisasi user flow & IA", lalu pilih **Konfirmasi Selesai** dan tempel tautan Google Drive/OneDrive. Suara berhenti dan skor kesiapan naik.
3. Buka kompetisi **Hackathon Nasional AI** → tab **Whiteboard & Ideasi** → tekan **⚡ Jadikan Tugas** pada sebuah catatan.
4. Buat lomba baru lewat **Buat Lomba Baru**, catat kode undangannya, **Keluar**, daftar akun baru, lalu **Gabung Lomba** dengan kode itu.
5. Buka **Laporan Pembina** di header kompetisi untuk pratinjau dan simulasi kirim.

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
  seed.ts / store.tsx           Tipe data, konstanta, dan dataset kosong awal; state aplikasi
  report.ts / generator.ts      Pembuat laporan HTML dan jadwal AI
  integrations/                 Kalender, Supabase server, Realtime whiteboard
  auth-and-sync.ts              Helper login Google/Microsoft (Supabase) dan sinkron tugas
supabase/
  schema.sql                    Tabel inti, RLS, trigger skor kesiapan
  schema_phase2.sql             Whiteboard, Realtime, asal-usul tugas
  schema_phase3.sql             Kode undangan, peran tim, Cloud Vault, fungsi join_competition
  schema_stages_and_eval.sql    Babak lomba, evaluasi post-mortem, metadata unggahan berpotongan, bucket vault
  schema_fix_join.sql           Gabung lewat kode: pencocokan toleran, anggota lama tidak error, tanpa masalah RLS
```

## Menyiapkan Supabase

1. Di **SQL Editor** jalankan berurutan: `supabase/schema.sql`, `supabase/schema_phase2.sql`, `supabase/schema_phase3.sql`, lalu `supabase/schema_stages_and_eval.sql`, lalu `supabase/schema_fix_join.sql`.
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
| `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT_ID` | Microsoft Graph (`Calendars.ReadWrite offline_access`). **Opsional**: banyak tenant kampus memblokir persetujuan aplikasi pihak ketiga. |
| `RESEND_API_KEY`, `REPORT_FROM` | Pengiriman email laporan |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Pembaca guidebook PDF (kunci gratis dari Google AI Studio). `GEMINI_MODEL` opsional; model yang tidak tersedia (404) dilewati otomatis |
| `CRON_SECRET` | Melindungi endpoint cron laporan mingguan |

## Rute API

Semua rute memerlukan header `Authorization: Bearer <access token Supabase>`.

- `POST /api/sync-task` dengan `{ "taskId": "..." }` membuat atau memperbarui event di kalender penanggung jawab (popup + email di Google; satu popup di Outlook, karena Graph tidak mendukung pengingat email per event). Jika tugas sudah selesai, pengingat di kedua kalender dimatikan.
- `POST /api/advisor-report` dengan `{ "competitionId": "...", "send": false }` mengembalikan pratinjau HTML. Dengan `send: true` (khusus Ketua) laporan dikirim ke `advisor_email` dan dicatat di `advisor_reports`.
- `GET /api/advisor-report` dengan `Authorization: Bearer <CRON_SECRET>` mengirim laporan untuk kompetisi aktif yang menyalakan Auto-Send (`auto_send_weekly`). Jadwal cron: `0 12 * * 0` (Minggu 19:00 WIB).
- `POST /api/auth/tokens` dengan `{ provider, refreshToken, email }` menyimpan refresh token penyedia milik pemanggil.
- `POST /api/guidebook` (multipart `text` hasil ekstraksi PDF di browser, atau `file` PDF scan maks. 4 MB) membaca guidebook dengan Gemini dan mengembalikan tahapan bertanggal serta daftar tugas. Isi dibersihkan dan dibatasi sebelum dikirim ke klien, dan permintaan dibatasi per IP.

## Deploy ke Vercel

1. Push repo ke GitHub.
2. Di Vercel: **Add New → Project**, impor repo ini (Next.js terdeteksi otomatis).
3. Isi environment variables di atas, lalu **Deploy**.
4. Tambahkan domain Vercel ke **Authentication → URL Configuration** di Supabase.

## Roadmap

- [ ] Sambungkan `LoginScreen` ke `lib/auth-and-sync.ts` (Supabase Auth Google/Microsoft) menggantikan akun demo
- [ ] Ganti penyimpanan `localStorage` dengan query Supabase; panggil `/api/sync-task`, `/api/advisor-report`, dan `join_competition` dari UI
- [ ] Sambungkan whiteboard ke Supabase Realtime (`lib/integrations/whiteboard-realtime.ts` sudah siap)
- [ ] Service worker untuk notifikasi push saat aplikasi ditutup
- [ ] Generator jadwal berbasis LLM
- [ ] `vercel.json` untuk cron laporan mingguan

## Catatan keamanan

- Token refresh Google/Microsoft sebaiknya dienkripsi (Supabase Vault) di produksi.
- Tautan bukti hanya menerima `https` dari Google Drive, OneDrive, SharePoint, dan domain Binus.
- Rute API belum diuji terhadap layanan sungguhan.
