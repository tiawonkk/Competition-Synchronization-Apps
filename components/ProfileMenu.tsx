"use client";

import { Check, LogOut, RotateCcw, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { emptyData } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { Avatar } from "./ui";

/** Account popover: switch between registered users, wipe local data, or sign out. */
export default function ProfileMenu({ children, placement }: { children: (open: boolean) => React.ReactNode; placement: "up" | "down" }) {
  const { data, me, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="block w-full text-left">
        {children(open)}
      </button>
      {open && (
        <div
          role="menu"
          className={`glass absolute z-50 w-64 bg-[var(--modal-bg)] p-2 shadow-xl ${placement === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"}`}
        >
          <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            <Users size={12} /> Ganti akun
          </div>
          <ul className="max-h-56 overflow-y-auto">
            {data.users.map((u) => (
              <li key={u.id}>
                <button
                  role="menuitem"
                  onClick={() => {
                    dispatch({ type: "login", userId: u.id });
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/10"
                >
                  <Avatar user={u} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.fullName}</span>
                    <span className="block truncate text-[10px] text-white/45">{u.emailMicrosoft ?? u.emailGoogle}</span>
                  </span>
                  {u.id === me && <Check size={14} className="text-safe" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="my-1.5 h-px bg-white/10" />
          <button
            role="menuitem"
            onClick={() => {
              if (window.confirm("Hapus semua data di browser ini (akun, lomba, tugas, whiteboard)? Tindakan ini tidak bisa dibatalkan.")) {
                dispatch({ type: "reset", data: emptyData() });
              }
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/70 hover:bg-white/10"
          >
            <RotateCcw size={14} /> Hapus semua data
          </button>
          <button
            role="menuitem"
            onClick={() => dispatch({ type: "logout" })}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}
