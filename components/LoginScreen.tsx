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
  { icon: CalendarCheck, text: "Jadwal beberapa lomba dalam satu tempat, lengkap dengan peringatan bentrok." },
  { icon: Users, text: "Ajak tim lewat kode undangan, bagi tugas, dan coret ide bersama di whiteboard." },
  { icon: Mail, text: "Laporan mingguan untuk Pembina tersusun otomatis dari progres tim." },
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
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="sidebar-dark relative hidden flex-col justify-between overflow-hidden bg-[#1c1c20] p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f6efd9] text-[#1c1c20]">
            <Trophy size={21} />
          </span>
          <span className="text-lg font-bold">CompeteSync</span>
        </div>
        <div>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">Ikut banyak lomba tanpa kewalahan.</h2>
          <ul className="mt-8 space-y-5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex max-w-md items-start gap-3.5 text-[15px] leading-relaxed text-white/70">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#f6efd9]">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">Untuk mahasiswa yang berkompetisi bersama tim.</p>
      </section>

      <section className="relative grid place-items-center px-5 py-12">
        <button className="btn-ghost absolute right-4 top-4 !px-2.5" onClick={toggleTheme} aria-label={dark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}>
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="w-full max-w-sm">
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1c1c20] text-[#f6efd9]">
              <Trophy size={19} />
            </span>
            <span className="text-lg font-bold">CompeteSync</span>
          </div>

          {invite && (
            <p role="status" className="mb-4 rounded-2xl bg-active/10 px-4 py-3 text-sm text-active">
              Kamu diundang bergabung ke sebuah lomba (kode <strong className="font-mono tracking-wider">{invite.code}</strong>). Masuk atau daftar dulu, lalu jendela gabung terbuka otomatis.
            </p>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight">{mode === "login" ? "Selamat datang kembali" : "Buat akun baru"}</h1>
          <p className="mt-1.5 text-sm text-white/60">
            {mode === "login" ? "Masuk untuk melanjutkan ke lomba Anda." : "Gratis dan siap dipakai dalam satu menit."}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-white/[0.06] p-1" role="tablist">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`rounded-full py-2 text-sm font-semibold transition ${mode === m ? "bg-surface text-white shadow-sm" : "text-white/55 hover:text-white"}`}
              >
                {m === "login" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/45 hover:text-white"
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
              <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary w-full !py-3 text-[15px]" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === "login" ? "Masuk" : "Buat akun"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/60">
            {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
            <button className="font-semibold text-active hover:underline" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Daftar" : "Masuk"}
            </button>
          </p>
          <p className="mt-6 text-center text-xs leading-relaxed text-white/40">
            Akun dan data tersimpan di browser ini. Kata sandi disimpan sebagai hash, bukan teks asli.
          </p>
        </div>
      </section>
    </main>
  );
}
