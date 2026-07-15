"use client";

import { useEffect, useRef, useState } from "react";
import { JudgeDrawEvent } from "@/lib/types";
import { CARD_DEFS, kindOfCardId } from "@/lib/data/cards";
import { CardFace } from "./CardView";

const REASON_LABEL: Record<JudgeDrawEvent["reason"], string> = {
  Dynamite: "Rút bài — Dynamite",
  Jail: "Rút bài — Jail",
  Barrel: "Rút bài — Barrel",
  BlackJack: "Rút bài — Black Jack",
};

export function JudgeDrawReveal({
  event,
  playerName,
}: {
  event: JudgeDrawEvent | null;
  playerName?: string;
}) {
  const [visible, setVisible] = useState(false);
  // Don't animate the very first event we ever see (e.g. right after a page
  // reload mid-game the fetched state may already contain an old draw) —
  // only react to the seq actually increasing while we're mounted.
  const firstRef = useRef(true);
  const prevSeqRef = useRef<number | null>(null);

  useEffect(() => {
    if (!event) return;
    if (firstRef.current) {
      firstRef.current = false;
      prevSeqRef.current = event.seq;
      return;
    }
    if (event.seq === prevSeqRef.current) return;
    prevSeqRef.current = event.seq;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(t);
  }, [event]);

  if (!event || !visible) return null;

  const kind = kindOfCardId(event.card.id);
  const label = kind ? CARD_DEFS[kind].label : "?";
  const badColor = !event.success;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
      <div className="flex flex-col items-center gap-2 bg-ink/95 border-2 border-rust rounded-lg px-5 py-4 shadow-2xl animate-card-deal-in">
        <span className="text-xs text-dust uppercase tracking-wide">
          {REASON_LABEL[event.reason]}
          {playerName ? ` · ${playerName}` : ""}
        </span>
        <CardFace card={event.card} label={label} kind={kind} />
        <span className={`text-sm font-semibold ${badColor ? "text-rust" : "text-parchment"}`}>
          {event.resultLabel}
        </span>
      </div>
    </div>
  );
}
