"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { userEmail } from "@/lib/logic";
import { emptyData } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { Avatar } from "./ui";

/** Account popover: who is signed in, wipe local data, or sign out. */
export default function ProfileMenu({ children, placement }: { children: (open: boolean) => React.ReactNode; placement: "up" | "down" }) {
  const { data, me, dispatch } = useStore();
  const user = data.users.find((u) => u.id === me);
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
      {open && user && (
        <div
          role="menu"
          className={`card absolute z-50 w-64 p-2 shadow-xl ${placement === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"}`}
        >
          <div className="flex items-center gap-2.5 px-2 pb-2 pt-1.5">
            <Avatar user={user} size={34} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user.fullName}</div>
              <div className="truncate text-xs text-white/50">{userEmail(user)}</div>
            </div>
          </div>
          <div className="my-1 h-px bg-white/10" />
          <button
            role="menuitem"
            onClick={() => {
              if (window.confirm("Hapus semua akun dan data di browser ini (lomba, tugas, whiteboard)? Tindakan ini tidak bisa dibatalkan.")) {
                dispatch({ type: "reset", data: emptyData() });
              }
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            <Trash2 size={15} /> Hapus semua data
          </button>
          <button
            role="menuitem"
            onClick={() => dispatch({ type: "logout" })}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-danger hover:bg-danger/10"
          >
            <LogOut size={15} /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}
