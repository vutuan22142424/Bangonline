import type { Ref } from "react";
import { PlayingCard } from "@/lib/types";
import { CARD_DEFS, kindOfCardId } from "@/lib/data/cards";
import { CardBack, CardFace } from "./CardView";

// How many of the most recently discarded cards to actually render in the
// messy pile. Older ones just sit "underneath" conceptually — no need to
// keep them in the DOM.
const VISIBLE_PILE_SIZE = 7;

/**
 * Deterministic pseudo-random offset for a card, seeded by its id, so the
 * same card always lands in the same spot in the pile (no jitter on
 * re-render) but different cards look scattered like a real discard pile.
 */
function messyTransform(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const rot = (h % 42) - 21; // -21..21 deg
  const tx = ((h >> 5) % 22) - 11; // -11..11 px
  const ty = ((h >> 10) % 16) - 8; // -8..8 px
  return { rot, tx, ty };
}

export function DeckPile({
  deckCount,
  discardPile,
  discardRef,
  onDiscardClick,
}: {
  deckCount: number;
  discardPile: PlayingCard[];
  /** Forwarded to the discard-pile wrapper so the room page can measure its
   * on-screen position and animate other players' played cards flying here. */
  discardRef?: Ref<HTMLDivElement>;
  /** Opens the full discard history when the pile is clicked. */
  onDiscardClick?: () => void;
}) {
  const visible = discardPile.slice(-VISIBLE_PILE_SIZE);

  return (
    <div className="flex items-center gap-5 bg-ink/40 border border-dust/20 rounded p-3">
      <div className="flex flex-col items-center gap-1">
        <CardBack small count={deckCount} pulseKey={deckCount} />
        <span className="text-[10px] text-dust">Bộ bài</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <div
          ref={discardRef}
          onClick={onDiscardClick}
          title="Bấm để xem lịch sử bài đã bỏ"
          className={`relative w-16 h-24 rounded ${
            onDiscardClick ? "cursor-pointer hover:ring-2 hover:ring-rust/60 hover:bg-rust/5 transition" : ""
          }`}
        >
          {visible.length === 0 && (
            <div className="absolute inset-0 m-auto w-10 aspect-[250/389] rounded-md border-2 border-dashed border-dust/30" />
          )}
          {visible.map((c, i) => {
            const kind = kindOfCardId(c.id);
            const label = kind ? CARD_DEFS[kind].label : "?";
            const { rot, tx, ty } = messyTransform(c.id);
            return (
              <div
                key={c.id}
                className="absolute top-1/2 left-1/2 animate-card-land"
                style={{
                  zIndex: i,
                  ["--land-rot" as string]: `${rot}deg`,
                  ["--land-tx" as string]: `${tx}px`,
                  ["--land-ty" as string]: `${ty}px`,
                  transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
                }}
              >
                <CardFace card={c} label={label} kind={kind} small />
              </div>
            );
          })}
        </div>
        <span className="text-[10px] text-dust">
          Bài đã bỏ {discardPile.length > 0 ? `(${discardPile.length})` : ""}
        </span>
      </div>
    </div>
  );
}
