import type { Collision, CollisionItem, Competition, DueState, Milestone, Priority, Task } from "./types";

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;
const COLLISION_WINDOW_H = 48;

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
};

const WEIGHT: Record<Priority, number> = { low: 1, medium: 2, high: 3, critical: 4 };

/** Mirror of the SQL `compute_readiness` function: 70% completion + 30% deliverables (tasks with proof). */
export function computeReadiness(tasks: Task[]): number {
  const total = tasks.reduce((s, t) => s + WEIGHT[t.priority], 0);
  if (total === 0) return 0;
  const done = tasks.filter((t) => t.isCompleted).reduce((s, t) => s + WEIGHT[t.priority], 0);
  const proof = tasks.filter((t) => t.isCompleted && t.proofUrl).reduce((s, t) => s + WEIGHT[t.priority], 0);
  return Math.round(100 * (0.7 * (done / total) + 0.3 * (proof / total)));
}

export function dueState(task: Task, now: number): DueState {
  if (task.isCompleted) return "done";
  const diff = new Date(task.dueDate).getTime() - now;
  if (diff < 0) return "overdue";
  if (diff < DAY) return "urgent";
  if (diff < 3 * DAY) return "soon";
  return "ok";
}

/** Tasks that should ring: not completed, alarm armed, overdue or due in < 24h. */
export function isAlarming(task: Task, now: number): boolean {
  if (task.isCompleted || !task.alarmActive) return false;
  return new Date(task.dueDate).getTime() - now < DAY;
}

export function scoreTone(score: number): "safe" | "active" | "warn" | "danger" {
  if (score >= 80) return "safe";
  if (score >= 50) return "active";
  if (score >= 25) return "warn";
  return "danger";
}

// ---------- Formatting (id-ID) ----------
const dateFmt = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
const longFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso)).replace(".", ":");
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export const fmtLong = (iso: string | number) => longFmt.format(new Date(iso));

export function relative(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  let text: string;
  if (mins < 60) text = `${mins} menit`;
  else if (abs < DAY) text = `${Math.round(abs / HOUR)} jam`;
  else text = `${Math.round(abs / DAY)} hari`;
  return diff < 0 ? `terlambat ${text}` : `${text} lagi`;
}

// ---------- Collision radar ----------
export function detectCollisions(
  competitions: Competition[],
  tasks: Task[],
  now: number,
): Collision[] {
  const name = (id: string) => competitions.find((c) => c.id === id)?.title ?? id;
  const active = competitions.filter((c) => c.status === "active" || c.status === "planning");

  const items: CollisionItem[] = [];
  for (const c of active) {
    items.push({
      competitionId: c.id,
      label: "Deadline pengumpulan final",
      at: c.submissionDeadline,
      priority: "deadline",
    });
  }
  for (const t of tasks) {
    if (t.isCompleted || (t.priority !== "high" && t.priority !== "critical")) continue;
    if (!active.some((c) => c.id === t.competitionId)) continue;
    if (new Date(t.dueDate).getTime() < now - DAY) continue;
    items.push({ competitionId: t.competitionId, label: t.title, at: t.dueDate, priority: t.priority });
  }

  type Pair = { a: CollisionItem; b: CollisionItem; h: number; heavy: boolean };
  const isTop = (i: CollisionItem) => i.priority === "critical" || i.priority === "deadline";
  const byPair = new Map<string, Pair[]>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.competitionId === b.competitionId) continue;
      const h = Math.abs(new Date(a.at).getTime() - new Date(b.at).getTime()) / HOUR;
      if (h > COLLISION_WINDOW_H) continue;
      const key = [a.competitionId, b.competitionId].sort().join("|");
      const list = byPair.get(key) ?? [];
      list.push({ a, b, h, heavy: isTop(a) && isTop(b) });
      byPair.set(key, list);
    }
  }

  const out: Collision[] = [];
  for (const [key, pairs] of byPair) {
    // Headline = closest pair of top-priority items (falls back to closest of any); show the 2 closest pairs.
    pairs.sort((x, y) => x.h - y.h);
    const head = pairs.find((p) => p.heavy) ?? pairs[0];
    const shown = [head, ...pairs.filter((p) => p !== head)].slice(0, 2);
    const unique = new Map<string, CollisionItem>();
    for (const p of shown) {
      unique.set(`${p.a.competitionId}${p.a.label}`, p.a);
      unique.set(`${p.b.competitionId}${p.b.label}`, p.b);
    }
    const [first, second] = [head.a, head.b].sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime());
    const pull = new Date(first.at).getTime() - 2 * DAY;
    out.push({
      id: key,
      competitionA: first.competitionId,
      competitionB: second.competitionId,
      items: [...unique.values()].sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime()),
      hoursApart: Math.round(head.h),
      severity: pairs.some((p) => p.heavy && p.h <= 24) ? "critical" : "warning",
      suggestion: `Majukan target internal "${first.label}" (${name(first.competitionId)}) ke ${fmtDateTime(
        new Date(pull).toISOString(),
      )} supaya slot "${second.label}" (${name(second.competitionId)}) tidak berebut tenaga tim.`,
    });
  }
  return out.sort((a, b) => a.hoursApart - b.hoursApart);
}

/** Open workload per day (hours-weighted by priority) for the next `days` days. */
export function workloadPerDay(tasks: Task[], now: number, days: number): number[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const buckets = Array<number>(days).fill(0);
  for (const t of tasks) {
    if (t.isCompleted) continue;
    const idx = Math.floor((new Date(t.dueDate).getTime() - start.getTime()) / DAY);
    if (idx >= 0 && idx < days) buckets[idx] += WEIGHT[t.priority];
  }
  return buckets;
}

export function nextMilestone(milestones: Milestone[], now: number): Milestone | undefined {
  return [...milestones]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .find((m) => new Date(m.targetDate).getTime() >= now);
}

export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const PROOF_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "1drv.ms",
  "onedrive.live.com",
  "sharepoint.com",
  "binus.ac.id",
];

/** Proof must be a link hosted on Google Drive / OneDrive / SharePoint (Binus). */
export function isValidProofUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "https:") return false;
    return PROOF_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
