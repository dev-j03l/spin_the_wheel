import { NextRequest, NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/redis";
import { verifyAdminToken } from "@/lib/auth";
import type { Room } from "@/lib/types";

function withoutAdminKey(room: Room) {
  const { adminKey: _omit, ...safe } = room;
  return safe;
}

function getAuthRoomCode(req: NextRequest): string | null {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  const authCode = getAuthRoomCode(_req);
  if (!authCode || authCode !== roomCode.toUpperCase()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const room = await getRoom(roomCode);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(withoutAdminKey(room));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  const authCode = getAuthRoomCode(req);
  if (!authCode || authCode !== roomCode.toUpperCase()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const room = await getRoom(roomCode);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  const body = await req.json();
  if (body.lockRig === true) {
    let order: string[];
    const groupAssignments = body.groupAssignments as Record<string, string[]> | undefined;
    if (groupAssignments && room.groupNames?.length && typeof groupAssignments === "object") {
      const names = room.groupNames as string[];
      const sizes = room.groupSizes;
      if (sizes && sizes.length === names.length) {
        const total = sizes.reduce((a, b) => a + b, 0);
        if (total !== room.teams.length) {
          return NextResponse.json(
            { error: `Group sizes sum to ${total}; must equal ${room.teams.length} teams` },
            { status: 400 }
          );
        }
        for (let i = 0; i < names.length; i++) {
          const count = (groupAssignments[names[i]] ?? []).length;
          if (count !== sizes[i]) {
            return NextResponse.json(
              { error: `${names[i]} must have ${sizes[i]} teams (got ${count})` },
              { status: 400 }
            );
          }
        }
      }
      const maxLen = Math.max(...names.map((g) => (groupAssignments[g] ?? []).length), 0);
      order = [];
      for (let i = 0; i < maxLen; i++) {
        for (const g of names) {
          const team = (groupAssignments[g] ?? [])[i];
          if (team) order.push(team);
        }
      }
      room.groupAssignments = groupAssignments;
    } else {
      order = (body.riggedOrder ?? room.riggedOrder) as string[];
    }
    const valid = Array.isArray(order) && order.length === room.teams.length
      && order.every((t: string) => room.teams.includes(t));
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid rigged order: must contain each team exactly once" },
        { status: 400 }
      );
    }
    room.riggedOrder = [...order];
    room.status = "locked";
    await setRoom(room);
    return NextResponse.json(withoutAdminKey(room));
  }
  if (body.clearRig === true) {
    room.riggedOrder = [];
    room.groupAssignments = undefined;
    room.status = room.teams.length ? "teams_submitted" : "waiting";
    await setRoom(room);
    return NextResponse.json(withoutAdminKey(room));
  }
  if (body.groupAssignments !== undefined && room.groupNames?.length) {
    const ga = body.groupAssignments as Record<string, string[]>;
    if (typeof ga === "object") {
      room.groupAssignments = ga;
      await setRoom(room);
      return NextResponse.json(withoutAdminKey(room));
    }
  }
  if (Array.isArray(body.riggedOrder)) {
    const order = body.riggedOrder as string[];
    if (order.length !== room.teams.length || !order.every((t: string) => room.teams.includes(t))) {
      return NextResponse.json(
        { error: "Invalid rigged order" },
        { status: 400 }
      );
    }
    room.riggedOrder = order;
    await setRoom(room);
    return NextResponse.json(withoutAdminKey(room));
  }
  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
