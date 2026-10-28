import type { AdvisorReport, Competition, Member, Milestone, Notice, Resource, Task, User, WhiteboardElement } from "./types";

export const TEAM_ROLES = ["Hustler / Lead", "Hacker / AI & Backend", "Hipster / UI-UX", "Researcher"] as const;
export const AVATAR_COLORS = ["#3B82F6", "#EC4899", "#10B981", "#F59E0B", "#8B5CF6", "#06B6D4", "#EF4444", "#14B8A6"];

export const NOTE_COLORS: Record<NonNullable<WhiteboardElement["kind"]>, string> = {
  ide: "#FEF08A",
  fitur: "#BFDBFE",
  riset: "#BBF7D0",
  kendala: "#FECDD3",
};

export interface AppData {
  users: User[];
  competitions: Competition[];
  members: Member[];
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
  return { users: [], competitions: [], members: [], milestones: [], tasks: [], resources: [], reports: [], whiteboard: [], notices: [], session: null };
}
