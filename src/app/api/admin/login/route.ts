import { NextRequest, NextResponse } from "next/server";
import { getRoom } from "@/lib/redis";
import { signAdminToken } from "@/lib/auth";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function POST(req: NextRequest) {
  const { roomCode, password } = (await req.json()) as {
    roomCode?: string;
    password?: string;
  };
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const code = (roomCode ?? "").toString().trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Room code required" }, { status: 400 });
  }
  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
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
