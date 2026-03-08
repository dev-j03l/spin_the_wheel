export type RoomStatus = "waiting" | "teams_submitted" | "locked" | "spun";

export interface Room {
  roomCode: string;
  teams: string[];
  riggedOrder: string[];
  status: RoomStatus;
  groupNames?: string[];
  groupSizes?: number[]; // teams per group; must sum to teams.length
  groupAssignments?: Record<string, string[]>;
  adminKey?: string; // secret for admin link; only set on create, never exposed in GET room
  createdAt?: number;
}

export const ROOM_TTL_SECONDS = 24 * 60 * 60; // 24 hours
