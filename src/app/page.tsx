"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAd } from "@/components/GoogleAd";

export default function HomePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "redirecting">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rooms", { method: "POST" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus("loading");
          return;
        }
        const code = data.roomCode as string;
        if (code) {
          setStatus("redirecting");
          router.replace(`/${code}`);
        }
      } catch {
        if (!cancelled) setStatus("loading");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-white mb-2">
        Wheel of Names
      </h1>
      <p className="text-gray-400 mb-8">
        {status === "redirecting" ? "Taking you to your wheel…" : "Setting up your wheel…"}
      </p>
      <div className="flex justify-center mb-8">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <GoogleAd variant="inline" />
    </main>
  );
}
