import { NextRequest, NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/redis";
import type { Room, RoomStatus } from "@/lib/types";

function publicRoom(room: Room) {
  return {
    roomCode: room.roomCode,
    teams: room.teams,
    status: room.status,
    // Expose when locked (wheel needs segment order to spin) and when spun (show result)
    riggedOrder:
      room.status === "locked" || room.status === "spun"
        ? room.riggedOrder
        : undefined,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  const room = await getRoom(roomCode);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(publicRoom(room));
}
