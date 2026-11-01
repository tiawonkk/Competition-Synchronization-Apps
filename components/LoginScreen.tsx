"use client";

import { CalendarCheck, Eye, EyeOff, Loader2, Mail, Moon, Sun, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { captureJoinHash, peekPendingJoin, type PendingJoin } from "@/lib/join-link";
import { uid, userEmail } from "@/lib/logic";
import { hashPassword, isEmail, randomSalt } from "@/lib/passwords";
import { AVATAR_COLORS } from "@/lib/seed";
import { useStore } from "@/lib/store";

type Mode = "login" | "register";

const POINTS = [
  { icon: CalendarCheck, bg: "#ECE6FF", fg: "#3B1D8F", title: "Bebas Bentrok Jadwal", text: "Jadwal beberapa lomba dalam satu tempat, lengkap dengan peringatan bentrok otomatis." },
  { icon: Users, bg: "#DCFCE7", fg: "#14532D", title: "Kolaborasi Tim & Ideasi", text: "Ajak tim lewat kode undangan, bagi tugas, dan coret ide bersama di whiteboard." },
  { icon: Mail, bg: "#FEF4C7", fg: "#78350F", title: "Laporan Pembina Otomatis", text: "Laporan mingguan untuk Pembina tersusun otomatis dari progres tim." },
];

/** Email + password sign-in and sign-up. Accounts live in this browser's storage; passwords are stored only as salted hashes. */
export default function LoginScreen() {
  const { data, dispatch } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(false);
  const [invite, setInvite] = useState<PendingJoin | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    captureJoinHash();
    setInvite(peekPendingJoin());
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("cs-theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setPassword("");
    setConfirm("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!isEmail(mail)) return setError("Masukkan alamat email yang valid.");
    if (mode === "register") {
      if (!name.trim()) return setError("Nama lengkap wajib diisi.");
      if (password.length < 8) return setError("Kata sandi minimal 8 karakter.");
      if (password !== confirm) return setError("Konfirmasi kata sandi tidak sama.");
      if (data.users.some((u) => userEmail(u).toLowerCase() === mail)) return setError("Email ini sudah terdaftar. Silakan masuk.");
    } else if (!password) {
      return setError("Masukkan kata sandi.");
    }

    setBusy(true);
    try {
      if (mode === "register") {
        const salt = randomSalt();
        dispatch({
          type: "register",
          user: {
            id: uid("u"),
            fullName: name.trim().replace(/\s+/g, " "),
            email: mail,
            // The address also enables the matching calendar integration (Outlook for Binus, Google for Gmail).
            ...(mail.endsWith("binus.ac.id") ? { emailMicrosoft: mail } : {}),
            ...(mail.endsWith("@gmail.com") ? { emailGoogle: mail } : {}),
            color: AVATAR_COLORS[data.users.length % AVATAR_COLORS.length],
            salt,
            passwordHash: await hashPassword(password, salt),
          },
        });
        return;
      }
      const user = data.users.find((u) => userEmail(u).toLowerCase() === mail);
      const ok = !!user?.salt && (await hashPassword(password, user.salt)) === user.passwordHash;
      if (!user || !ok) return setError("Email atau kata sandi salah.");
      dispatch({ type: "login", userId: user.id });
    } catch {
      setError("Browser ini tidak mendukung penyimpanan akun yang aman. Buka lewat https atau localhost.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-[1480px] p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-6">
      <section className="relative hidden flex-col justify-between overflow-hidden rounded-[36px] bg-[#141416] p-12 text-[#ffffff] lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ffffff] text-[#141416]">
            <Trophy size={20} />
          </span>
          <span className="text-lg font-bold tracking-tight">CompeteSync</span>
        </div>
        <div className="my-auto py-8">
          <span className="inline-block rounded-full bg-[#ece6ff] px-3.5 py-1 text-xs font-bold text-[#3b1d8f]">
            Manajemen Kompetisi Mahasiswa
          </span>
          <h2 className="mt-4 max-w-md text-4xl font-extrabold leading-tight tracking-tight text-[#ffffff]">
            Ikut banyak lomba tanpa kewalahan.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, bg, fg, title, text }) => (
              <li key={title} className="flex max-w-md items-start gap-4 rounded-[24px] bg-[#ffffff]/[0.06] p-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: bg, color: fg }}>
                  <Icon size={18} />
                </span>
                <div>
                  <div className="text-sm font-bold text-[#ffffff]">{title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-[#ffffff]/70">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-[#ffffff]/45">Dirancang untuk tim mahasiswa yang aktif berkompetisi.</p>
      </section>

      <section className="relative grid place-items-center px-4 py-10">
        <button className="btn-ghost absolute right-4 top-4 !h-10 !w-10 !p-0" onClick={toggleTheme} aria-label={dark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}>
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="card w-full max-w-md p-7 sm:p-9">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#141416] text-[#ffffff] dark:bg-[#f4f4f6] dark:text-[#141416]">
              <Trophy size={18} />
            </span>
            <span className="text-lg font-bold tracking-tight">CompeteSync</span>
          </div>

          {invite && (
            <p role="status" className="mb-5 rounded-2xl bg-[#ece6ff] px-4 py-3 text-xs font-medium text-[#3b1d8f] dark:bg-[#251f38] dark:text-[#c4b5fd]">
              Kamu diundang bergabung ke sebuah lomba (kode <strong className="font-mono tracking-wider">{invite.code}</strong>). Masuk atau daftar dulu, lalu jendela gabung terbuka otomatis.
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{mode === "login" ? "Selamat datang kembali" : "Buat akun baru"}</h1>
          <p className="mt-1.5 text-sm text-white/55">
            {mode === "login" ? "Masuk untuk melanjutkan ke ruang lomba Anda." : "Gratis dan siap dipakai bersama tim dalam satu menit."}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-full border border-[#e4e2dc] bg-[#efede7] p-1.5 dark:border-white/10 dark:bg-[#202024]" role="tablist">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`rounded-full py-2 text-sm font-semibold transition ${
                  mode === m
                    ? "bg-[#141416] text-[#ffffff] shadow-sm dark:bg-[#f4f4f6] dark:text-[#141416]"
                    : "text-[#52525b] hover:text-[#141416] dark:text-[#a1a1aa] dark:hover:text-[#f4f4f6]"
                }`}
              >
                {m === "login" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {mode === "register" && (
              <div>
                <label className="label" htmlFor="a-name">Nama lengkap</label>
                <input id="a-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Budi Santoso" autoComplete="name" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="a-email">Email</label>
              <input
                id="a-email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="nama@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label" htmlFor="a-pass">Kata sandi</label>
              <div className="relative">
                <input
                  id="a-pass"
                  type={show ? "text" : "password"}
                  className="field !pr-10"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder={mode === "register" ? "Minimal 8 karakter" : "Kata sandi Anda"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white"
                  aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {mode === "register" && (
              <div>
                <label className="label" htmlFor="a-confirm">Ulangi kata sandi</label>
                <input id="a-confirm" type={show ? "text" : "password"} className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-2xl bg-[#fce4ec] px-4 py-3 text-xs font-medium text-[#881337] dark:bg-[#331924] dark:text-[#fda4af]">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary w-full !py-3 text-sm" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === "login" ? "Masuk" : "Buat Akun"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/60">
            {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
            <button className="font-bold text-white hover:underline" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Daftar" : "Masuk"}
            </button>
          </p>
          <p className="mt-5 text-center text-xs leading-relaxed text-white/40">
            Akun dan data tersimpan di browser ini. Kata sandi disimpan sebagai hash, bukan teks asli.
          </p>
        </div>
      </section>
    </main>
  );
}
