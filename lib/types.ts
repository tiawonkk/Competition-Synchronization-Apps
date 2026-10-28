export type Role = "leader" | "member" | "advisor";
export type Priority = "low" | "medium" | "high" | "critical";
export type CompetitionStatus = "planning" | "active" | "submitted" | "archived";
export type Provider = "onedrive" | "gdrive";
export type ResourceKind = "guidebook" | "diagram" | "deck" | "zip" | "other";

export interface User {
  id: string;
  fullName: string;
  email?: string; // sign-in email
  emailGoogle?: string; // set when the account can use Google Calendar
  emailMicrosoft?: string; // set when the account can use Outlook
  color: string; // avatar accent
  salt?: string; // password hash inputs (local accounts only)
  passwordHash?: string;
}

export interface Competition {
  id: string;
  title: string;
  category: string;
  theme: string;
  startDate: string; // ISO
  submissionDeadline: string; // ISO
  advisorName: string;
  advisorEmail: string;
  onedriveFolderUrl?: string;
  gdriveFolderUrl?: string;
  status: CompetitionStatus;
  accent: string; // UI accent color
  inviteCode: string; // e.g. "HACK-88"; teammates join with it
  autoSendWeekly?: boolean; // auto-send the advisor report every Sunday 19:00 WIB
}

export interface Member {
  competitionId: string;
  userId: string;
  role: Role;
  teamRole?: string; // free-form team function, e.g. "Hacker / AI & Backend"
}

export interface Milestone {
  id: string;
  competitionId: string;
  title: string;
  targetDate: string;
  orderIndex: number;
}

export interface Task {
  id: string;
  competitionId: string;
  milestoneId: string | null;
  assignedTo: string | null;
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
  isCompleted: boolean;
  completedAt?: string;
  proofUrl?: string;
  gcalEventId?: string;
  outlookEventId?: string;
  alarmActive: boolean;
  sourceNoteId?: string;
  rescheduledFrom?: string; // ISO due date before the AI rescheduler moved it
}

export interface Resource {
  id: string;
  competitionId: string;
  kind: ResourceKind;
  title: string;
  provider: Provider;
  url: string;
  meta: string;
  addedBy?: string;
}

export interface AdvisorReport {
  id: string;
  competitionId: string;
  weekNumber: number;
  html: string;
  sentToEmail: string;
  sentAt: string;
  status: "draft" | "queued" | "sent" | "failed";
}

export type DueState = "done" | "overdue" | "urgent" | "soon" | "ok";

export interface CollisionItem {
  competitionId: string;
  taskId?: string; // absent for final deadlines, which can't be moved
  label: string;
  at: string;
  priority: Priority | "deadline";
}

export interface Collision {
  id: string;
  competitionA: string;
  competitionB: string;
  items: CollisionItem[];
  hoursApart: number;
  severity: "critical" | "warning";
  suggestion: string;
}

export type NoteKind = "ide" | "fitur" | "riset" | "kendala";

/** Mirrors the `whiteboard_elements` table. Drawings carry their stroke in `points`. */
export interface WhiteboardElement {
  id: string;
  competitionId: string;
  type: "sticky" | "drawing" | "connector";
  kind?: NoteKind;
  content: string;
  color: string;
  x: number;
  y: number;
  points?: [number, number][];
  votes: string[]; // user ids — one vote per member
  createdBy: string;
  updatedAt: string;
  taskId?: string; // set once the note has been converted into a task
}

/** Entry in the in-app notification log (calendar updates, joins, alarms silenced...). */
export interface Notice {
  id: string;
  at: string;
  text: string;
  tone: "safe" | "active" | "warn";
}
