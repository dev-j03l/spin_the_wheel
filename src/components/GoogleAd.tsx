"use client";

import { useEffect, useRef } from "react";
import { FakeAd } from "@/components/FakeAd";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

const ADS_CLIENT = process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID ?? "ca-pub-9307012174300562";
const SLOT_BANNER = process.env.NEXT_PUBLIC_GOOGLE_ADS_SLOT_BANNER;
const SLOT_INLINE = process.env.NEXT_PUBLIC_GOOGLE_ADS_SLOT_INLINE;

interface GoogleAdProps {
  variant?: "banner" | "sidebar" | "inline";
}

export function GoogleAd({ variant = "banner" }: GoogleAdProps) {
  const insRef = useRef<HTMLElement | null>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!ADS_CLIENT || !insRef.current) return;
    if (pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // ignore
    }
  }, [variant]);

  if (!ADS_CLIENT) {
    return <FakeAd variant={variant} />;
  }

  const slot = variant === "banner" ? SLOT_BANNER : variant === "inline" ? SLOT_INLINE : SLOT_BANNER;

  return (
    <div className={variant === "banner" ? "w-full max-w-6xl mx-auto my-4 px-4 sm:px-6" : variant === "sidebar" ? "hidden lg:block w-48 flex-shrink-0" : "my-4"}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", minHeight: variant === "banner" ? 90 : variant === "inline" ? 250 : 200 }}
        data-ad-client={ADS_CLIENT}
        data-ad-slot={slot || undefined}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
