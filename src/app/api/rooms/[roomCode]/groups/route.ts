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
  if (room.status === "locked" || room.status === "spun") {
    return NextResponse.json(
      { error: "Cannot change groups after draw is locked" },
      { status: 400 }
    );
  }
  const body = await req.json();
  const raw = body.groupNames;
  const groupNames = Array.isArray(raw)
    ? raw.map((g: unknown) => String(g).trim()).filter(Boolean)
    : typeof raw === "string"
      ? raw.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean)
      : [];
  const rawSizes = body.groupSizes;
  let groupSizes: number[] | undefined;
  if (Array.isArray(rawSizes) && rawSizes.length === groupNames.length) {
    groupSizes = rawSizes.map((s: unknown) => Math.max(0, parseInt(String(s), 10) || 0));
  }

  if (groupNames.length === 0) {
    room.groupNames = undefined;
    room.groupSizes = undefined;
    room.groupAssignments = undefined;
  } else {
    room.groupNames = groupNames;
    room.groupSizes = groupSizes;
    room.groupAssignments = undefined;
    if (groupSizes && room.teams.length > 0) {
      const sum = groupSizes.reduce((a, b) => a + b, 0);
      if (sum !== room.teams.length) {
        return NextResponse.json(
          { error: `Group sizes must sum to ${room.teams.length} teams (got ${sum})` },
          { status: 400 }
        );
      }
    }
  }
  await setRoom(room);
  return NextResponse.json({ groupNames: room.groupNames, groupSizes: room.groupSizes });
}
