"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import { Wheel } from "@/components/Wheel";
import { GoogleAd } from "@/components/GoogleAd";

function playRevealSound() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // ignore
  }
}

function fireRevealConfetti() {
  const count = 150;
  const defaults = { origin: { y: 0.6 }, zIndex: 9999 };
  confetti({ ...defaults, particleCount: count, spread: 70 });
  confetti({ ...defaults, particleCount: count / 2, angle: 60, spread: 55 });
  confetti({ ...defaults, particleCount: count / 2, angle: 120, spread: 55 });
}

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

const DEFAULT_WHEEL_NAMES = ["Beatriz", "Diya", "Fatima", "Gabriel"];

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params?.roomCode as string) ?? "";
  const [room, setRoom] = useState<RoomState | null>(null);
  const [entriesText, setEntriesText] = useState("");
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
  const [entriesTab, setEntriesTab] = useState<"entries" | "results">("entries");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [revealPopupName, setRevealPopupName] = useState<string | null>(null);
  const lastSyncedGroupNamesRef = useRef<string>("");
  const lastSyncedGroupSizesRef = useRef<string>("");
  const defaultNamesSetRef = useRef(false);
  const hasSyncedEntriesFromServerRef = useRef(false);

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
      // Only overwrite entriesText from server on initial load or when draw is locked/spun.
      // Otherwise polling would wipe in-progress typing (e.g. "Alice\nBob\nCh" → server has "Alice\nBob" → reset).
      if (data.status === "locked" || data.status === "spun") {
        if (data.teams?.length) setEntriesText(data.teams.join("\n"));
        hasSyncedEntriesFromServerRef.current = true;
      } else if (!hasSyncedEntriesFromServerRef.current) {
        if (data.teams?.length) {
          setEntriesText(data.teams.join("\n"));
          defaultNamesSetRef.current = false;
        } else if (data.status === "waiting") {
          if (!defaultNamesSetRef.current) {
            setEntriesText(DEFAULT_WHEEL_NAMES.join("\n"));
            defaultNamesSetRef.current = true;
          }
        }
        hasSyncedEntriesFromServerRef.current = true;
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
    defaultNamesSetRef.current = false;
    hasSyncedEntriesFromServerRef.current = false;
  }, [roomCode]);

  useEffect(() => {
    fetchRoom();
    const t = setInterval(fetchRoom, 4000);
    return () => clearInterval(t);
  }, [fetchRoom]);

  // Auto-save teams (debounced) so admin panel stays in sync
  const autoSaveTeamsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!roomCode || room?.status === "locked" || room?.status === "spun") return;
    const entries = entriesText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (entries.length === 0) return;
    if (autoSaveTeamsRef.current) clearTimeout(autoSaveTeamsRef.current);
    autoSaveTeamsRef.current = setTimeout(async () => {
      autoSaveTeamsRef.current = null;
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/teams`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teams: entries }),
        });
        const data = await res.json();
        if (res.ok) setRoom((prev) => prev ? { ...prev, teams: data.teams, status: data.status } : null);
      } catch {
        // ignore
      }
    }, 1500);
    return () => {
      if (autoSaveTeamsRef.current) clearTimeout(autoSaveTeamsRef.current);
    };
  }, [entriesText, roomCode, room?.status]);

  // Auto-save groups (debounced) so admin panel stays in sync
  const autoSaveGroupsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!roomCode || room?.status === "locked" || room?.status === "spun") return;
    const list = groupNamesInput.trim()
      ? groupNamesInput.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
      : groupCount > 0
        ? Array.from({ length: groupCount }, (_, i) => `Group ${String.fromCharCode(65 + i)}`)
        : [];
    const sizes = list.length
      ? groupSizes.length >= list.length
        ? groupSizes.slice(0, list.length)
        : [...groupSizes, ...Array(list.length - groupSizes.length).fill(1)]
      : [];
    const totalTeams = room?.teams?.length ?? 0;
    if (list.length > 0 && totalTeams > 0) {
      const sum = sizes.reduce((a, b) => a + b, 0);
      if (sum !== totalTeams) return; // wait until sizes are valid
    }
    if (autoSaveGroupsRef.current) clearTimeout(autoSaveGroupsRef.current);
    autoSaveGroupsRef.current = setTimeout(async () => {
      autoSaveGroupsRef.current = null;
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupNames: list, groupSizes: list.length ? sizes : undefined }),
        });
        const data = await res.json();
        if (res.ok) {
          setRoom((prev) => prev ? { ...prev, groupNames: data.groupNames, groupSizes: data.groupSizes } : null);
          lastSyncedGroupNamesRef.current = JSON.stringify(data.groupNames ?? []);
          lastSyncedGroupSizesRef.current = JSON.stringify(data.groupSizes ?? []);
        }
      } catch {
        // ignore
      }
    }, 1000);
    return () => {
      if (autoSaveGroupsRef.current) clearTimeout(autoSaveGroupsRef.current);
    };
  }, [groupCount, groupNamesInput, groupSizes, roomCode, room?.status, room?.teams?.length]);

  const parsedEntries = entriesText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  function handleShuffle() {
    const lines = entriesText.split(/\n/).filter((s) => s.trim());
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    setEntriesText(lines.join("\n"));
  }

  function handleSort() {
    const lines = entriesText.split(/\n/).map((s) => s.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
    setEntriesText(lines.join("\n"));
  }

  function handleClearList() {
    setEntriesText("");
  }

  async function handleSubmitTeams(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCode) return;
    if (parsedEntries.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: parsedEntries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      setRoom((prev) => prev ? { ...prev, teams: data.teams, status: data.status } : null);
      setEntriesText(data.teams.join("\n"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
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
    if (room.status === "waiting") {
      const items = parsedEntries.length > 0 ? parsedEntries : DEFAULT_WHEEL_NAMES;
      if (items.length > 0) {
        const idx = Math.floor(Math.random() * items.length);
        setRandomTargetIndex(idx);
        setSpinning(true);
      }
      return;
    }
    if (room.status === "teams_submitted" && room.teams?.length) {
      const idx = Math.floor(Math.random() * room.teams.length);
      setRandomTargetIndex(idx);
      setSpinning(true);
    }
  }

  function triggerReveal(name: string) {
    playRevealSound();
    fireRevealConfetti();
    setRevealPopupName(name);
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
      triggerReveal(nextTeam);
      if (revealedSoFar.length + 1 >= room.riggedOrder.length) {
        await markRoomSpun();
      }
      setSpinning(false);
      return;
    }
    if (room.status === "waiting") {
      const items = parsedEntries.length > 0 ? parsedEntries : DEFAULT_WHEEL_NAMES;
      const winner = items[randomTargetIndex] ?? null;
      setRandomWinner(winner);
      if (winner) triggerReveal(winner);
      setSpinning(false);
      return;
    }
    if (room.status === "teams_submitted" && room.teams?.length) {
      const winner = room.teams[randomTargetIndex] ?? null;
      setRandomWinner(winner);
      if (winner) triggerReveal(winner);
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
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-4 text-gray-400 hover:text-white underline"
        >
          Back to home
        </button>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-gray-400">Loading…</p>
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
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          {groups ? "Group stage draw" : "Draw result"}
        </h1>
        {groups ? (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.name} className="bg-[#222] rounded border border-[#333] p-4">
                <h2 className="font-semibold text-white mb-3">{g.name}</h2>
                <ul className="space-y-1">
                  {g.teams.map((team, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-5">{i + 1}.</span>
                      <span className="font-medium text-gray-200">{team}</span>
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
                className="flex items-center gap-3 p-3 bg-[#222] rounded border border-[#333]"
              >
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
                  {i + 1}
                </span>
                <span className="font-medium text-gray-200">{team}</span>
              </li>
            ))}
          </ul>
        )}
        <GoogleAd variant="inline" />
      </main>
    );
  }

  const canSubmit = (room.status === "waiting" || room.status === "teams_submitted") && parsedEntries.length > 0;
  const isLockedDraw = room.status === "locked" && room.riggedOrder && room.riggedOrder.length > 0;
  const remainingTeams = room.riggedOrder?.slice(revealedSoFar.length) ?? [];
  const oneLeft = isLockedDraw && remainingTeams.length === 1;

  // Wheel items: when waiting use parsed entries or defaults; else server data or defaults
  const wheelItems =
    room.status === "waiting"
      ? parsedEntries.length > 0
        ? parsedEntries
        : DEFAULT_WHEEL_NAMES
      : room.teams.length === 0
        ? DEFAULT_WHEEL_NAMES
        : isLockedDraw
          ? remainingTeams
          : room.teams;
  const wheelTargetIndex = isLockedDraw ? 0 : randomTargetIndex;
  const canSpin =
    wheelItems.length > 0 &&
    (isLockedDraw ? revealedSoFar.length < room.riggedOrder!.length : true);
  const showIdleSpin = !spinning && wheelItems.length > 0;

  const resultsList = isLockedDraw ? revealedSoFar : (randomWinner ? [randomWinner] : []);
  const resultsCount = isLockedDraw ? (room.riggedOrder?.length ?? 0) : (randomWinner ? 1 : 0);

  // Right panel: dark Entries/Results like wheelofnames.com
  const entriesPanel = (
    <div className="flex flex-col h-full bg-[#222] border border-[#333] rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[#333]">
        <button
          type="button"
          onClick={() => setEntriesTab("entries")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            entriesTab === "entries"
              ? "text-blue-400 border-blue-400 bg-[#1a1a1a]"
              : "text-gray-400 border-transparent hover:text-gray-300"
          }`}
        >
          <span>Entries</span>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
          <span>{parsedEntries.length || room.teams.length || 0}</span>
        </button>
        <button
          type="button"
          onClick={() => setEntriesTab("results")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            entriesTab === "results"
              ? "text-blue-400 border-blue-400 bg-[#1a1a1a]"
              : "text-gray-400 border-transparent hover:text-gray-300"
          }`}
        >
          Results
          <span>{resultsCount}</span>
        </button>
      </div>

      <div className="p-3 flex flex-col flex-1 min-h-0">
        {/* Shuffle, Sort, Add image + Advanced */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={room.status === "locked" || room.status === "spun"}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2.5 py-1.5 rounded bg-[#333] hover:bg-[#404040] disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Shuffle
          </button>
          <button
            type="button"
            onClick={handleSort}
            disabled={room.status === "locked" || room.status === "spun"}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2.5 py-1.5 rounded bg-[#333] hover:bg-[#404040] disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
            Sort
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2.5 py-1.5 rounded bg-[#333] hover:bg-[#404040]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Add image
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
          <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer ml-auto">
            <input type="checkbox" checked={advancedOpen} onChange={(e) => setAdvancedOpen(e.target.checked)} className="rounded border-[#555] bg-[#333] text-blue-500" />
            Advanced
          </label>
        </div>

        {entriesTab === "entries" ? (
          <>
            <form onSubmit={handleSubmitTeams} className="flex flex-col flex-1 min-h-0">
              <textarea
                value={entriesText}
                onChange={(e) => setEntriesText(e.target.value)}
                placeholder="Add names, one per line"
                rows={12}
                disabled={room.status === "locked" || room.status === "spun"}
                className="w-full px-3 py-2 border border-[#444] rounded bg-[#1a1a1a] text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y disabled:opacity-60 font-sans text-sm"
              />
              {(room.status === "waiting" || room.status === "teams_submitted") && (
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="mt-2 py-1.5 text-sm text-gray-400 hover:text-white underline"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              )}
            </form>
            {advancedOpen && (room.status === "waiting" || room.status === "teams_submitted" || room.status === "locked" || room.status === "spun") && (
              <div className="mt-4 pt-3 border-t border-[#333] space-y-2">
                <p className="text-gray-500 text-xs">Set number of groups or names (e.g. Group A, Group B).</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <label className="text-sm text-gray-400">Number of groups:</label>
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
                    className="px-2 py-1.5 border border-[#444] rounded text-sm bg-[#1a1a1a] text-gray-200"
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
                  placeholder="Group A, Group B"
                  disabled={room.status === "locked" || room.status === "spun"}
                  className="w-full px-3 py-2 border border-[#444] rounded text-sm bg-[#1a1a1a] text-gray-200 placeholder-gray-500"
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
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        {names.map((name, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">{name}:</label>
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
                              className="w-12 px-1.5 py-1 border border-[#444] rounded text-xs bg-[#1a1a1a] text-gray-200"
                            />
                          </div>
                        ))}
                      </div>
                      {totalTeams > 0 && (
                        <p className={`text-xs ${sumValid ? "text-gray-500" : "text-amber-400"}`}>
                          Sum: {sum} {sumValid ? `(matches ${totalTeams})` : `— must equal ${totalTeams}`}
                        </p>
                      )}
                    </div>
                  ) : null;
                })()}
                <button
                  type="button"
                  onClick={handleSaveGroups}
                  disabled={groupsSaving || room.status === "locked" || room.status === "spun"}
                  className="text-sm py-1.5 px-3 bg-[#333] text-gray-300 rounded hover:bg-[#404040] disabled:opacity-50"
                >
                  {groupsSaving ? "Saving…" : "Save groups"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 min-h-[200px] text-gray-400 text-sm">
            {resultsList.length === 0 ? (
              <p>No results yet. Spin the wheel to pick a winner.</p>
            ) : (
              <ul className="space-y-1">
                {resultsList.map((name, i) => (
                  <li key={i} className="text-gray-200">{i + 1}. {name}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}

        {/* Bottom: Beta, Add wheel, Version, Changelog */}
        <div className="mt-4 pt-3 border-t border-[#333] space-y-2">
          <span className="inline-block text-[10px] font-medium bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded">Beta</span>
          <Link href="/" className="flex items-center justify-center gap-1.5 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded">
            + Add wheel
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </Link>
          <p className="text-[10px] text-gray-500">Version 405</p>
          <a href="https://wheelofnames.com/faq" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">Changelog</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 box-border">
      {/* Reveal popup */}
      {revealPopupName && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60" onClick={() => setRevealPopupName(null)} role="dialog" aria-modal="true" aria-labelledby="reveal-title">
          <div className="bg-[#222] border border-[#444] rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center" onClick={(e) => e.stopPropagation()}>
            <p id="reveal-title" className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Winner</p>
            <p className="text-3xl font-bold text-white mb-6">{revealPopupName}</p>
            <button
              type="button"
              onClick={() => setRevealPopupName(null)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-8 lg:gap-10 w-full min-w-0">
        {/* Left: wheel — dark, no big heading */}
        <div className="flex flex-col items-center justify-start w-full min-w-0">
          {isLockedDraw && revealedSoFar.length > 0 && (
            <div className="w-full max-w-sm mb-4 p-3 bg-[#222] rounded border border-[#333]">
              <p className="text-xs font-medium text-gray-500 mb-2">Draw so far</p>
              {room.groupNames?.length ? (
                <div className="space-y-2">
                  {room.groupNames.map((g) => {
                    const teamsInGroup = revealedSoFar.filter(
                      (_, j) => j % room.groupNames!.length === room.groupNames!.indexOf(g)
                    );
                    if (teamsInGroup.length === 0) return null;
                    return (
                      <div key={g}>
                        <p className="text-xs font-semibold text-gray-500 uppercase">{g}</p>
                        <p className="text-gray-200 text-sm">{teamsInGroup.join(" → ")}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ol className="space-y-0.5 text-sm text-gray-200">
                  {revealedSoFar.map((team, i) => (
                    <li key={i}><span className="text-gray-500 mr-2">{ordinal(i + 1)}</span>{team}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {isLockedDraw && oneLeft ? (
            <div className="w-full max-w-sm p-6 bg-[#222] rounded border border-[#333] text-center">
              <p className="text-gray-400 text-sm mb-2">Only one left — no need to spin!</p>
              <p className="text-lg font-bold text-white mb-4">{remainingTeams[0]}</p>
              <button
                type="button"
                onClick={markRoomSpun}
                className="px-5 py-2.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 text-sm"
              >
                Show full draw
              </button>
            </div>
          ) : (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={canSpin && !spinning ? handleSpin : undefined}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && canSpin && !spinning) handleSpin(); }}
                className={`flex flex-col items-center ${canSpin && !spinning ? "cursor-pointer" : ""}`}
              >
                <Wheel
                  items={wheelItems}
                  targetIndex={wheelTargetIndex}
                  isSpinning={spinning}
                  onSpinComplete={handleSpinComplete}
                  idleSpin={showIdleSpin}
                />
              </div>
              {!spinning && canSpin && (
                <>
                  <p className="text-gray-500 text-sm mt-2">Click the wheel to spin</p>
                  <p className="text-gray-500 text-xs mt-0.5">or press Ctrl+Enter</p>
                </>
              )}
              {!spinning && (randomWinner || (isLockedDraw && revealedSoFar.length > 0)) && (
                <p className="text-gray-300 font-medium mt-2">
                  Landed on <span className="text-white">{isLockedDraw ? revealedSoFar[revealedSoFar.length - 1] : randomWinner}</span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Right: entries panel */}
        <div className="w-full min-w-0">
          {entriesPanel}
        </div>
      </div>

      {/* Report bad ad / Close ads — moved down next to the ad */}
      <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <button type="button" className="flex items-center gap-1 hover:text-gray-400">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.993 1.123A3 3 0 0116 6v10a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm3-1a1 1 0 00-1 1v10a1 1 0 001 1h7a1 1 0 001-1V6a1 1 0 00-1-1H6z" clipRule="evenodd" /></svg>
            Report bad ad
          </button>
          <button type="button" className="flex items-center gap-1 hover:text-gray-400">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            Close ads
          </button>
        </div>
      </div>
      <div className="mt-2">
        <GoogleAd variant="inline" />
      </div>
    </div>
  );
}
