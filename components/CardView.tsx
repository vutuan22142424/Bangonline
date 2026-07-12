import Image from "next/image";
import { CardKind, PlayingCard } from "@/lib/types";

const SUIT_SYMBOL: Record<string, string> = {
  Hearts: "♥",
  Diamonds: "♦",
  Clubs: "♣",
  Spades: "♠",
};

// ---------------------------------------------------------------------------
// Full card-face artwork, one image per card kind. Native size 250x389 —
// keep the display container at the same aspect ratio (250/389) so images
// never get stretched or cropped oddly.
// ---------------------------------------------------------------------------

const CARD_IMAGE_SRC: Record<CardKind, string> = {
  Bang: "/cards/bang.png",
  Missed: "/cards/missed.png",
  Beer: "/cards/beer.png",
  Panic: "/cards/01_panico.png",
  CatBalou: "/cards/catbalou.png",
  Duel: "/cards/duel.png",
  Indians: "/cards/indians.png",
  Gatling: "/cards/gatling.png",
  Saloon: "/cards/saloon.png",
  Stagecoach: "/cards/stagecoach.png",
  WellsFargo: "/cards/wells-fargo.png",
  GeneralStore: "/cards/general-store.png",
  Barrel: "/cards/barile.png",
  Scope: "/cards/scope.png",
  Mustang: "/cards/mustang.png",
  Jail: "/cards/jail.png",
  Dynamite: "/cards/dynamite.png",
  Volcanic: "/cards/volcanic.png",
  Schofield: "/cards/schofield.png",
  Remington: "/cards/remington.png",
  RevCarabine: "/cards/rev-carabine.png",
  Winchester: "/cards/winchester.png",
};

export function CardBack({
  small,
  count,
  pulseKey,
}: {
  small?: boolean;
  /** If provided, shows a little badge with the remaining card count. */
  count?: number;
  /** Change this value (e.g. to the count) to re-trigger the pulse animation. */
  pulseKey?: number | string;
}) {
  return (
    <div
      key={pulseKey}
      className={`${small ? "w-10" : "w-16"} aspect-[250/389] rounded-md bg-gradient-to-br from-rust to-ink border-2 border-dust/50 flex items-center justify-center shadow relative overflow-hidden ${
        pulseKey !== undefined ? "animate-deck-pulse" : ""
      }`}
    >
      <div className="absolute inset-1 rounded border border-dust/30" />
      <span className="font-western text-parchment/80 text-xs rotate-12 select-none">BANG!</span>
      {count !== undefined && (
        <span className="absolute bottom-0.5 right-0.5 leading-none text-[10px] font-bold bg-parchment text-ink rounded px-1 py-0.5 shadow">
          {count}
        </span>
      )}
    </div>
  );
}

export function CardFace({
  card,
  label,
  kind,
  onClick,
  selected,
  small,
  animationClassName,
  count,
}: {
  card: PlayingCard;
  label: string;
  kind?: CardKind;
  onClick?: () => void;
  selected?: boolean;
  small?: boolean;
  /** Extra class(es) for entrance/exit animations, e.g. "animate-card-deal-in". */
  animationClassName?: string;
  /** Optional badge, e.g. discard pile size when this card is the top of the pile. */
  count?: number;
}) {
  const isRed = card.suit === "Hearts" || card.suit === "Diamonds";
  const imageSrc = kind ? CARD_IMAGE_SRC[kind] : undefined;

  return (
    <button
      onClick={onClick}
      aria-label={`${label} - ${card.rank}${SUIT_SYMBOL[card.suit]}`}
      className={`${small ? "w-16" : "w-24"} aspect-[250/389] relative rounded-md overflow-hidden border-2 shadow transition-transform hover:-translate-y-1 bg-parchment ${
        selected ? "border-rust ring-2 ring-rust -translate-y-2" : "border-ink/30"
      } ${animationClassName ?? ""}`}
    >
      {imageSrc && (
        <Image
          src={imageSrc}
          alt={label}
          fill
          className="object-cover"
          sizes={small ? "64px" : "96px"}
        />
      )}

      {/* Small rank/suit badge so players can still tell suit apart even
          though the artwork is shared across every card of this kind. */}
      <div
        className={`absolute top-1 left-1 leading-none font-bold rounded bg-parchment/85 px-1 py-0.5 ${
          small ? "text-[9px]" : "text-xs"
        } ${isRed ? "text-rust" : "text-ink"}`}
      >
        {card.rank}
        {SUIT_SYMBOL[card.suit]}
      </div>

      {count !== undefined && (
        <span className="absolute bottom-0.5 right-0.5 leading-none text-[10px] font-bold bg-parchment text-ink rounded px-1 py-0.5 shadow">
          {count}
        </span>
      )}
    </button>
  );
}
