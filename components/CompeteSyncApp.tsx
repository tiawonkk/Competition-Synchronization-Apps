"use client";

import { BellRing, KeyRound, LayoutDashboard, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Plus, Sun, Trophy, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { alarm, requestNotificationPermission } from "@/lib/alarm";
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
import ReportModal from "./modals/ReportModal";
import { Avatar, TONE } from "./ui";

type View = { kind: "dashboard" } | { kind: "competition"; id: string };
type Theme = "light" | "dark";

/** Auth gate: login screen until a session exists, then the app shell (re-mounted per user so view state never leaks between accounts). */
export default function CompeteSyncApp() {
  const { data } = useStore();
  return data.session ? <Shell key={data.session} /> : <LoginScreen />;
}

/** Top-level shell: adaptive theme, collapsible sidebar (desktop), bottom bar (mobile) and global modals. */
function Shell() {
  const { data, now, me, myCompetitions, dispatch, readiness } = useStore();
  const [view, setView] = useState<View>({ kind: "dashboard" });
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [ringingId, setRingingId] = useState<string | null>(null);
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
    setRingingId(taskId);
  }

  const open = (id: string) => setView({ kind: "competition", id });
  const title = current ? current.title : "Beranda";

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] lg:gap-2 lg:p-3">
      {/* Desktop sidebar (collapsible) */}
      <aside
        className={`sidebar-dark sticky top-3 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col rounded-[28px] p-3 transition-[width] duration-200 lg:flex ${collapsed ? "w-[72px]" : "w-64"}`}
      >
        <div className={`mb-5 flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-2"}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#f6efd9] text-[#1c1c20]">
            <Trophy size={18} />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-base font-bold leading-tight">CompeteSync</div>
              <div className="text-[11px] text-white/45">Kelola lomba bersama tim</div>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <NavButton collapsed={collapsed} active={!current} onClick={() => setView({ kind: "dashboard" })} icon={<LayoutDashboard size={18} />} label="Beranda" />
          {!collapsed && <div className="px-3 pb-1 pt-4 text-xs font-semibold text-white/40">Lomba Saya</div>}
          {collapsed && <div className="mx-3 my-3 h-px bg-white/10" />}
          {active.map((c) => {
            const s = readiness(c.id);
            return (
              <NavButton
                key={c.id}
                collapsed={collapsed}
                active={current?.id === c.id}
                onClick={() => open(c.id)}
                icon={<span className="h-2.5 w-2.5 rounded-full" style={{ background: c.accent }} />}
                label={c.title}
                trailing={<span className="text-[11px] tabular-nums" style={{ color: TONE[scoreTone(s)].hex }}>{s}%</span>}
              />
            );
          })}
          {active.length === 0 && !collapsed && <p className="px-3 py-2 text-xs text-white/35">Belum ada lomba.</p>}
          <button className="btn-primary mt-3 w-full" onClick={() => setCreateOpen(true)} title="Buat Lomba Baru">
            <Plus size={16} /> {!collapsed && "Buat Lomba Baru"}
          </button>
          <button className="btn-ghost mt-2 w-full" onClick={() => setJoinOpen(true)} title="Gabung Lomba">
            <KeyRound size={16} /> {!collapsed && "Gabung Lomba"}
          </button>
        </nav>
        <div className={`mt-3 flex items-center gap-1.5 ${collapsed ? "flex-col" : ""}`}>
          <div className={collapsed ? "" : "min-w-0 flex-1"}>
            <ProfileMenu placement="up">
              {() =>
                collapsed ? (
                  <Avatar user={user} size={32} />
                ) : (
                  <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-white/[0.07] p-2 transition hover:bg-white/[0.12]">
                    <Avatar user={user} size={30} />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{user.fullName}</div>
                      <div className="truncate text-[10px] text-white/45">{userEmail(user)}</div>
                    </div>
                  </div>
                )
              }
            </ProfileMenu>
          </div>
          <button className="rounded-xl p-2 text-white/50 hover:bg-danger/15 hover:text-danger" onClick={() => dispatch({ type: "logout" })} aria-label="Keluar" title="Keluar">
            <LogOut size={18} />
          </button>
          <button className="rounded-lg p-2 text-white/50 hover:bg-white/10" onClick={toggleSidebar} aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-8 lg:px-6 lg:pb-8 lg:pt-4">
        <header className="mb-6 flex flex-wrap items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1c1c20] text-[#f6efd9] lg:hidden">
            <Trophy size={16} />
          </span>
          <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <button className="btn-primary hidden xl:inline-flex" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Buat Lomba Baru
          </button>
          <button className="btn-ghost hidden xl:inline-flex" onClick={() => setJoinOpen(true)}>
            <KeyRound size={16} /> Gabung Lomba
          </button>
          <button className={armed ? "btn-safe" : "btn-ghost"} onClick={arm} aria-pressed={armed} title="Aktifkan suara alarm (butuh klik pertama dari browser)">
            {armed ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="hidden sm:inline">{armed ? "Alarm Aktif" : "Aktifkan Alarm"}</span>
          </button>
          <button className="btn-ghost !px-2.5" onClick={toggleTheme} aria-label={theme === "light" ? "Beralih ke mode gelap" : "Beralih ke mode terang"} title={theme === "light" ? "Mode gelap" : "Mode terang"}>
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <div className="lg:hidden">
            <ProfileMenu placement="down">{() => <Avatar user={user} size={34} />}</ProfileMenu>
          </div>
        </header>

        {!armed && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            <BellRing size={16} className="shrink-0" />
            <span>
              Klik <strong>Aktifkan Alarm</strong> agar browser mengizinkan suara. Tugas Anda yang jatuh tempo &lt; 24 jam akan berdering otomatis, atau pakai tombol{" "}
              <strong>Uji Alarm</strong> pada tugas mana pun.
            </span>
          </div>
        )}

        {!current ? (
          <Dashboard onOpen={open} onComplete={setCompleteId} onCreate={() => setCreateOpen(true)} onJoin={() => setJoinOpen(true)} />
        ) : (
          <Workspace key={current.id} competitionId={current.id} onComplete={setCompleteId} onTestAlarm={testAlarm} onReport={() => setReportId(current.id)} onEdit={() => setEditId(current.id)} />
        )}
      </main>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[rgb(var(--surface))] lg:hidden" aria-label="Navigasi utama">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          <MobileTab active={!current} onClick={() => setView({ kind: "dashboard" })} label="Beranda" icon={<LayoutDashboard size={20} />} />
          {active.slice(0, 2).map((c) => (
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

      <AlarmModal taskId={ringingId} onConfirm={setCompleteId} />
      <CompleteModal taskId={completeId} onClose={() => setCompleteId(null)} />
      <ReportModal competitionId={reportId} onClose={() => setReportId(null)} />
      <EditCompetitionModal competitionId={editId} onClose={() => setEditId(null)} />
      <CreateCompetitionModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={open} />
      <JoinCompetitionModal open={joinOpen} onClose={() => setJoinOpen(false)} onJoined={open} />
    </div>
  );
}

function NavButton({ active, onClick, icon, label, trailing, collapsed }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; trailing?: React.ReactNode; collapsed: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-xl py-2.5 text-left text-sm transition ${collapsed ? "justify-center px-0" : "px-3"} ${
        active ? "bg-white/[0.12] font-semibold text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <span className="grid w-5 place-items-center">{icon}</span>
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && trailing}
    </button>
  );
}

function MobileTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10px] ${active ? "text-active" : "text-white/50"}`} aria-current={active ? "page" : undefined}>
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
