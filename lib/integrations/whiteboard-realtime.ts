import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { WhiteboardElement } from "../types";

/**
 * Supabase Realtime wiring for the whiteboard (client side, pass the browser client).
 *
 * Two layers, matching schema_phase2.sql:
 *  1. postgres_changes — durable state (notes, strokes, votes) streamed from `whiteboard_elements`.
 *  2. broadcast + presence — ephemeral data (live cursors, in-flight drags, who is online); never written to the DB.
 *     The final drop position is persisted once on pointer-up, so the table sees one write per drag, not hundreds.
 */

export interface CursorMessage {
  userId: string;
  x: number;
  y: number;
}

export interface DragMessage {
  id: string;
  x: number;
  y: number;
  userId: string;
}

export interface WhiteboardHandlers {
  onUpsert: (el: WhiteboardElement) => void;
  onRemove: (id: string) => void;
  onCursor: (m: CursorMessage) => void;
  onDrag: (m: DragMessage) => void;
  onPresence: (userIds: string[]) => void;
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const fromRow = (r: Row): WhiteboardElement => ({
  id: r.id,
  competitionId: r.competition_id,
  type: r.type,
  kind: r.kind ?? undefined,
  content: r.content,
  color: r.color,
  x: r.position_x,
  y: r.position_y,
  points: r.points ?? undefined,
  votes: r.votes ?? [],
  createdBy: r.created_by,
  updatedAt: r.updated_at,
  taskId: r.task_id ?? undefined,
});

export const toRow = (e: WhiteboardElement) => ({
  id: e.id,
  competition_id: e.competitionId,
  type: e.type,
  kind: e.kind ?? null,
  content: e.content,
  color: e.color,
  position_x: e.x,
  position_y: e.y,
  points: e.points ?? null,
  votes: e.votes,
  created_by: e.createdBy,
});

export interface WhiteboardConnection {
  /** Throttle (~30 fps) before calling; these messages are fire-and-forget. */
  sendCursor: (m: CursorMessage) => void;
  sendDrag: (m: DragMessage) => void;
  /** Persist (insert/update) one element. */
  save: (e: WhiteboardElement) => Promise<void>;
  remove: (id: string) => Promise<void>;
  close: () => Promise<void>;
}

export function connectWhiteboard(
  supabase: SupabaseClient,
  competitionId: string,
  me: string,
  handlers: WhiteboardHandlers,
): WhiteboardConnection {
  const channel: RealtimeChannel = supabase.channel(`whiteboard:${competitionId}`, {
    config: { broadcast: { self: false }, presence: { key: me } },
  });

  channel
    .on("postgres_changes", { event: "*", schema: "public", table: "whiteboard_elements", filter: `competition_id=eq.${competitionId}` }, (payload) => {
      if (payload.eventType === "DELETE") handlers.onRemove((payload.old as Row).id);
      else handlers.onUpsert(fromRow(payload.new as Row));
    })
    .on("broadcast", { event: "cursor" }, ({ payload }) => handlers.onCursor(payload as CursorMessage))
    .on("broadcast", { event: "drag" }, ({ payload }) => handlers.onDrag(payload as DragMessage))
    .on("presence", { event: "sync" }, () => handlers.onPresence(Object.keys(channel.presenceState())))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") await channel.track({ at: Date.now() });
    });

  return {
    sendCursor: (m) => void channel.send({ type: "broadcast", event: "cursor", payload: m }),
    sendDrag: (m) => void channel.send({ type: "broadcast", event: "drag", payload: m }),
    save: async (e) => {
      const { error } = await supabase.from("whiteboard_elements").upsert(toRow(e));
      if (error) throw error;
    },
    remove: async (id) => {
      const { error } = await supabase.from("whiteboard_elements").delete().eq("id", id);
      if (error) throw error;
    },
    close: async () => {
      await supabase.removeChannel(channel);
    },
  };
}
