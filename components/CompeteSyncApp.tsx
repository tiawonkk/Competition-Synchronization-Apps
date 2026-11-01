"use client";

import { BellRing, History, KeyRound, LayoutDashboard, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Plus, Sun, Trophy, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { alarm, requestNotificationPermission } from "@/lib/alarm";
import { captureJoinHash, decodeSnapshot, takePendingJoin } from "@/lib/join-link";
import { isAlarming, scoreTone, userEmail } from "@/lib/logic";
import { useStore } from "@/lib/store";
import Dashboard from "./Dashboard";
import LoginScreen from "./LoginScreen";
import ProfileMenu from "./ProfileMenu";
import Workspace from "./Workspace";
import AlarmModal from "./modals/AlarmModal";
import CompleteModal from "./modals/CompleteModal";
import CreateCompetitionModal from "./modals/CreateCompetitionModal";
import EditCompetitionModal from "./modals/EditCompetitionModal";
import JoinCompetitionModal from "./modals/JoinCompetitionModal";
import AddStageModal from "./modals/AddStageModal";
import EvaluationModal, { type EvalContext } from "./modals/EvaluationModal";
import HistoryView from "./HistoryView";
import ReportModal from "./modals/ReportModal";
import { Avatar, TONE } from "./ui";

type View = { kind: "dashboard" } | { kind: "history" } | { kind: "competition"; id: string };
type Theme = "light" | "dark";

const VIEW_STORAGE_KEY = "cs-view-v1";

function readInitialView(): View {
  if (typeof window === "undefined") return { kind: "dashboard" };
  try {
    const params = new URLSearchParams(window.location.search);
    const compId = params.get("competition") || params.get("comp");
    if (compId) return { kind: "competition", id: compId };
    if (params.get("view") === "history" || window.location.hash === "#history") {
      return { kind: "history" };
    }
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as View;
      if (parsed && (parsed.kind === "dashboard" || parsed.kind === "history" || (parsed.kind === "competition" && parsed.id))) {
        return parsed;
      }
    }
  } catch {
    /* fallback */
  }
  return { kind: "dashboard" };
}

/** Auth gate: login screen until a session exists, then the app shell (re-mounted per user so view state never leaks between accounts). */
export default function CompeteSyncApp() {
  const { data } = useStore();
  return data.session ? <Shell key={data.session} /> : <LoginScreen />;
}

