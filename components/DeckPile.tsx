import { PlayingCard } from "@/lib/types";
import { CARD_DEFS, kindOfCardId } from "@/lib/data/cards";
import { CardBack, CardFace } from "./CardView";

export function DeckPile({
  deckCount,
  discardPile,
}: {
  deckCount: number;
  discardPile: PlayingCard[];
}) {
  const top = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const topKind = top ? kindOfCardId(top.id) : undefined;
  const topLabel = topKind ? CARD_DEFS[topKind].label : "?";

  return (
    <div className="flex items-center gap-4 bg-ink/40 border border-dust/20 rounded p-3">
      <div className="flex flex-col items-center gap-1">
        <CardBack small count={deckCount} pulseKey={deckCount} />
        <span className="text-[10px] text-dust">Bộ bài</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        {top ? (
          <CardFace
            key={top.id}
            card={top}
            label={topLabel}
            kind={topKind}
            small
            count={discardPile.length}
            animationClassName="animate-card-deal-in"
          />
        ) : (
          <div className="w-10 aspect-[250/389] rounded-md border-2 border-dashed border-dust/30" />
        )}
        <span className="text-[10px] text-dust">Bài đã bỏ</span>
      </div>
    </div>
  );
}
