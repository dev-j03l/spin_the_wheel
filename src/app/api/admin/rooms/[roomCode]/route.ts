import { NextRequest, NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/redis";
import { verifyAdminToken } from "@/lib/auth";

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
  return NextResponse.json(room);
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
    const order = (body.riggedOrder ?? room.riggedOrder) as string[];
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
    return NextResponse.json(room);
  }
  if (body.clearRig === true) {
    room.riggedOrder = [];
    room.status = room.teams.length ? "teams_submitted" : "waiting";
    await setRoom(room);
    return NextResponse.json(room);
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
    return NextResponse.json(room);
  }
  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
