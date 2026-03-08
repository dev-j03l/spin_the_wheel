import { NextRequest, NextResponse } from "next/server";
import { getRoom } from "@/lib/redis";
import { signAdminToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { roomCode, key } = (await req.json()) as {
    roomCode?: string;
    key?: string;
  };
  const code = (roomCode ?? "").toString().trim().toUpperCase();
  if (!code || !key) {
    return NextResponse.json({ error: "Room code and key required" }, { status: 400 });
  }
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.adminKey !== key) {
    return NextResponse.json({ error: "Invalid link" }, { status: 401 });
  }
  const token = signAdminToken(code);
  const res = NextResponse.json({ success: true, roomCode: code });
  res.cookies.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60,
    path: "/",
  });
  return res;
}
