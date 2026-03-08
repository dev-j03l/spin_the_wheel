import { Redis } from "@upstash/redis";
import type { Room } from "./types";
import { ROOM_TTL_SECONDS } from "./types";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis =
  url && token
    ? new Redis({ url, token })
    : null;

function roomKey(roomCode: string): string {
  return `room:${roomCode.toUpperCase()}`;
}

export async function getRoom(roomCode: string): Promise<Room | null> {
  if (!redis) return null;
  const data = await redis.get<Room>(roomKey(roomCode));
  return data;
}

export async function setRoom(room: Room): Promise<void> {
  if (!redis) return;
  await redis.set(roomKey(room.roomCode), room, { ex: ROOM_TTL_SECONDS });
}

function randomAdminKey(): string {
  const { randomBytes } = require("crypto");
  return randomBytes(24).toString("hex");
}

export async function createRoom(roomCode: string): Promise<Room> {
  const room: Room = {
    roomCode: roomCode.toUpperCase(),
    teams: [],
    riggedOrder: [],
    status: "waiting",
    adminKey: randomAdminKey(),
    createdAt: Date.now(),
  };
  await setRoom(room);
  return room;
}
