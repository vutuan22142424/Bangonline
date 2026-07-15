"use client";

import { useEffect, useState } from "react";
import { CardKind, PlayingCard } from "@/lib/types";
import { CardFace } from "./CardView";

interface FlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function FlyingCard({
  card,
  kind,
  label,
  from,
  to,
  onDone,
}: {
  card: PlayingCard;
  kind?: CardKind;
  label: string;
  from: FlightRect;
  to: FlightRect;
  onDone: () => void;
}) {
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setArrived(true));
    const timer = setTimeout(onDone, 480);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for this specific flight
  }, []);

  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  // Small deterministic-ish tilt so it doesn't look perfectly mechanical.
  const tilt = ((Math.round(fromCx) % 7) - 3) * 8;

  return (
    <div
      className="fixed z-40 pointer-events-none"
      style={{
        left: fromCx,
        top: fromCy,
        width: 0,
        height: 0,
        transition: "transform 420ms cubic-bezier(0.3, 0.6, 0.35, 1)",
        transform: arrived
          ? `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.75) rotate(${tilt}deg)`
          : "translate(-50%, -50%) scale(1) rotate(0deg)",
      }}
    >
      <div className="w-16">
        <CardFace card={card} label={label} kind={kind} small />
      </div>
    </div>
  );
}
