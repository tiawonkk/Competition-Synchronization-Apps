"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Trash2, UserMinus, X, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Premium in-app replacement for window.confirm:
 * Modern glassmorphic theme, light & dark mode adaptive, animated, keyboard accessible.
 */

export type ConfirmTone = "danger" | "warn" | "safe" | "active";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  /** The item being acted on, displayed as a prominent glass badge. */
  item?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: "trash" | "user" | "check" | "warn";
}

type Ask = (o: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<Ask | null>(null);

const ICONS: Record<NonNullable<ConfirmOptions["icon"]>, LucideIcon> = {
  trash: Trash2,
  user: UserMinus,
  check: CheckCircle2,
  warn: AlertTriangle,
};

const TONES: Record<ConfirmTone, { rgb: string; btn: string; border: string; glow: string; fallback: LucideIcon }> = {
  danger: {
    rgb: "239 68 68",
    btn: "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-red-500/30 hover:brightness-110",
    border: "border-red-500/30",
    glow: "rgba(239, 68, 68, 0.2)",
    fallback: Trash2,
  },
  warn: {
    rgb: "245 158 11",
    btn: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/30 hover:brightness-110",
    border: "border-amber-500/30",
    glow: "rgba(245, 158, 11, 0.2)",
    fallback: AlertTriangle,
  },
  safe: {
    rgb: "16 185 129",
    btn: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/30 hover:brightness-110",
    border: "border-emerald-500/30",
    glow: "rgba(16, 185, 129, 0.2)",
    fallback: CheckCircle2,
  },
  active: {
    rgb: "79 70 229",
    btn: "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-indigo-500/30 hover:brightness-110",
    border: "border-indigo-500/30",
    glow: "rgba(79, 70, 229, 0.2)",
    fallback: CheckCircle2,
  },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const ask = useCallback<Ask>((o) => new Promise<boolean>((resolve) => setReq({ ...o, resolve })), []);

  const close = useCallback(
    (v: boolean) => {
      req?.resolve(v);
      setReq(null);
    },
    [req],
  );

  return (
    <Ctx.Provider value={ask}>
      {children}
      <ConfirmView req={req} onClose={close} />
    </Ctx.Provider>
  );
}

export function useConfirm(): Ask {
  const v = useContext(Ctx);
  return (
    v ??
    ((o) =>
      Promise.resolve(
        window.confirm([o.title, o.item, typeof o.message === "string" ? o.message : ""].filter(Boolean).join("\n")),
      ))
  );
}

function ConfirmView({ req, onClose }: { req: ConfirmOptions | null; onClose: (v: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const tone = TONES[req?.tone ?? "active"];
  const Icon = req?.icon ? ICONS[req.icon] : tone.fallback;
  const destructive = req?.tone === "danger";

  useEffect(() => {
    if (!req) return;
    const t = setTimeout(() => (destructive ? cancelRef : okRef).current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [req, destructive, onClose]);

  return (
    <AnimatePresence>
      {req && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: "none" }}
          transition={{ duration: 0.2 }}
          onClick={() => onClose(false)}
        >
          {/* Frosted Glass Backdrop Overlay */}
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-all" aria-hidden />

          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cf-title"
            aria-describedby="cf-desc"
            className="relative w-full max-w-[430px] overflow-hidden rounded-[28px] border border-slate-200/80 dark:border-white/[0.12] bg-white/95 dark:bg-[#121320]/90 backdrop-blur-2xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.7)] text-slate-900 dark:text-white"
            initial={{ y: 24, opacity: 0, scale: 0.92 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Atmospheric Radial Glow */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-90"
              style={{
                background: `radial-gradient(120% 100% at 50% 0%, ${tone.glow}, transparent 75%)`,
              }}
              aria-hidden
            />

            {/* Close Button */}
            <button
              onClick={() => onClose(false)}
              className="absolute right-3.5 top-3.5 rounded-full p-2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>

            <div className="relative px-6 pb-6 pt-7 text-center">
              {/* Glowing Icon Container */}
              <motion.div
                className="relative mx-auto mb-4 grid h-16 w-16 place-items-center"
                initial={{ scale: 0.5, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.05 }}
              >
                <span
                  className="absolute inset-0 animate-ping rounded-full opacity-25 [animation-duration:2.5s]"
                  style={{ background: `rgb(${tone.rgb})` }}
                  aria-hidden
                />
                <span
                  className="absolute inset-0 rounded-full border"
                  style={{
                    background: `rgb(${tone.rgb} / 0.15)`,
                    borderColor: `rgb(${tone.rgb} / 0.3)`,
                  }}
                  aria-hidden
                />
                <span
                  className="relative grid h-11 w-11 place-items-center rounded-full text-white shadow-lg"
                  style={{
                    background: `rgb(${tone.rgb})`,
                    boxShadow: `0 8px 24px -4px rgb(${tone.rgb} / 0.65)`,
                  }}
                >
                  <Icon size={20} strokeWidth={2.4} />
                </span>
              </motion.div>

              <h2 id="cf-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {req.title}
              </h2>

              {req.item && (
                <div
                  className="mx-auto mt-3 max-w-full truncate rounded-xl border px-3.5 py-2 text-xs font-semibold tracking-wide"
                  style={{
                    borderColor: `rgb(${tone.rgb} / 0.28)`,
                    background: `rgb(${tone.rgb} / 0.08)`,
                    color: `rgb(${tone.rgb})`,
                  }}
                  title={req.item}
                >
                  {req.item}
                </div>
              )}

              {req.message && (
                <p id="cf-desc" className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {req.message}
                </p>
              )}

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  ref={cancelRef}
                  className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-slate-100/80 dark:bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-white/80 hover:bg-slate-200 dark:hover:bg-white/[0.1] hover:text-slate-900 dark:hover:text-white transition-all shadow-sm active:scale-95"
                  onClick={() => onClose(false)}
                >
                  {req.cancelLabel ?? "Batal"}
                </button>
                <button
                  ref={okRef}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-lg transition-all active:scale-95 ${tone.btn}`}
                  onClick={() => onClose(true)}
                >
                  {req.confirmLabel ?? "Ya, lanjutkan"}
                </button>
              </div>

              <p className="mt-3 text-[11px] text-slate-400 dark:text-white/35">
                Tekan <kbd className="rounded border border-slate-200 dark:border-white/15 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> untuk batal
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
