"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { SortableTeamList } from "@/components/SortableTeamList";
import { GroupAssignmentsEditor } from "@/components/GroupAssignmentsEditor";
import { GoogleAd } from "@/components/GoogleAd";

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

function AdminByCodeContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomCodeFromUrl = (params?.roomCode as string) ?? "";
  const code = roomCodeFromUrl.trim().toUpperCase();

  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [linkVerifying, setLinkVerifying] = useState(!!searchParams.get("key"));
  const [sessionChecking, setSessionChecking] = useState(!searchParams.get("key"));
  const [room, setRoom] = useState<Room | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [groupAssignments, setGroupAssignments] = useState<Record<string, string[]>>({});
  const lastGroupsInitKeyRef = useRef<string>("");

  const fetchRoom = useCallback(async (c: string) => {
    if (!c) return;
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(c)}`);
      if (res.status === 401) {
        setLoggedIn(false);
        setRoom(null);
        return;
      }
      if (!res.ok) return;
      const data: Room = await res.json();
      setRoom(data);
      setLoggedIn(true);
    } catch {
      setRoom(null);
    }
  }, []);

  // Verify secret link: /admin/HUX-687?key=xxx
  useEffect(() => {
    const key = searchParams.get("key");
    if (!code || !key) {
      setLinkVerifying(false);
      return;
    }
    fetch("/api/admin/verify-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode: code, key }),
    })
      .then((r) => r.json())
      .then((data) => {
        setLinkVerifying(false);
        if (data.success && data.roomCode) {
          setLoggedIn(true);
          window.history.replaceState({}, "", `/admin/${code}`);
        }
      })
      .catch(() => setLinkVerifying(false));
  }, [code, searchParams]);

  // If no key in URL, check whether we already have a valid session for this room
  useEffect(() => {
    if (!code || linkVerifying) return;
    let cancelled = false;
    fetch(`/api/admin/rooms/${encodeURIComponent(code)}`)
      .then((res) => {
        if (cancelled) return;
        if (res.status === 200) setLoggedIn(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSessionChecking(false);
      });
    return () => { cancelled = true; };
  }, [code, linkVerifying]);

  useEffect(() => {
    if (!code || !loggedIn) return;
    fetchRoom(code);
    const t = setInterval(() => fetchRoom(code), 3000);
    return () => clearInterval(t);
  }, [code, loggedIn, fetchRoom]);

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
        body: JSON.stringify({ roomCode: code, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error ?? "Login failed");
        return;
      }
      setLoggedIn(true);
      setPassword("");
    } catch {
      setLoginError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleLockRig() {
    if (!code || !room) return;
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
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(code)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to set order");
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
    if (!code) return;
    setActionError(null);
    setClearLoading(true);
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(code)}`, {
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
    setLoggedIn(false);
    setRoom(null);
    setOrder([]);
    document.cookie = "admin_session=; path=/; max-age=0";
  }

  if (!code) {
    return (
      <main className="max-w-sm mx-auto px-4 py-16 text-center">
        <p className="text-slate-400">Page not found.</p>
        <p className="mt-4">
          <Link href="/" className="text-slate-400 text-sm hover:text-slate-200 hover:underline">Back to home</Link>
        </p>
      </main>
    );
  }

  if (linkVerifying || sessionChecking) {
    return (
      <main className="max-w-sm mx-auto px-4 py-16 text-center">
        <p className="text-slate-400">{linkVerifying ? "Verifying link…" : "Loading…"}</p>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="max-w-sm mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-slate-100 mb-2 text-center">
          {code}
        </h1>
        <p className="text-slate-400 text-center mb-8 text-sm">
          Enter password to continue.
        </p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
              required
              autoFocus
            />
          </div>
          {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-amber-500 text-slate-900 rounded-lg font-medium hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-6 text-center">
          <Link href={`/${code}`} className="text-slate-400 text-sm hover:text-slate-200 hover:underline">
            Back to wheel
          </Link>
        </p>
        <GoogleAd variant="inline" />
      </main>
    );
  }

  const statusLabel =
    room?.status === "waiting"
      ? "Waiting for teams"
      : room?.status === "teams_submitted"
        ? "Teams in — set order"
        : room?.status === "locked"
          ? "Ready to spin"
          : "Spun";
  const statusColor =
    room?.status === "waiting"
      ? "bg-red-900/40 text-red-300"
      : room?.status === "teams_submitted"
        ? "bg-amber-900/40 text-amber-300"
        : room?.status === "locked"
          ? "bg-emerald-900/40 text-emerald-300"
          : "bg-slate-700 text-slate-300";
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
        <h1 className="text-2xl font-bold text-slate-100">{code}</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          Log out
        </button>
      </div>

      <div className={`rounded-lg px-3 py-2 text-sm font-medium mb-6 ${statusColor}`}>
        {statusDot} {statusLabel}
      </div>

      {room?.status === "waiting" && (
        <p className="text-slate-400 mb-6">
          Share the wheel link so participants can add teams. Teams will appear here when they submit.
        </p>
      )}

      {room && room.teams.length > 0 && (
        <>
          {room.groupNames?.length ? (
            <>
              <h2 className="text-lg font-semibold text-slate-100 mb-2">
                Assign teams to groups (drag and drop)
              </h2>
              <p className="text-slate-400 text-sm mb-4">
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
              <h2 className="text-lg font-semibold text-slate-100 mb-2">
                Draw order (drag to reorder)
              </h2>
              <p className="text-slate-400 text-sm mb-4">
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
              className="flex-1 py-2.5 bg-amber-500 text-slate-900 rounded-lg font-medium hover:bg-amber-400 disabled:opacity-50"
            >
              {lockLoading ? "Saving…" : "Set order"}
            </button>
            <button
              type="button"
              onClick={handleClearRig}
              disabled={
                clearLoading ||
                room.status === "waiting" ||
                (room.status === "teams_submitted" && !room.riggedOrder?.length)
              }
              className="flex-1 py-2.5 bg-slate-700 text-slate-200 rounded-lg font-medium hover:bg-slate-600 disabled:opacity-50"
            >
              {clearLoading ? "Clearing…" : "Reset order"}
            </button>
          </div>
        </>
      )}

      {room && room.teams.length === 0 && room.status !== "waiting" && (
        <p className="text-slate-400">No teams in this room yet.</p>
      )}

      {actionError && <p className="mt-4 text-red-400 text-sm">{actionError}</p>}

      <p className="mt-8 text-center">
        <Link
          href={`/${code}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 text-sm hover:text-slate-200 hover:underline"
        >
          Open wheel →
        </Link>
      </p>
      <GoogleAd variant="inline" />
    </main>
  );
}

export default function AdminByCodePage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-sm mx-auto px-4 py-16 text-center">
          <p className="text-slate-400">Loading…</p>
        </main>
      }
    >
      <AdminByCodeContent />
    </Suspense>
  );
}
