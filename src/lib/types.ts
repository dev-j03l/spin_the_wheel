export type RoomStatus = "waiting" | "teams_submitted" | "locked" | "spun";

export interface Room {
  roomCode: string;
  teams: string[];
  riggedOrder: string[];
  status: RoomStatus;
  createdAt?: number;
}

export const ROOM_TTL_SECONDS = 24 * 60 * 60; // 24 hours
