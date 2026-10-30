"use client";
import { useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Swipe left for `next`, right for `prev`, like turning pages. Only clear sideways swipes
 * count, so scrolling up and down the day is never mistaken for one.
 */
export function Swipe({ prev, next, className, children, label }: {
  prev: string; next: string; className?: string; children: ReactNode; label?: string;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      className={className}
      aria-label={label}
      // Sideways swipes here are ours (not the browser's back/forward); scrolling up and down still works.
      style={{ touchAction: "pan-y", overscrollBehaviorX: "contain" }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        start.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        router.push(dx < 0 ? next : prev);
      }}
    >
      {children}
    </div>
  );
}
