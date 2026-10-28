"use client";

import { Cloud, Mail, Moon, ShieldCheck, Sun, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { uid } from "@/lib/logic";
import { AVATAR_COLORS } from "@/lib/seed";
import { useStore } from "@/lib/store";

/** Sign-in screen: Microsoft 365 / Google buttons, with sign-up for new accounts. */
export default function LoginScreen() {
  const { data, dispatch } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
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

  function signIn(provider: "microsoft" | "google") {
    const mail = email.trim().toLowerCase();
    const fullName = name.trim();
    if (!mail) {
      setError("Isi email Anda terlebih dahulu.");
      return;
    }
    if (provider === "microsoft" && !mail.endsWith("@binus.ac.id")) {
      setError("Akun Microsoft 365 harus memakai email @binus.ac.id.");
      return;
    }
    if (provider === "google" && !mail.endsWith("@gmail.com")) {
      setError("Akun Google harus memakai email @gmail.com.");
      return;
    }
    const existing = data.users.find((u) => u.emailGoogle === mail || u.emailMicrosoft === mail);
    if (existing) {
      dispatch({ type: "login", userId: existing.id });
      return;
    }
    if (!fullName) {
      setError("Akun baru terdeteksi. Isi nama lengkap untuk mendaftar.");
      return;
    }
    dispatch({
      type: "register",
      user: {
        id: uid("u"),
        fullName,
        color: AVATAR_COLORS[data.users.length % AVATAR_COLORS.length],
        ...(provider === "microsoft" ? { emailMicrosoft: mail } : { emailGoogle: mail }),
      },
    });
  }

  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-10">
      <button
        className="btn-ghost absolute right-4 top-4 !px-2.5"
        onClick={toggleTheme}
        aria-label={dark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
      >
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <div className="glass w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-active text-[#fff] shadow-sm">
            <Trophy size={24} />
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">CompeteSync</h1>
          <p className="mt-1 text-sm text-white/60">Masuk untuk mengelola lomba, jadwal, dan laporan Pembina Anda.</p>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="label" htmlFor="l-name">Nama lengkap (khusus akun baru)</label>
            <input id="l-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Budi Santoso" autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="l-email">Email</label>
            <input
              id="l-email"
              type="email"
              className="field"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="nama@binus.ac.id atau nama@gmail.com"
              autoComplete="email"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <button className="btn-primary w-full !justify-start !gap-3 !py-3" onClick={() => signIn("microsoft")}>
            <Mail size={18} />
            <span className="text-left">
              <span className="block text-sm font-semibold leading-tight">Masuk dengan Microsoft 365 (@binus.ac.id)</span>
              <span className="block text-[11px] font-normal opacity-80">Otomatis menghubungkan Outlook Calendar &amp; OneDrive Pro</span>
            </span>
          </button>
          <button className="btn-ghost w-full !justify-start !gap-3 !py-3" onClick={() => signIn("google")}>
            <Cloud size={18} className="text-safe" />
            <span className="text-left">
              <span className="block text-sm font-semibold leading-tight">Masuk dengan Google (@gmail.com)</span>
              <span className="block text-[11px] font-normal text-white/55">Otomatis menghubungkan Google Calendar, Gmail &amp; Google Drive</span>
            </span>
          </button>
        </div>

        <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-white/45">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          Mode demo: data tersimpan di browser ini. Keluar tidak menghapus data; masuk lagi dengan email yang sama untuk melanjutkan.
        </p>
      </div>
    </main>
  );
}
