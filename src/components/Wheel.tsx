"use client";

import { useRef, useEffect, useState } from "react";

const SEGMENT_COLORS = [
  "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16",
];

type Easing = (t: number) => number;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface WheelProps {
  items: string[];
  onSpinComplete?: () => void;
  targetIndex: number; // which segment (0 = first in items) should land at top
  isSpinning: boolean;
  onStartSpin?: () => void;
  idleSpin?: boolean; // slow continuous rotation when not spinning
}

export function Wheel({
  items,
  onSpinComplete,
  targetIndex,
  isSpinning,
  onStartSpin,
  idleSpin = false,
}: WheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const [result, setResult] = useState<string | null>(null);
  const spinStartedRef = useRef(false);
  const onSpinCompleteRef = useRef(onSpinComplete);
  const onStartSpinRef = useRef(onStartSpin);
  onSpinCompleteRef.current = onSpinComplete;
  onStartSpinRef.current = onStartSpin;

  // When the wheel gets new items (e.g. remaining teams after a reveal), reset rotation
  // so the next spin starts from 0 and lands correctly.
  useEffect(() => {
    if (isSpinning) return;
    rotationRef.current = 0;
    setResult(null);
  }, [items.length, isSpinning]);

  useEffect(() => {
    if (!isSpinning) {
      spinStartedRef.current = false;
      return;
    }
    if (items.length === 0) return;
    if (spinStartedRef.current) return;
    spinStartedRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) {
      spinStartedRef.current = false;
      return;
    }

    onStartSpinRef.current?.();

    const n = items.length;
    const segmentAngle = (2 * Math.PI) / n;
    // Pointer is at top. Segment i center at -PI/2 + (i+0.5)*segmentAngle. We want targetIndex at top:
    // totalRotation ≡ -(targetIndex+0.5)*segmentAngle (mod 2π). So extra rotation from current:
    const startRotation = rotationRef.current;
    const currentMod = startRotation % (2 * Math.PI);
    const targetTotalMod = (2 * Math.PI) - (targetIndex * segmentAngle + segmentAngle / 2);
    let extraRad = (targetTotalMod - currentMod) % (2 * Math.PI);
    if (extraRad < 0) extraRad += 2 * Math.PI;
    const fullTurns = 5 * 2 * Math.PI;
    const targetRotationRad = fullTurns + extraRad;

    const duration = 5000; // ms
    const startTime = performance.now();

    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(t);
      const currentRotation = startRotation + eased * targetRotationRad;
      rotationRef.current = currentRotation;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const size = 320;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.scale(dpr, dpr);

      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 8;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(currentRotation);
      ctx.translate(-cx, -cy);

      for (let i = 0; i < n; i++) {
        const start = i * segmentAngle - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + segmentAngle);
        ctx.closePath();
        ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const midAngle = start + segmentAngle / 2;
        const textR = r * 0.65;
        const tx = cx + textR * Math.cos(midAngle);
        const ty = cy + textR * Math.sin(midAngle);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "12px system-ui, sans-serif";
        const label = items[i].length > 12 ? items[i].slice(0, 11) + "…" : items[i];
        ctx.fillText(label, 0, 4);
        ctx.restore();
      }

      ctx.restore();

      // Pointer at top — triangle tip pointing down at the wheel
      ctx.beginPath();
      ctx.moveTo(cx, 28);
      ctx.lineTo(cx - 14, 4);
      ctx.lineTo(cx + 14, 4);
      ctx.closePath();
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setResult(items[targetIndex]);
        onSpinCompleteRef.current?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Intentionally only depend on isSpinning and items/targetIndex so we run once per spin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, items.length, targetIndex]);

  // Initial draw when not spinning (skip if idle animation is running)
  useEffect(() => {
    if (items.length === 0 || isSpinning || idleSpin) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const n = items.length;
    const segmentAngle = (2 * Math.PI) / n;
    const rotation = rotationRef.current;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.translate(-cx, -cy);

    for (let i = 0; i < n; i++) {
      const start = i * segmentAngle - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + segmentAngle);
      ctx.closePath();
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const midAngle = start + segmentAngle / 2;
      const textR = r * 0.65;
      const tx = cx + textR * Math.cos(midAngle);
      const ty = cy + textR * Math.sin(midAngle);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midAngle + Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui, sans-serif";
      const label = items[i].length > 12 ? items[i].slice(0, 11) + "…" : items[i];
      ctx.fillText(label, 0, 4);
      ctx.restore();
    }

    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(cx, 28);
    ctx.lineTo(cx - 14, 4);
    ctx.lineTo(cx + 14, 4);
    ctx.closePath();
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [items, isSpinning, idleSpin]);

  // Idle spin: slow continuous rotation when not spinning
  useEffect(() => {
    if (!idleSpin || isSpinning || items.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf: number;
    const tick = () => {
      rotationRef.current += 0.004;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const n = items.length;
      const segmentAngle = (2 * Math.PI) / n;
      const dpr = window.devicePixelRatio || 1;
      const size = 320;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.scale(dpr, dpr);
      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 8;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotationRef.current);
      ctx.translate(-cx, -cy);
      for (let i = 0; i < n; i++) {
        const start = i * segmentAngle - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + segmentAngle);
        ctx.closePath();
        ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
        const midAngle = start + segmentAngle / 2;
        const textR = r * 0.65;
        const tx = cx + textR * Math.cos(midAngle);
        const ty = cy + textR * Math.sin(midAngle);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "12px system-ui, sans-serif";
        const label = items[i].length > 12 ? items[i].slice(0, 11) + "…" : items[i];
        ctx.fillText(label, 0, 4);
        ctx.restore();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(cx, 28);
      ctx.lineTo(cx - 14, 4);
      ctx.lineTo(cx + 14, 4);
      ctx.closePath();
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1;
      ctx.stroke();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idleSpin, isSpinning, items]);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas ref={canvasRef} className="max-w-full" width={320} height={320} />
      {result && (
        <p className="text-lg font-semibold text-slate-700">
          Landed on: <span className="text-emerald-600">{result}</span>
        </p>
      )}
    </div>
  );
}
