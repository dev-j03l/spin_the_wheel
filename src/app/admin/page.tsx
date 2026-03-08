"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SortableTeamList } from "@/components/SortableTeamList";
import { GroupAssignmentsEditor } from "@/components/GroupAssignmentsEditor";
import { FakeAd } from "@/components/FakeAd";

type RoomStatus = "waiting" | "teams_submitted" | "locked" | "spun";

interface Room {
  roomCode: string;
  teams: string[];
  riggedOrder: string[];
  status: RoomStatus;
  groupNames?: string[];
  groupSizes?: number[];
  groupAssignments?: Record<string, string[]>;
}

function AdminContent() {
  const searchParams = useSearchParams();
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [loggedInRoom, setLoggedInRoom] = useState<string | null>(null);
  const [linkVerifying, setLinkVerifying] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [groupAssignments, setGroupAssignments] = useState<Record<string, string[]>>({});
  const lastGroupsInitKeyRef = useRef<string>("");

  const fetchRoom = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(code)}`);
      if (res.status === 401) {
        setLoggedInRoom(null);
        setRoom(null);
        return;
      }
      if (!res.ok) return;
      const data: Room = await res.json();
      setRoom(data);
      // Don't set order here — let the sync effect handle it only when initializing or team list changed
    } catch {
      setRoom(null);
    }
  }, []);

  useEffect(() => {
    const room = searchParams.get("room");
    const key = searchParams.get("key");
    if (room && key) {
      fetch("/api/admin/verify-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: room.trim().toUpperCase(), key }),
      })
        .then((r) => r.json())
        .then((data) => {
          setLinkVerifying(false);
          if (data.success && data.roomCode) {
            setLoggedInRoom(data.roomCode);
            window.history.replaceState({}, "", "/admin");
          }
        })
        .catch(() => setLinkVerifying(false));
    } else {
      setLinkVerifying(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loggedInRoom) return;
    fetchRoom(loggedInRoom);
    const t = setInterval(() => fetchRoom(loggedInRoom), 3000);
    return () => clearInterval(t);
  }, [loggedInRoom, fetchRoom]);

  // Only sync order from server when initializing or when team list changed.
  // Don't overwrite on every poll while the user is dragging (same length + same teams = possible local reorder).
  useEffect(() => {
    if (!room?.teams?.length) return;
    const serverOrder =
      room.riggedOrder?.length === room.teams.length
        ? room.riggedOrder
        : room.teams;
    const teamCountChanged = order.length !== room.teams.length;
    const hasNewOrRemovedTeams = room.teams.some((t) => !order.includes(t));
    const isEmpty = order.length === 0;
    if (isEmpty || teamCountChanged || hasNewOrRemovedTeams) {
      setOrder([...serverOrder]);
    }
  }, [room?.teams, room?.riggedOrder]);

  useEffect(() => {
    if (!room?.groupNames?.length || !room?.teams?.length) return;
    if (room.groupAssignments && Object.keys(room.groupAssignments).length > 0) {
      lastGroupsInitKeyRef.current = "";
      setGroupAssignments(room.groupAssignments);
    } else {
      const initKey = `${room.groupNames.join(",")}|${room.teams.join(",")}`;
      if (initKey !== lastGroupsInitKeyRef.current) {
        lastGroupsInitKeyRef.current = initKey;
        const names = room.groupNames;
        const acc: Record<string, string[]> = {};
        names.forEach((g) => (acc[g] = []));
        room.teams.forEach((t, i) => {
          acc[names[i % names.length]].push(t);
        });
        setGroupAssignments(acc);
      }
    }
  }, [room?.groupNames, room?.groupAssignments, room?.teams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: roomCode.trim().toUpperCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error ?? "Login failed");
        return;
      }
      setLoggedInRoom(data.roomCode ?? roomCode.trim().toUpperCase());
      setRoomCode("");
      setPassword("");
    } catch {
      setLoginError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleLockRig() {
    if (!loggedInRoom || !room) return;
    if (room.groupNames?.length) {
      const flat = room.groupNames.flatMap((g) => groupAssignments[g] ?? []);
      if (flat.length !== room.teams.length || room.teams.some((t) => !flat.includes(t))) return;
    } else if (order.length === 0) return;

    setActionError(null);
    setLockLoading(true);
    try {
      const body = room.groupNames?.length
        ? { lockRig: true, groupAssignments }
        : { lockRig: true, riggedOrder: order };
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(loggedInRoom)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to lock");
        return;
      }
      setRoom(data);
      setOrder([...(data.riggedOrder ?? [])]);
      if (data.groupAssignments) setGroupAssignments(data.groupAssignments);
    } catch {
      setActionError("Something went wrong");
    } finally {
      setLockLoading(false);
    }
  }

  async function handleClearRig() {
    if (!loggedInRoom) return;
    setActionError(null);
    setClearLoading(true);
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(loggedInRoom)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearRig: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to clear");
        return;
      }
      setRoom(data);
      setOrder([...(data.teams ?? [])]);
    } catch {
      setActionError("Something went wrong");
    } finally {
      setClearLoading(false);
    }
  }

  function handleLogout() {
    setLoggedInRoom(null);
    setRoom(null);
    setOrder([]);
    document.cookie = "admin_session=; path=/; max-age=0";
  }

  // Login form
  if (!loggedInRoom) {
    if (linkVerifying) {
      return (
        <main className="max-w-sm mx-auto px-4 py-16 text-center">
          <p className="text-slate-600">Verifying link…</p>
        </main>
      );
    }
    return (
      <main className="max-w-sm mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">
          Admin
        </h1>
        <p className="text-slate-600 text-center mb-8 text-sm">
          Use your admin link (from when you created the room) to open the panel with no password. Or enter room code + password below.
        </p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Room code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="WOLF-7842"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              required
            />
          </div>
          {loginError && (
            <p className="text-red-600 text-sm">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-6 text-center">
          <Link href="/" className="text-slate-500 text-sm hover:underline">
            Back to home
          </Link>
        </p>
        <FakeAd variant="inline" />
      </main>
    );
  }

  // Dashboard
  const statusLabel =
    room?.status === "waiting"
      ? "Waiting for teams"
      : room?.status === "teams_submitted"
        ? "Teams in, rig not set"
        : room?.status === "locked"
          ? "Rig locked — ready to spin"
          : "Spun";
  const statusColor =
    room?.status === "waiting"
      ? "bg-red-100 text-red-700"
      : room?.status === "teams_submitted"
        ? "bg-amber-100 text-amber-700"
        : room?.status === "locked"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-700";
  const statusDot =
    room?.status === "waiting"
      ? "🔴"
      : room?.status === "teams_submitted"
        ? "🟡"
        : room?.status === "locked"
          ? "🟢"
          : "⚫";

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Admin — {loggedInRoom}
        </h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Log out
        </button>
      </div>

      <div className={`rounded-lg px-3 py-2 text-sm font-medium mb-6 ${statusColor}`}>
        {statusDot} {statusLabel}
      </div>

      {room?.status === "waiting" && (
        <p className="text-slate-600 mb-6">
          Share the room link with participants so they can submit team names. Teams will appear here when submitted.
        </p>
      )}

      {room && room.teams.length > 0 && (
        <>
          {room.groupNames?.length ? (
            <>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">
                Assign teams to groups (drag and drop)
              </h2>
              <p className="text-slate-500 text-sm mb-4">
                Drag teams between groups. Order within each group is the draw order. On mobile, long-press to drag.
              </p>
              <div className="mb-6">
                <GroupAssignmentsEditor
                  groupNames={room.groupNames}
                  groupSizes={room.groupSizes}
                  teams={room.teams}
                  value={groupAssignments}
                  onChange={setGroupAssignments}
                  disabled={room.status === "locked" || room.status === "spun"}
                />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">
                Draw order (drag to reorder)
              </h2>
              <p className="text-slate-500 text-sm mb-4">
                First in list = 1st in draw, then 2nd, 3rd, etc. On mobile, long-press a row to drag.
              </p>
              <div className="mb-6">
                <SortableTeamList
                  items={order}
                  onChange={setOrder}
                  disabled={room.status === "locked" || room.status === "spun"}
                />
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleLockRig}
              disabled={
                lockLoading ||
                room.status === "locked" ||
                room.status === "spun" ||
                (room.groupNames?.length
                  ? (() => {
                      const flat = (room.groupNames ?? []).flatMap((g) => groupAssignments[g] ?? []);
                      return flat.length !== room.teams.length || room.teams.some((t) => !flat.includes(t));
                    })()
                  : order.length !== room.teams.length)
              }
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {lockLoading ? "Saving…" : "Lock rig"}
            </button>
            <button
              type="button"
              onClick={handleClearRig}
              disabled={
                clearLoading ||
                room.status === "waiting" ||
                (room.status === "teams_submitted" && !room.riggedOrder?.length)
              }
              className="flex-1 py-2.5 bg-slate-200 text-slate-800 rounded-lg font-medium hover:bg-slate-300 disabled:opacity-50"
            >
              {clearLoading ? "Clearing…" : "Clear rig"}
            </button>
          </div>
        </>
      )}

      {room && room.teams.length === 0 && room.status !== "waiting" && (
        <p className="text-slate-600">No teams in this room yet.</p>
      )}

      {actionError && (
        <p className="mt-4 text-red-600 text-sm">{actionError}</p>
      )}

      <p className="mt-8 text-center">
        <Link
          href={`/room/${loggedInRoom}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-500 text-sm hover:underline"
        >
          Open public page →
        </Link>
      </p>
      <FakeAd variant="inline" />
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <main className="max-w-sm mx-auto px-4 py-16 text-center">
        <p className="text-slate-600">Loading…</p>
      </main>
    }>
      <AdminContent />
    </Suspense>
  );
}
