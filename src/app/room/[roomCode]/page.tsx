"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Wheel } from "@/components/Wheel";
import { FakeAd } from "@/components/FakeAd";

type RoomStatus = "waiting" | "teams_submitted" | "locked" | "spun";

interface RoomState {
  roomCode: string;
  teams: string[];
  status: RoomStatus;
  riggedOrder?: string[];
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params?.roomCode as string) ?? "";
  const [room, setRoom] = useState<RoomState | null>(null);
  const [teamInput, setTeamInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [revealedSoFar, setRevealedSoFar] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function ordinal(n: number) {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  }

  const fetchRoom = useCallback(async () => {
    if (!roomCode) return;
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`);
      if (res.status === 404) {
        setRoom(null);
        setError("Room not found");
        return;
      }
      const data = await res.json();
      setRoom({
        roomCode: data.roomCode,
        teams: data.teams ?? [],
        status: data.status,
        riggedOrder: data.riggedOrder,
      });
      setError(null);
    } catch {
      setError("Failed to load room");
    }
  }, [roomCode]);

  useEffect(() => {
    fetchRoom();
    const t = setInterval(fetchRoom, 4000);
    return () => clearInterval(t);
  }, [fetchRoom]);

  async function handleSubmitTeams(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCode) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: teamInput.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      setRoom((prev) => prev ? { ...prev, teams: data.teams, status: data.status } : null);
      setTeamInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSpin() {
    if (!roomCode || room?.status !== "locked" || !room?.riggedOrder?.length) return;
    if (revealedSoFar.length >= room.riggedOrder.length) return;
    setError(null);
    setSpinning(true);
  }

  async function handleSpinComplete() {
    if (!room?.riggedOrder?.length) {
      setSpinning(false);
      return;
    }
    const nextIndex = revealedSoFar.length;
    const nextTeam = room.riggedOrder[nextIndex];
    const newRevealed = [...revealedSoFar, nextTeam];
    setRevealedSoFar(newRevealed);

    if (newRevealed.length === room.riggedOrder.length) {
      await markRoomSpun();
    }
    setSpinning(false);
  }

  async function markRoomSpun() {
    if (!roomCode) return;
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/spin`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to spin");
      setRoom((prev) => prev ? { ...prev, status: "spun", riggedOrder: data.riggedOrder } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  if (error && !room) {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-4 text-slate-600 hover:underline"
        >
          Back to home
        </button>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-slate-600">Loading room…</p>
      </main>
    );
  }

  // Already spun: show full draw
  if (room.status === "spun" && room.riggedOrder?.length) {
    return (
      <main className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">
          Draw result
        </h1>
        <p className="text-slate-600 text-center mb-8">
          Room: {room.roomCode}
        </p>
        <ul className="space-y-2">
          {room.riggedOrder.map((team, i) => (
            <li
              key={i}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm"
            >
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                {i + 1}
              </span>
              <span className="font-medium text-slate-800">{team}</span>
            </li>
          ))}
        </ul>
        <FakeAd variant="inline" />
      </main>
    );
  }

  const canSubmit = room.status === "waiting" && teamInput.trim().length > 0;
  const showSpin = room.status === "locked" && room.riggedOrder && room.riggedOrder.length > 0;
  const remainingTeams = room.riggedOrder?.slice(revealedSoFar.length) ?? [];
  const oneLeft = remainingTeams.length === 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
      <FakeAd variant="sidebar" />
      <main className="flex-1 min-w-0 max-w-lg mx-auto lg:mx-0">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">
          Tournament draw
        </h1>
        <p className="text-slate-600 text-center mb-8">
          Room: {room.roomCode}
        </p>

        {room.status === "waiting" && (
        <form onSubmit={handleSubmitTeams} className="mb-8">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Team names (one per line)
          </label>
          <textarea
            value={teamInput}
            onChange={(e) => setTeamInput(e.target.value)}
            placeholder="Team A&#10;Team B&#10;Team C"
            rows={5}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="mt-3 w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit teams"}
          </button>
        </form>
      )}

      {room.status === "teams_submitted" && (
        <div className="text-center py-6 text-slate-600">
          <p>Teams are in. Waiting for the organiser to lock the draw.</p>
          <p className="text-sm mt-2">Teams: {room.teams.join(", ")}</p>
        </div>
      )}

      {showSpin && (
        <div className="space-y-6">
          {revealedSoFar.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500 mb-2">Draw so far</p>
              <ol className="space-y-1">
                {revealedSoFar.map((team, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium w-6">{ordinal(i + 1)}</span>
                    <span className="font-medium text-slate-800">{team}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {oneLeft ? (
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm text-center">
              <p className="text-slate-600 mb-2">
                Only one team left — no need to spin!
              </p>
              <p className="text-xl font-bold text-emerald-700 mb-4">
                {ordinal(revealedSoFar.length + 1)} place: {remainingTeams[0]}
              </p>
              <button
                type="button"
                onClick={markRoomSpun}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
              >
                Show full draw
              </button>
            </div>
          ) : (
            <>
              <Wheel
                items={remainingTeams}
                targetIndex={0}
                isSpinning={spinning}
                onSpinComplete={handleSpinComplete}
              />
              {!spinning && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleSpin}
                    className="px-8 py-4 text-xl font-bold bg-amber-500 text-white rounded-xl hover:bg-amber-600 shadow-lg"
                  >
                    {revealedSoFar.length === 0
                      ? "SPIN!"
                      : `SPIN for ${ordinal(revealedSoFar.length + 1)} place`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {room.status === "locked" && (!room.riggedOrder || room.riggedOrder.length === 0) && (
        <p className="text-center text-slate-600">Preparing draw…</p>
      )}

        {error && (
          <p className="mt-4 text-red-600 text-sm text-center">{error}</p>
        )}
        <FakeAd variant="inline" />
      </main>
    </div>
  );
}
