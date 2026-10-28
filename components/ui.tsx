"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { Priority, User } from "@/lib/types";

export type Tone = "safe" | "active" | "warn" | "danger" | "neutral";

export const TONE: Record<Tone, { text: string; bg: string; border: string; hex: string }> = {
  safe: { text: "text-safe", bg: "bg-safe/10", border: "border-safe/30", hex: "rgb(var(--safe))" },
  active: { text: "text-active", bg: "bg-active/10", border: "border-active/30", hex: "rgb(var(--active))" },
  warn: { text: "text-warn", bg: "bg-warn/10", border: "border-warn/30", hex: "rgb(var(--warn))" },
  danger: { text: "text-danger", bg: "bg-danger/10", border: "border-danger/30", hex: "rgb(var(--danger))" },
  neutral: { text: "text-white/70", bg: "bg-white/5", border: "border-white/10", hex: "rgb(var(--fg) / 0.45)" },
};

export const PRIORITY_TONE: Record<Priority, Tone> = { low: "neutral", medium: "active", high: "warn", critical: "danger" };

export function Badge({ tone = "neutral", children, pulse }: { tone?: Tone; children: ReactNode; pulse?: boolean }) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${t.text} ${t.bg} ${t.border} ${
        pulse ? "animate-pulse" : ""
      }`}
    >
      {children}
    </span>
  );
}

export function Avatar({ user, size = 28 }: { user: Pick<User, "fullName" | "color">; size?: number }) {
  const initials = user.fullName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-[#fff] ring-2 ring-[rgb(var(--surface))]"
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Circular readiness gauge. */
export function Gauge({ value, size = 96, color, label }: { value: number; size?: number; color: string; label?: string }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Kesiapan ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--fg) / 0.1)" strokeWidth={8} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 0.9, ease: "easeOut" }}
         
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-xl font-bold leading-none tabular-nums">{value}%</div>
          {label && <div className="mt-0.5 text-[10px] text-white/50">{label}</div>}
        </div>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  locked,
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
  /** locked modals can't be dismissed via backdrop/close button (used by the alarm) */
  locked?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-slate-900/45 p-0 sm:place-items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={locked ? undefined : onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`card flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none bg-[var(--modal-bg)] shadow-2xl sm:rounded-3xl ${
              wide ? "sm:max-w-3xl" : "sm:max-w-lg"
            }`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
                <h2 className="text-base font-semibold">{title}</h2>
                {!locked && onClose && (
                  <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10" aria-label="Tutup">
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
            <div className="overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
