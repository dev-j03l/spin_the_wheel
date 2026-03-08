import { NextRequest, NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/redis";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  const room = await getRoom(roomCode);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.status !== "locked") {
    return NextResponse.json(
      { error: "Draw not locked yet" },
      { status: 400 }
    );
  }
  room.status = "spun";
  await setRoom(room);
  return NextResponse.json({
    status: "spun",
    riggedOrder: room.riggedOrder,
  });
}
