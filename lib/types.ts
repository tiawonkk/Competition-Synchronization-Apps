export type Role = "leader" | "member" | "advisor";
export type Priority = "low" | "medium" | "high" | "critical";
export type CompetitionStatus = "planning" | "active" | "submitted" | "archived";
export type Provider = "onedrive" | "gdrive" | "supabase";
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
  guide?: GuideInfo; // rubric, deliverables and rules read from the guidebook
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
  stageId?: string;
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
  stageId?: string;
}

export interface Resource {
  id: string;
  competitionId: string;
  kind: ResourceKind;
  title: string;
  provider: Provider;
  url: string; // empty for a demo upload that has no cloud copy yet
  meta: string;
  addedBy?: string;
  sizeBytes?: number;
  chunks?: number; // number of upload chunks (large-file uploader)
  simulated?: boolean; // metadata only: the bytes were never sent anywhere
}

export interface AdvisorReport {
  id: string;
  competitionId: string;
  weekNumber: number;
  html: string;
  sentToEmail: string;
  sentAt: string;
  status: "draft" | "queued" | "sent" | "failed";
  kind?: "weekly" | "stage" | "final"; // absent = weekly
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

/** Structured timeline + requirements read out of a competition guidebook (PDF or pasted text). Dates are "YYYY-MM-DD". */
export interface GuidebookDraft {
  title?: string;
  category?: string; // one of the form's category options
  summary?: string;
  theme?: string;
  deadline?: string; // final submission
  stages: { name: string; date: string | null; isRound?: boolean }[]; // isRound: an elimination round (babak), not just a date
  rubric?: { criterion: string; weight: string }[];
  deliverables?: string[];
  rules?: string[];
  tasks: { title: string; description: string; dueDate: string | null; priority: Priority }[];
}

// ---------- Multi-stage pipeline & post-mortem ----------
export type StageStatus = "upcoming" | "active" | "passed" | "eliminated";

export interface PlannedTask {
  title: string;
  description: string;
  dueDate: string | null; // "YYYY-MM-DD"
  priority: Priority;
}

/** Work for a stage that is still locked; it becomes real milestones and tasks when the team advances to it. */
export interface StagePlan {
  marks: { name: string; date: string }[];
  tasks: PlannedTask[];
}

export interface Stage {
  id: string;
  competitionId: string;
  name: string; // "Penyisihan", "Semifinal", "Grand Final", or a custom round
  orderIndex: number;
  status: StageStatus;
  deadline: string; // ISO: submission deadline of this round
  plan?: StagePlan;
  decidedAt?: string;
}

export type OutcomeTier = "juara1" | "juara2" | "juara3" | "harapan" | "finalis" | "gugur_semifinal" | "gugur_kualifikasi";

export interface Evaluation {
  id: string;
  competitionId: string;
  outcome: OutcomeTier;
  rank: string; // free text, e.g. "Rank 2 dari 150 tim"
  score: string; // free text, e.g. "92,4"
  certificateUrl?: string;
  archiveUrl?: string;
  wentWell: string;
  wentWrong: string;
  judgeFeedback: string;
  insights?: string[]; // output of the automatic post-mortem analysis
  completedAt: string;
}

export interface GuideInfo {
  rubric: { criterion: string; weight: string }[];
  deliverables: string[];
  rules: string[];
}
