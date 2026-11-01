"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Trash2, UserMinus, X, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Clean editorial in-app replacement for window.confirm:
 * Crisp White, Matte Black & Soft Pastel theme, light & dark mode adaptive, keyboard accessible.
 */

export type ConfirmTone = "danger" | "warn" | "safe" | "active";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  /** The item being acted on, displayed as a pastel pill badge. */
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

const TONES: Record<ConfirmTone, { pillBg: string; pillText: string; btn: string; fallback: LucideIcon }> = {
  danger: {
    pillBg: "bg-[#fce4ec] dark:bg-[#331924]",
    pillText: "text-[#881337] dark:text-[#fda4af]",
    btn: "btn-danger",
    fallback: Trash2,
  },
  warn: {
    pillBg: "bg-[#fef4c7] dark:bg-[#302615]",
    pillText: "text-[#78350f] dark:text-[#fcd34d]",
    btn: "btn-primary",
    fallback: AlertTriangle,
  },
  safe: {
    pillBg: "bg-[#dcfce7] dark:bg-[#142e22]",
    pillText: "text-[#14532d] dark:text-[#86efac]",
    btn: "btn-safe",
    fallback: CheckCircle2,
  },
  active: {
    pillBg: "bg-[#ece6ff] dark:bg-[#251f38]",
    pillText: "text-[#3b1d8f] dark:text-[#c4b5fd]",
    btn: "btn-primary",
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
          transition={{ duration: 0.18 }}
          onClick={() => onClose(false)}
        >
          <div className="absolute inset-0 bg-[#141416]/45 backdrop-blur-sm" aria-hidden />

          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cf-title"
            aria-describedby="cf-desc"
            className="relative w-full max-w-[420px] overflow-hidden rounded-[32px] border border-[#e4e2dc] bg-[#ffffff] text-[#141416] shadow-2xl dark:border-[#2e2e34] dark:bg-[#18181b] dark:text-[#f4f4f6]"
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onClose(false)}
              className="absolute right-4 top-4 rounded-full bg-[#f4f3ee] p-2 text-[#52525b] transition-colors hover:bg-[#e4e2dc] hover:text-[#141416] dark:bg-[#27272a] dark:text-[#a1a1aa] dark:hover:bg-[#3f3f46] dark:hover:text-[#f4f4f6]"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>

            <div className="px-7 pb-7 pt-8 text-center">
              <div className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl ${tone.pillBg} ${tone.pillText}`}>
                <Icon size={24} strokeWidth={2.2} />
              </div>

              <h2 id="cf-title" className="text-lg font-bold tracking-tight">
                {req.title}
              </h2>

              {req.item && (
                <div className={`mx-auto mt-3 inline-block max-w-full truncate rounded-full px-4 py-1.5 text-xs font-semibold ${tone.pillBg} ${tone.pillText}`} title={req.item}>
                  {req.item}
                </div>
              )}

              {req.message && (
                <p id="cf-desc" className="mt-3 text-sm leading-relaxed text-white/60">
                  {req.message}
                </p>
              )}

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button ref={cancelRef} className="btn-ghost w-full" onClick={() => onClose(false)}>
                  {req.cancelLabel ?? "Batal"}
                </button>
                <button ref={okRef} className={`${tone.btn} w-full`} onClick={() => onClose(true)}>
                  {req.confirmLabel ?? "Ya, lanjutkan"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
