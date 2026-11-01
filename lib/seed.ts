import type { AdvisorReport, Competition, Evaluation, Member, Milestone, Notice, Resource, Stage, Task, User, WhiteboardElement } from "./types";

export const TEAM_ROLES = ["Hustler / Lead", "Hacker / AI & Backend", "Hipster / UI-UX", "Researcher"] as const;
export const AVATAR_COLORS = ["#18181B", "#6D28D9", "#047857", "#B45309", "#1D4ED8", "#BE185D", "#0F766E", "#4338CA"];

export const NOTE_COLORS: Record<NonNullable<WhiteboardElement["kind"]>, string> = {
  ide: "#FEF4C7",
  fitur: "#DFF0FF",
  riset: "#DCFCE7",
  kendala: "#FCE4EC",
};

export interface AppData {
  users: User[];
  competitions: Competition[];
  members: Member[];
  stages: Stage[];
  evaluations: Evaluation[];
  milestones: Milestone[];
  tasks: Task[];
  resources: Resource[];
  reports: AdvisorReport[];
  whiteboard: WhiteboardElement[];
  notices: Notice[];
  /** id of the signed-in user, or null on the login screen. Persisted with the rest of the data. */
  session: string | null;
}

/** Fresh, empty dataset: no users, no competitions. Everything is created by the people using the app. */
export function emptyData(): AppData {
  return { users: [], competitions: [], members: [], stages: [], evaluations: [], milestones: [], tasks: [], resources: [], reports: [], whiteboard: [], notices: [], session: null };
}
