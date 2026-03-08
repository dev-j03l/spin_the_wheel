import { NextResponse } from "next/server";
import { redis, getRoom, createRoom } from "@/lib/redis";
import { generateRoomCode } from "@/lib/room-code";

export async function POST() {
  if (!redis) {
    return NextResponse.json(
      { error: "Redis not configured" },
      { status: 503 }
    );
  }
  let code = generateRoomCode();
  let existing = await getRoom(code);
  let attempts = 0;
  while (existing && attempts < 10) {
    code = generateRoomCode();
    existing = await getRoom(code);
    attempts++;
  }
  if (existing) {
    return NextResponse.json(
      { error: "Could not generate unique room code" },
      { status: 503 }
    );
  }
  const room = await createRoom(code);
  return NextResponse.json({ roomCode: room.roomCode });
}