/** Top-level shell: adaptive theme, collapsible sidebar (desktop), bottom bar (mobile) and global modals. */
function Shell() {
  const { data, now, me, myCompetitions, dispatch, readiness, cloud } = useStore();
  const [view, setViewState] = useState<View>(readInitialView);

  const setView = useCallback((next: View) => {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(next));
      const url = new URL(window.location.href);
      if (next.kind === "competition") {
        url.searchParams.set("comp", next.id);
        url.searchParams.delete("view");
      } else if (next.kind === "history") {
        url.searchParams.set("view", "history");
        url.searchParams.delete("comp");
        url.searchParams.delete("competition");
      } else {
        url.searchParams.delete("comp");
        url.searchParams.delete("competition");
        url.searchParams.delete("view");
      }
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }, []);

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setViewState(readInitialView());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // If viewing a competition that no longer exists, smoothly fallback to dashboard
  useEffect(() => {
    if (view.kind === "competition" && data.competitions.length > 0 && !data.competitions.some((c) => c.id === view.id)) {
      setView({ kind: "dashboard" });
    }
  }, [view, data.competitions, setView]);

  const [completeId, setCompleteId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [evalCtx, setEvalCtx] = useState<EvalContext | null>(null);
  const [stageFor, setStageFor] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [ringingId, setRingingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [testing, setTesting] = useState(false); // the ringing alarm was started by "Uji Alarm"
  const [armed, setArmed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    try {
      setCollapsed(localStorage.getItem("cs-sidebar") === "1");
    } catch {
      /* storage unavailable */
    }
    // Signing out (or switching account) unmounts the shell: never leave an alarm ringing for the previous user.
    return () => alarm.stop();
  }, []);

  // An invite link (#join=CODE, optionally carrying the competition): open the join dialog with the code filled in.
  useEffect(() => {
    captureJoinHash();
    const pending = takePendingJoin();
    if (!pending) return;
    (async () => {
      if (pending.data) {
        const ops = await decodeSnapshot(pending.data);
        const comp = ops?.find((o) => o.k === "competition");
        if (ops && comp && !data.competitions.some((c) => c.id === comp.id)) cloud.importRoom(ops, comp.id);
      }
      setJoinCode(pending.code);
      setJoinOpen(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("cs-theme", next);
    } catch {
      /* storage unavailable */
    }
  }

  function toggleSidebar() {
    setCollapsed((c) => {
      try {
        localStorage.setItem("cs-sidebar", c ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  }

  const user = data.users.find((u) => u.id === me)!;
  const active = myCompetitions.filter((c) => c.status === "active");
  const current = view.kind === "competition" ? myCompetitions.find((c) => c.id === view.id) : undefined;

  // Deadline monitor: once armed (audio unlocked by a click), ring for my overdue / <24h tasks.
  useEffect(() => {
    if (!armed) return;
    const current = data.tasks.find((t) => t.id === ringingId);
    if (current && !current.isCompleted) return;
    const next = data.tasks
      .filter((t) => t.assignedTo === me && isAlarming(t, now))
      .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];
    setRingingId(next ? next.id : null);
    setTesting(false); // a finished test is over; whatever rings next is a real alarm
  }, [armed, now, data.tasks, me, ringingId]);

  async function arm() {
    if (armed) {
      setArmed(false);
      setRingingId(null);
      alarm.stop();
      return;
    }
    alarm.unlock();
    setArmed(true);
    await requestNotificationPermission();
  }

  function testAlarm(taskId: string) {
    alarm.unlock();
    setTesting(true);
    setRingingId(taskId);
  }

  const open = (id: string) => setView({ kind: "competition", id });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const title = current ? current.title : view.kind === "history" ? "Riwayat & Evaluasi" : "Beranda";

  return (
    <div className="mx-auto flex min-h-screen max-w-[1560px] lg:gap-6 lg:p-5">
      {/* Desktop sidebar (collapsible) */}
      <aside
        className={`glass-panel sticky top-5 hidden h-[calc(100vh-2.5rem)] shrink-0 flex-col rounded-[32px] p-4 transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[82px]" : "w-[268px]"
        }`}
      >
        <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "gap-3 px-2"}`}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#141416] text-[#ffffff] shadow-sm dark:bg-[#f4f4f6] dark:text-[#141416]">
            <Trophy size={19} />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-base font-bold leading-tight tracking-tight">CompeteSync</div>
              <div className="mt-0.5 text-xs text-white/50">Kelola lomba bersama tim</div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto">
          <NavButton
            collapsed={collapsed}
            active={!current && view.kind === "dashboard"}
            onClick={() => setView({ kind: "dashboard" })}
            icon={<LayoutDashboard size={18} />}
            label="Beranda"
          />
          <NavButton
            collapsed={collapsed}
            active={view.kind === "history"}
            onClick={() => setView({ kind: "history" })}
            icon={<History size={18} />}
            label="Riwayat & Evaluasi"
          />

          {!collapsed ? (
            <div className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Lomba Saya</div>
          ) : (
            <div className="mx-3 my-3 h-px bg-[#eae8e1] dark:bg-white/10" />
          )}

          {active.map((c) => {
            const s = readiness(c.id);
            const isAct = current?.id === c.id;
            return (
              <NavButton
                key={c.id}
                collapsed={collapsed}
                active={isAct}
                onClick={() => open(c.id)}
                icon={<span className="h-2.5 w-2.5 rounded-full" style={{ background: c.accent }} />}
                label={c.title}
                trailing={
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                      isAct ? "bg-[#ffffff]/20 text-[#ffffff] dark:bg-[#141416]/15 dark:text-[#141416]" : "bg-[#f3f2ee] text-[#3f3f46] dark:bg-[#27272a] dark:text-[#d4d4d8]"
                    }`}
                  >
                    {s}%
                  </span>
                }
              />
            );
          })}
          {active.length === 0 && !collapsed && <p className="px-3 py-2 text-xs text-white/40">Belum ada lomba aktif.</p>}

          <div className="pt-3 space-y-2">
            <button
              className={`btn-primary w-full ${collapsed ? "!h-11 !w-11 !p-0 mx-auto flex" : ""}`}
              onClick={() => setCreateOpen(true)}
              title="Buat Lomba Baru"
            >
              <Plus size={17} /> {!collapsed && "Buat Lomba Baru"}
            </button>
            <button
              className={`btn-ghost w-full ${collapsed ? "!h-11 !w-11 !p-0 mx-auto flex" : ""}`}
              onClick={() => setJoinOpen(true)}
              title="Gabung Lomba"
            >
              <KeyRound size={16} /> {!collapsed && "Gabung Lomba"}
            </button>
          </div>
        </nav>

        <div className={`mt-4 flex items-center gap-1.5 pt-3 border-t border-[#eae8e1] dark:border-white/10 ${collapsed ? "flex-col" : ""}`}>
          <div className={collapsed ? "" : "min-w-0 flex-1"}>
            <ProfileMenu placement="up">
              {() =>
                collapsed ? (
                  <Avatar user={user} size={34} />
                ) : (
                  <div className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-[#f6f5f0] p-2 transition hover:bg-[#eceae2] dark:bg-[#222226] dark:hover:bg-[#2c2c32]">
                    <Avatar user={user} size={32} />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold">{user.fullName}</div>
                      <div className="truncate text-[11px] text-white/50">{userEmail(user)}</div>
                    </div>
                  </div>
                )
              }
            </ProfileMenu>
          </div>
          <button
            className="rounded-full p-2.5 text-white/50 transition-colors hover:bg-[#fce4ec] hover:text-[#881337] dark:hover:bg-[#3b1824] dark:hover:text-[#fda4af]"
            onClick={() => dispatch({ type: "logout" })}
            aria-label="Keluar"
            title="Keluar"
          >
            <LogOut size={17} />
          </button>
          <button
            className="rounded-full p-2.5 text-white/50 transition-colors hover:bg-[#f4f3ee] hover:text-[#141416] dark:hover:bg-[#27272a] dark:hover:text-[#f4f4f6]"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-8 lg:px-2 lg:pb-10 lg:pt-1">
        <header className="glass-panel mb-6 flex flex-wrap items-center gap-3 rounded-[28px] px-5 py-3.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#141416] text-[#ffffff] dark:bg-[#f4f4f6] dark:text-[#141416] lg:hidden">
            <Trophy size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          </div>

          <button
            className={armed ? "btn-safe" : "btn-ghost"}
            onClick={arm}
            aria-pressed={armed}
            title="Aktifkan suara alarm (butuh klik pertama dari browser)"
          >
            {armed ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="hidden sm:inline">{armed ? "Alarm Aktif" : "Aktifkan Alarm"}</span>
          </button>
          <button
            className="btn-ghost !h-10 !w-10 !p-0"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Beralih ke mode gelap" : "Beralih ke mode terang"}
            title={theme === "light" ? "Mode gelap" : "Mode terang"}
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <div className="lg:hidden">
            <ProfileMenu placement="down">{() => <Avatar user={user} size={34} />}</ProfileMenu>
          </div>
        </header>

        {!armed && (
          <div className="mb-6 flex items-center gap-3.5 rounded-[22px] border border-[#f5e39b] bg-[#fef4c7] px-5 py-3.5 text-xs text-[#5c4012] dark:border-[#4d3b1e] dark:bg-[#302615] dark:text-[#fcd34d]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ffffff]/80 text-[#78350f] dark:bg-[#ffffff]/10 dark:text-[#fcd34d]">
              <BellRing size={15} />
            </span>
            <span className="leading-relaxed">
              Klik <strong>Aktifkan Alarm</strong> agar browser mengizinkan suara. Tugas Anda yang jatuh tempo &lt; 24 jam akan berdering otomatis, atau pakai tombol{" "}
              <strong>Uji Alarm</strong> pada tugas mana pun.
            </span>
          </div>
        )}

        {view.kind === "history" ? (
          <HistoryView onEvaluate={setEvalCtx} onOpen={open} />
        ) : !current ? (
          <Dashboard onOpen={open} onComplete={setCompleteId} onCreate={() => setCreateOpen(true)} onJoin={() => setJoinOpen(true)} />
        ) : (
          <Workspace
            key={current.id}
            competitionId={current.id}
            onComplete={setCompleteId}
            onTestAlarm={testAlarm}
            onReport={() => setReportId(current.id)}
            onEdit={() => setEditId(current.id)}
            onEvaluate={setEvalCtx}
            onAddStage={() => setStageFor(current.id)}
          />
        )}
      </main>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eae8e1] bg-[#ffffff] dark:border-white/10 dark:bg-[#18181b] lg:hidden" aria-label="Navigasi utama">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          <MobileTab active={!current && view.kind === "dashboard"} onClick={() => setView({ kind: "dashboard" })} label="Beranda" icon={<LayoutDashboard size={20} />} />
          <MobileTab active={view.kind === "history"} onClick={() => setView({ kind: "history" })} label="Riwayat" icon={<History size={20} />} />
          {active.slice(0, 1).map((c) => (
            <MobileTab
              key={c.id}
              active={current?.id === c.id}
              onClick={() => open(c.id)}
              label={c.title.split(" ")[0]}
              icon={<span className="h-3 w-3 rounded-full" style={{ background: c.accent }} />}
            />
          ))}
          <MobileTab active={false} onClick={() => setCreateOpen(true)} label="Buat" icon={<Plus size={20} />} />
          <MobileTab active={false} onClick={() => setJoinOpen(true)} label="Gabung" icon={<KeyRound size={20} />} />
        </div>
      </nav>

      <AlarmModal
        taskId={ringingId}
        isTest={testing}
        onClose={() => {
          setRingingId(null);
          setTesting(false);
          alarm.stop();
        }}
        onConfirm={setCompleteId}
      />
      <CompleteModal taskId={completeId} onClose={() => setCompleteId(null)} />
      <ReportModal competitionId={reportId} onClose={() => setReportId(null)} />
      <EditCompetitionModal competitionId={editId} onClose={() => setEditId(null)} />
      <EvaluationModal ctx={evalCtx} onClose={() => setEvalCtx(null)} onSaved={() => setView({ kind: "history" })} />
      <AddStageModal competitionId={stageFor} onClose={() => setStageFor(null)} />
      <CreateCompetitionModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={open} />
      <JoinCompetitionModal
        open={joinOpen}
        initialCode={joinCode}
        onClose={() => {
          setJoinOpen(false);
          setJoinCode("");
        }}
        onJoined={(id, message) => {
          open(id);
          if (message) setToast(message);
        }}
      />
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-full bg-[#141416] px-5 py-3 text-sm font-medium text-[#ffffff] shadow-xl lg:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
  trailing,
  collapsed,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  collapsed: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl text-left text-sm transition-all ${
        collapsed ? "mx-auto h-11 w-11 justify-center px-0" : "w-full px-3.5 py-2.5"
      } ${
        active
          ? "bg-[#141416] font-semibold text-[#ffffff] shadow-sm dark:bg-[#f4f4f6] dark:text-[#141416]"
          : "text-[#52525b] hover:bg-[#f4f3ee] hover:text-[#141416] dark:text-[#a1a1aa] dark:hover:bg-[#27272a] dark:hover:text-[#f4f4f6]"
      }`}
    >
      <span className="grid w-5 shrink-0 place-items-center">{icon}</span>
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && trailing}
    </button>
  );
}

function MobileTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10px] ${
        active ? "font-bold text-[#141416] dark:text-[#f4f4f6]" : "text-[#71717a] dark:text-[#a1a1aa]"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
