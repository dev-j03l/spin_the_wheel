"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { Wheel } from "@/components/Wheel";
import { FakeAd } from "@/components/FakeAd";

type RoomStatus = "waiting" | "teams_submitted" | "locked" | "spun";

interface RoomState {
  roomCode: string;
  teams: string[];
  status: RoomStatus;
  riggedOrder?: string[];
  groupNames?: string[];
  groupSizes?: number[];
  groupAssignments?: Record<string, string[]>;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params?.roomCode as string) ?? "";
  const [room, setRoom] = useState<RoomState | null>(null);
  const [teamEntries, setTeamEntries] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [revealedSoFar, setRevealedSoFar] = useState<string[]>([]);
  const [randomWinner, setRandomWinner] = useState<string | null>(null);
  const [randomTargetIndex, setRandomTargetIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [groupCount, setGroupCount] = useState(0);
  const [groupNamesInput, setGroupNamesInput] = useState("");
  const [groupSizes, setGroupSizes] = useState<number[]>([]);
  const [groupsSaving, setGroupsSaving] = useState(false);
  const lastSyncedGroupNamesRef = useRef<string>("");
  const lastSyncedGroupSizesRef = useRef<string>("");

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
        groupNames: data.groupNames,
        groupSizes: data.groupSizes,
        groupAssignments: data.groupAssignments,
      });
      if (data.status !== "waiting") {
        setTeamEntries(data.teams?.length ? [...data.teams, ""] : [""]);
      }
      const serverGroupsKey = JSON.stringify(data.groupNames ?? []);
      const serverSizesKey = JSON.stringify(data.groupSizes ?? []);
      if (serverGroupsKey !== lastSyncedGroupNamesRef.current || serverSizesKey !== lastSyncedGroupSizesRef.current) {
        lastSyncedGroupNamesRef.current = serverGroupsKey;
        lastSyncedGroupSizesRef.current = serverSizesKey;
        if (data.groupNames?.length) {
          setGroupCount(data.groupNames.length);
          setGroupNamesInput(data.groupNames.join(", "));
          setGroupSizes(
            Array.isArray(data.groupSizes) && data.groupSizes.length === data.groupNames.length
              ? data.groupSizes
              : data.groupNames.map(() => 1)
          );
        } else {
          setGroupCount(0);
          setGroupNamesInput("");
          setGroupSizes([]);
        }
      }
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
    const teams = teamEntries.map((s) => s.trim()).filter(Boolean);
    if (teams.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      setRoom((prev) => prev ? { ...prev, teams: data.teams, status: data.status } : null);
      setTeamEntries([...data.teams, ""]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function addTeamSlot() {
    setTeamEntries((prev) => [...prev, ""]);
  }

  function updateTeamEntry(index: number, value: string) {
    setTeamEntries((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function removeTeamEntry(index: number) {
    setTeamEntries((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveGroups() {
    if (!roomCode) return;
    const list = groupNamesInput.trim()
      ? groupNamesInput.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
      : groupCount > 0
        ? Array.from({ length: groupCount }, (_, i) => `Group ${String.fromCharCode(65 + i)}`)
        : [];
    const sizes =
      groupSizes.length >= list.length
        ? groupSizes.slice(0, list.length)
        : [...groupSizes, ...Array(list.length - groupSizes.length).fill(1)];
    const totalTeams = room?.teams?.length ?? 0;
    if (list.length > 0 && sizes.length === list.length && totalTeams > 0) {
      const sum = sizes.reduce((a, b) => a + b, 0);
      if (sum !== totalTeams) {
        setError(`Group sizes must sum to ${totalTeams} teams (currently ${sum}).`);
        return;
      }
    }
    setGroupsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupNames: list, groupSizes: list.length ? sizes : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setRoom((prev) => prev ? { ...prev, groupNames: data.groupNames, groupSizes: data.groupSizes } : null);
      lastSyncedGroupNamesRef.current = JSON.stringify(data.groupNames ?? []);
      lastSyncedGroupSizesRef.current = JSON.stringify(data.groupSizes ?? []);
      if (data.groupNames?.length) {
        setGroupNamesInput(data.groupNames.join(", "));
        setGroupCount(data.groupNames.length);
        setGroupSizes(
          Array.isArray(data.groupSizes) && data.groupSizes.length === data.groupNames.length
            ? data.groupSizes
            : data.groupNames.map(() => 1)
        );
      } else {
        setGroupNamesInput("");
        setGroupCount(0);
        setGroupSizes([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGroupsSaving(false);
    }
  }

  function handleSpin() {
    if (!room) return;
    setError(null);
    setRandomWinner(null);
    if (room.status === "locked" && room.riggedOrder?.length) {
      if (revealedSoFar.length >= room.riggedOrder.length) return;
      setSpinning(true);
      return;
    }
    if (room.status === "teams_submitted" && room.teams?.length) {
      const idx = Math.floor(Math.random() * room.teams.length);
      setRandomTargetIndex(idx);
      setSpinning(true);
    }
  }

  async function handleSpinComplete() {
    if (!room) {
      setSpinning(false);
      return;
    }
    if (room.status === "locked" && room.riggedOrder?.length) {
      const nextIndex = revealedSoFar.length;
      const nextTeam = room.riggedOrder[nextIndex];
      setRevealedSoFar((prev) => [...prev, nextTeam]);
      if (revealedSoFar.length + 1 >= room.riggedOrder.length) {
        await markRoomSpun();
      }
      setSpinning(false);
      return;
    }
    if (room.status === "teams_submitted" && room.teams?.length) {
      setRandomWinner(room.teams[randomTargetIndex] ?? null);
      setSpinning(false);
    }
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

  // Already spun: show full draw (by groups if group stage)
  if (room.status === "spun" && room.riggedOrder?.length) {
    const groups =
      room.groupNames?.length && room.groupAssignments
        ? room.groupNames.map((name) => ({
            name,
            teams: room.groupAssignments![name] ?? [],
          }))
        : room.groupNames?.length
          ? (() => {
              const perGroup = Math.ceil(room.riggedOrder!.length / room.groupNames!.length);
              return room.groupNames!.map((name, i) => ({
                name,
                teams: room.riggedOrder!.slice(i * perGroup, (i + 1) * perGroup),
              }));
            })()
          : null;

    return (
      <main className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">
          {groups ? "Group stage draw" : "Draw result"}
        </h1>
        <p className="text-slate-600 text-center mb-8">
          Room: {room.roomCode}
        </p>
        {groups ? (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.name} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                <h2 className="font-semibold text-slate-800 mb-3">{g.name}</h2>
                <ul className="space-y-1">
                  {g.teams.map((team, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm w-5">{i + 1}.</span>
                      <span className="font-medium text-slate-800">{team}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {room.riggedOrder!.map((team, i) => (
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
        )}
        <FakeAd variant="inline" />
      </main>
    );
  }

  const localTeams = teamEntries.map((s) => s.trim()).filter(Boolean);
  const canSubmit = room.status === "waiting" && localTeams.length > 0;
  const isLockedDraw = room.status === "locked" && room.riggedOrder && room.riggedOrder.length > 0;
  const remainingTeams = room.riggedOrder?.slice(revealedSoFar.length) ?? [];
  const oneLeft = isLockedDraw && remainingTeams.length === 1;

  // Wheel items: when waiting use local entries; else placeholder or server data
  const wheelItems =
    room.status === "waiting"
      ? localTeams.length > 0
        ? localTeams
        : ["Add teams below"]
      : room.teams.length === 0
        ? ["Add teams below"]
        : isLockedDraw
          ? remainingTeams
          : room.teams;
  const wheelTargetIndex = isLockedDraw ? 0 : randomTargetIndex;
  const canSpin =
    wheelItems.length > 0 &&
    wheelItems[0] !== "Add teams below" &&
    (isLockedDraw ? revealedSoFar.length < room.riggedOrder!.length : true);
  const showIdleSpin = !spinning && wheelItems.length > 0 && wheelItems[0] !== "Add teams below";

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

        {(room.status === "waiting" || room.status === "teams_submitted" || room.status === "locked" || room.status === "spun") && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Group stage</h2>
            <p className="text-slate-500 text-xs mb-3">
              {room.status === "locked" || room.status === "spun"
                ? "Group configuration (draw is locked)."
                : "Set number of groups or names (e.g. Group A, Group B). The organiser will assign teams to groups."}
            </p>
            <div className="flex flex-wrap gap-2 items-center mb-2">
              <label className="text-sm text-slate-600">Number of groups:</label>
              <select
                value={groupCount || ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setGroupCount(n || 0);
                  if (n > 0) {
                    const names = Array.from({ length: n }, (_, i) => `Group ${String.fromCharCode(65 + i)}`).join(", ");
                    setGroupNamesInput(names);
                    setGroupSizes(Array.from({ length: n }, () => 1));
                  } else {
                    setGroupNamesInput("");
                    setGroupSizes([]);
                  }
                }}
                disabled={room.status === "locked" || room.status === "spun"}
                className="px-2 py-1.5 border border-slate-300 rounded text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">—</option>
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={groupNamesInput}
              onChange={(e) => setGroupNamesInput(e.target.value)}
              placeholder="Group A, Group B, Group C, Group D"
              disabled={room.status === "locked" || room.status === "spun"}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {(() => {
              const names = groupNamesInput.trim()
                ? groupNamesInput.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
                : groupCount > 0
                  ? Array.from({ length: groupCount }, (_, i) => `Group ${String.fromCharCode(65 + i)}`)
                  : [];
              const sizes = names.length
                ? groupSizes.length >= names.length
                  ? groupSizes.slice(0, names.length)
                  : [...groupSizes, ...Array(names.length - groupSizes.length).fill(1)]
                : [];
              const totalTeams = room?.teams?.length ?? 0;
              const sum = sizes.reduce((a, b) => a + b, 0);
              const sumValid = totalTeams === 0 || sum === totalTeams;
              return names.length > 0 ? (
                <div className="mb-3 space-y-2">
                  <p className="text-slate-500 text-xs">Teams per group (must sum to total teams):</p>
                  <div className="flex flex-wrap gap-3 items-center">
                    {names.map((name, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <label className="text-sm text-slate-600 whitespace-nowrap">{name}:</label>
                        <input
                          type="number"
                          min={0}
                          value={sizes[i] ?? 1}
                          onChange={(e) => {
                            const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setGroupSizes((prev) => {
                              const next = [...(prev.length >= names.length ? prev.slice(0, names.length) : [...prev, ...Array(names.length - prev.length).fill(1)])];
                              next[i] = v;
                              return next;
                            });
                          }}
                          disabled={room.status === "locked" || room.status === "spun"}
                          className="w-14 px-2 py-1 border border-slate-300 rounded text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                    ))}
                  </div>
                  {totalTeams > 0 && (
                    <p className={`text-xs ${sumValid ? "text-slate-500" : "text-amber-600"}`}>
                      Sum: {sum} {totalTeams > 0 && (sumValid ? `(matches ${totalTeams} teams)` : `— must equal ${totalTeams} teams`)}
                    </p>
                  )}
                </div>
              ) : null;
            })()}
            <button
              type="button"
              onClick={handleSaveGroups}
              disabled={groupsSaving || room.status === "locked" || room.status === "spun"}
              className="text-sm py-1.5 px-3 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {groupsSaving ? "Saving…" : "Save groups"}
            </button>
          </div>
        )}

        {room.status === "waiting" && (
          <form onSubmit={handleSubmitTeams} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                Teams
              </label>
              <button
                type="button"
                onClick={addTeamSlot}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                + Add team
              </button>
            </div>
            <ul className="space-y-2 mb-3">
              {teamEntries.map((value, index) => (
                <li key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateTeamEntry(index, e.target.value)}
                    placeholder={`Team ${index + 1}`}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeTeamEntry(index)}
                    disabled={teamEntries.length <= 1}
                    className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30"
                    title="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit teams"}
            </button>
          </form>
        )}

        <div className="space-y-6">
          {isLockedDraw && revealedSoFar.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500 mb-2">Draw so far</p>
              {room.groupNames?.length ? (
                <div className="space-y-3">
                  {room.groupNames.map((g) => {
                    const teamsInGroup = revealedSoFar.filter(
                      (_, j) => j % room.groupNames!.length === room.groupNames!.indexOf(g)
                    );
                    if (teamsInGroup.length === 0) return null;
                    return (
                      <div key={g}>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{g}</p>
                        <p className="text-slate-800 font-medium">{teamsInGroup.join(" → ")}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ol className="space-y-1">
                  {revealedSoFar.map((team, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-slate-400 font-medium w-6">{ordinal(i + 1)}</span>
                      <span className="font-medium text-slate-800">{team}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {isLockedDraw && oneLeft ? (
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
                items={wheelItems}
                targetIndex={wheelTargetIndex}
                isSpinning={spinning}
                onSpinComplete={handleSpinComplete}
                idleSpin={showIdleSpin}
              />
              {!spinning && canSpin && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleSpin}
                    className="px-8 py-4 text-xl font-bold bg-amber-500 text-white rounded-xl hover:bg-amber-600 shadow-lg"
                  >
                    {isLockedDraw
                      ? revealedSoFar.length === 0
                        ? "SPIN!"
                        : room.groupNames?.length
                          ? `SPIN for ${room.groupNames[revealedSoFar.length % room.groupNames.length]}`
                          : `SPIN for ${ordinal(revealedSoFar.length + 1)} place`
                      : randomWinner
                        ? "Spin again"
                        : "SPIN!"}
                  </button>
                </div>
              )}
              {!spinning && !isLockedDraw && randomWinner && (
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm text-center">
                  <p className="text-sm text-slate-500 mb-1">Winner</p>
                  <p className="text-xl font-bold text-emerald-700">{randomWinner}</p>
                  <p className="text-xs text-slate-400 mt-2">Draw not locked yet — result is random</p>
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 text-red-600 text-sm text-center">{error}</p>
        )}
        <FakeAd variant="inline" />
      </main>
    </div>
  );
}
