"use client";

import { useState } from "react";
import Link from "next/link";
import { FakeAd } from "@/components/FakeAd";

export default function HomePage() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create room");
      setRoomCode(data.roomCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (roomCode) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const publicUrl = `${base}/room/${roomCode}`;
    return (
      <main className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Room created
        </h1>
        <p className="text-slate-600 mb-4">
          Share this link with participants:
        </p>
        <div className="bg-slate-100 rounded-lg p-4 mb-4 font-mono text-sm break-all">
          {publicUrl}
        </div>
        <p className="text-slate-500 text-sm mb-6">
          Room code: <strong>{roomCode}</strong>
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/room/${roomCode}`}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
          >
            Open public page
          </Link>
          <Link
            href="/admin"
            className="px-5 py-2.5 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800"
          >
            Admin panel
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setRoomCode(null)}
          className="mt-6 text-slate-500 text-sm hover:text-slate-700"
        >
          Create another room
        </button>
        <FakeAd variant="inline" />
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">
        Spin the Wheel
      </h1>
      <p className="text-slate-600 mb-8">
        Tournament draw — create a room and share the link with participants.
      </p>
      <button
        type="button"
        onClick={createRoom}
        disabled={loading}
        className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create a room"}
      </button>
      {error && (
        <p className="mt-4 text-red-600 text-sm">{error}</p>
      )}
      <FakeAd variant="inline" />
    </main>
  );
}
