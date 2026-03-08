import { NextRequest, NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  const room = await getRoom(roomCode);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.status !== "waiting") {
    return NextResponse.json(
      { error: "Teams already submitted or draw locked" },
      { status: 400 }
    );
  }
  const body = await req.json();
  const raw = body.teams ?? body.teamNames;
  const teams = Array.isArray(raw)
    ? raw.map((s: unknown) => String(s).trim()).filter(Boolean)
    : String(raw ?? "")
        .trim()
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter(Boolean);
  if (teams.length === 0) {
    return NextResponse.json(
      { error: "At least one team name required" },
      { status: 400 }
    );
  }
  room.teams = [...new Set(teams)];
  room.riggedOrder = [];
  room.status = "teams_submitted";
  await setRoom(room);
  return NextResponse.json({ teams: room.teams, status: room.status });
}
