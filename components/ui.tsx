"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { Priority, User } from "@/lib/types";

export type Tone = "safe" | "active" | "warn" | "danger" | "neutral";

export const TONE: Record<Tone, { text: string; bg: string; border: string; hex: string }> = {
  safe: {
    text: "text-[#14532d] dark:text-[#86efac]",
    bg: "bg-[#dcfce7] dark:bg-[#142e22]",
    border: "border-[#bbf7d0] dark:border-[#1f4e38]",
    hex: "#22c55e",
  },
  active: {
    text: "text-[#3b1d8f] dark:text-[#c4b5fd]",
    bg: "bg-[#ece6ff] dark:bg-[#251f38]",
    border: "border-[#ddd6fe] dark:border-[#3b2f5c]",
    hex: "#7c3aed",
  },
  warn: {
    text: "text-[#78350f] dark:text-[#fcd34d]",
    bg: "bg-[#fef4c7] dark:bg-[#302615]",
    border: "border-[#fde68a] dark:border-[#4d3b1e]",
    hex: "#f59e0b",
  },
  danger: {
    text: "text-[#881337] dark:text-[#fda4af]",
    bg: "bg-[#fce4ec] dark:bg-[#331924]",
    border: "border-[#fbcfe8] dark:border-[#522437]",
    hex: "#f43f5e",
  },
  neutral: {
    text: "text-[#3f3f46] dark:text-[#d4d4d8]",
    bg: "bg-[#f3f2ee] dark:bg-[#27272a]",
    border: "border-[#e4e2dc] dark:border-[#3f3f46]",
    hex: "rgb(var(--fg) / 0.45)",
  },
};

export const PRIORITY_TONE: Record<Priority, Tone> = { low: "neutral", medium: "active", high: "warn", critical: "danger" };

export function Badge({ tone = "neutral", children, pulse }: { tone?: Tone; children: ReactNode; pulse?: boolean }) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium leading-none ${t.text} ${t.bg} ${t.border} ${
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
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-[#ffffff] ring-2 ring-[rgb(var(--surface))]"
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Circular readiness gauge. */
export function Gauge({ value, size = 96, color, label }: { value: number; size?: number; color: string; label?: string }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Kesiapan ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--fg) / 0.08)" strokeWidth={8} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={8}
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
          <div className="text-xl font-bold leading-none tracking-tight tabular-nums">{value}%</div>
          {label && <div className="mt-1 text-[11px] font-medium text-white/50">{label}</div>}
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
  footer,
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
  /** locked modals can't be dismissed via backdrop/close button (used by the alarm) */
  locked?: boolean;
  /** Pinned under the scrolling body (primary actions that must never scroll out of view). */
  footer?: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-[#141416]/45 backdrop-blur-sm p-0 sm:place-items-center sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: "none" }} // a fading overlay must never swallow clicks
          onClick={locked ? undefined : onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[32px] border border-[#e4e2dc] bg-[#ffffff] text-[#141416] shadow-2xl dark:border-[#2e2e34] dark:bg-[#18181b] dark:text-[#f4f4f6] sm:rounded-[32px] ${
              wide ? "sm:max-w-4xl" : "sm:max-w-lg"
            }`}
            initial={{ y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-[#eae8e1] px-6 py-4 dark:border-[#27272a]">
                <h2 className="text-base font-bold tracking-tight">{title}</h2>
                {!locked && onClose && (
                  <button
                    onClick={onClose}
                    className="rounded-full bg-[#f4f3ee] p-2 text-[#52525b] transition-colors hover:bg-[#e4e2dc] hover:text-[#141416] dark:bg-[#27272a] dark:text-[#a1a1aa] dark:hover:bg-[#3f3f46] dark:hover:text-[#f4f4f6]"
                    aria-label="Tutup"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-[#eae8e1] bg-[#faf9f6] px-6 py-4 dark:border-[#27272a] dark:bg-[#141416]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
