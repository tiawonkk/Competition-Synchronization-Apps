"use client";

import { BellRing, LayoutDashboard, Moon, PanelLeftClose, PanelLeftOpen, Plus, Sparkles, Sun, Trophy, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { alarm, requestNotificationPermission } from "@/lib/alarm";
import { isAlarming, scoreTone } from "@/lib/logic";
import { useStore } from "@/lib/store";
import Dashboard from "./Dashboard";
import Workspace from "./Workspace";
import AlarmModal from "./modals/AlarmModal";
import CompleteModal from "./modals/CompleteModal";
import GeneratorModal from "./modals/GeneratorModal";
import ReportModal from "./modals/ReportModal";
import { Avatar, TONE } from "./ui";

type View = { kind: "dashboard" } | { kind: "competition"; id: string };
type Theme = "light" | "dark";

/** Top-level shell: adaptive theme, collapsible sidebar (desktop), bottom bar (mobile) and global modals. */
export default function CompeteSyncApp() {
  const { data, now, me, readiness } = useStore();
  const [view, setView] = useState<View>({ kind: "dashboard" });
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
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
  const active = data.competitions.filter((c) => c.status === "active");

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
  const title = view.kind === "dashboard" ? "Beranda" : data.competitions.find((c) => c.id === view.id)?.title;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px]">
      {/* Desktop sidebar (collapsible) */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/[0.08] p-3 transition-[width] duration-200 lg:flex ${collapsed ? "w-[68px]" : "w-60"}`}
      >
        <div className={`mb-5 flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-2"}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-active text-[#fff] shadow-sm">
            <Trophy size={17} />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[15px] font-bold leading-tight">CompeteSync</div>
              <div className="text-[10px] text-white/45">Anti-keteteran untuk juara</div>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <NavButton collapsed={collapsed} active={view.kind === "dashboard"} onClick={() => setView({ kind: "dashboard" })} icon={<LayoutDashboard size={18} />} label="Beranda" />
          {!collapsed && <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-white/35">Kompetisi</div>}
          {collapsed && <div className="mx-3 my-3 h-px bg-white/10" />}
          {active.map((c) => {
            const s = readiness(c.id);
            return (
              <NavButton
                key={c.id}
                collapsed={collapsed}
                active={view.kind === "competition" && view.id === c.id}
                onClick={() => open(c.id)}
                icon={<span className="h-2.5 w-2.5 rounded-full" style={{ background: c.accent }} />}
                label={c.title}
                trailing={<span className="text-[11px] tabular-nums" style={{ color: TONE[scoreTone(s)].hex }}>{s}%</span>}
              />
            );
          })}
          <button className="btn-ghost mt-3 w-full" onClick={() => setGenOpen(true)} title="Kompetisi Baru (AI)">
            <Plus size={16} /> {!collapsed && "Kompetisi Baru (AI)"}
          </button>
        </nav>
        <div className={`mt-3 flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
          {!collapsed && (
            <div className="glass flex min-w-0 flex-1 items-center gap-2 p-2">
              <Avatar user={user} size={30} />
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{user.fullName}</div>
                <div className="truncate text-[10px] text-white/45">{user.emailMicrosoft ?? user.emailGoogle}</div>
              </div>
            </div>
          )}
          {collapsed && <Avatar user={user} size={32} />}
          <button className="rounded-lg p-2 text-white/50 hover:bg-white/10" onClick={toggleSidebar} aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-8 lg:pb-10">
        <header className="mb-6 flex flex-wrap items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-active text-[#fff] lg:hidden">
            <Trophy size={16} />
          </span>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          <button className="btn-ghost" onClick={() => setGenOpen(true)}>
            <Sparkles size={16} className="text-active" /> <span className="hidden sm:inline">Generator Jadwal AI</span>
            <span className="sm:hidden">AI</span>
          </button>
          <button className={armed ? "btn-safe" : "btn-ghost"} onClick={arm} aria-pressed={armed} title="Aktifkan suara alarm (butuh klik pertama dari browser)">
            {armed ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="hidden sm:inline">{armed ? "Alarm Aktif" : "Aktifkan Alarm"}</span>
          </button>
          <button className="btn-ghost !px-2.5" onClick={toggleTheme} aria-label={theme === "light" ? "Beralih ke mode gelap" : "Beralih ke mode terang"} title={theme === "light" ? "Mode gelap" : "Mode terang"}>
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
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

        {view.kind === "dashboard" ? (
          <Dashboard onOpen={open} onComplete={setCompleteId} />
        ) : (
          <Workspace key={view.id} competitionId={view.id} onComplete={setCompleteId} onTestAlarm={testAlarm} onReport={() => setReportId(view.id)} />
        )}
      </main>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[rgb(var(--surface))]/85 backdrop-blur-xl lg:hidden" aria-label="Navigasi utama">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          <MobileTab active={view.kind === "dashboard"} onClick={() => setView({ kind: "dashboard" })} label="Beranda" icon={<LayoutDashboard size={20} />} />
          {active.slice(0, 3).map((c) => (
            <MobileTab
              key={c.id}
              active={view.kind === "competition" && view.id === c.id}
              onClick={() => open(c.id)}
              label={c.title.split(" ")[0]}
              icon={<span className="h-3 w-3 rounded-full" style={{ background: c.accent }} />}
            />
          ))}
          <MobileTab active={false} onClick={() => setGenOpen(true)} label="AI" icon={<Sparkles size={20} />} />
        </div>
      </nav>

      <AlarmModal taskId={ringingId} onConfirm={setCompleteId} />
      <CompleteModal taskId={completeId} onClose={() => setCompleteId(null)} />
      <ReportModal competitionId={reportId} onClose={() => setReportId(null)} />
      <GeneratorModal open={genOpen} onClose={() => setGenOpen(false)} onCreated={open} />
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
        active ? "bg-active/10 font-medium text-active" : "text-white/65 hover:bg-white/[0.06]"
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
