import type { ReactElement } from "react";
import { CardKind, PlayingCard } from "@/lib/types";

const SUIT_SYMBOL: Record<string, string> = {
  Hearts: "♥",
  Diamonds: "♦",
  Clubs: "♣",
  Spades: "♠",
};

// ---------------------------------------------------------------------------
// Original line-art icons, one per card kind. Drawn from scratch for this
// project (not sourced from the physical BANG! game's artwork) so each card
// gets a distinctive little illustration instead of just a text label.
// Every icon is a 24x24 viewBox using currentColor, so it inherits whatever
// color the card face sets.
// ---------------------------------------------------------------------------

function IconBang() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13.5h7l1.5-2 1.5 4 1-2h6.5" />
      <rect x="10.5" y="11" width="7" height="3" rx="0.6" />
      <path d="M17 12h3.2c.8 0 1.3.9.8 1.6l-1 1.4" />
      <path d="M2.5 12.6l2 .9-2 .9" />
    </svg>
  );
}

function IconMissed() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18c2-1 3-3 3-5" />
      <path d="M8 19c2.5-1 4-3.5 4-6.5" />
      <path d="M13 18.5c2-1.5 3-4 2.7-6.5" />
      <path d="M17.5 17c1.3-1.8 1.7-3.8 1.2-5.8" />
      <circle cx="12" cy="7" r="2.3" />
    </svg>
  );
}

function IconBeer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9h9v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z" />
      <path d="M15 11h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" />
      <path d="M6 9c0-2.5 1.8-4.5 4.2-4.9" />
      <path d="M8 6.3c.5-.3 1.1-.5 1.7-.6" />
    </svg>
  );
}

function IconPanic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h9" />
      <path d="M9 8l4 4-4 4" />
      <rect x="15" y="6" width="6" height="8" rx="0.8" />
      <path d="M16.5 18.5h3" />
    </svg>
  );
}

function IconCatBalou() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 5l4 14" />
      <path d="M14 5l4 14" />
      <path d="M4.5 9.5h17" />
    </svg>
  );
}

function IconDuel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20l7-7" />
      <path d="M21 4l-7 7" />
      <path d="M8 13l3 3" />
      <path d="M13 8l3 3" />
      <path d="M3 20l1.5-4" />
      <path d="M21 4l-4 1.5" />
    </svg>
  );
}

function IconIndians() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 20l6-16 6 16" />
      <path d="M8.5 13.5h7" />
    </svg>
  );
}

function IconGatling() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="12" r="3.4" />
      <path d="M8 8.6v6.8M5.3 12h5.4M6.1 9.5l3.8 5M6.1 14.5l3.8-5" />
      <path d="M11 12h9" />
      <path d="M17 12l3 -1.8v3.6z" />
    </svg>
  );
}

function IconSaloon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l1.4 16h13.2L20 4" />
      <path d="M4 4h16" />
      <path d="M9.5 20v-6a2.5 2.5 0 0 1 5 0v6" />
    </svg>
  );
}

function IconStagecoach() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 15c0-4 3-7 7-7h4c3 0 5 2 6 4" />
      <path d="M3 15h17" />
      <circle cx="7.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
      <path d="M14 8V5.5" />
    </svg>
  );
}

function IconWellsFargo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="9" width="16" height="9" rx="1" />
      <path d="M4 9l8-5 8 5" />
      <path d="M10 18v-4a2 2 0 0 1 4 0v4" />
    </svg>
  );
}

function IconGeneralStore() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9l1-4h14l1 4" />
      <path d="M4 9h16v9H4z" />
      <path d="M9.5 18v-4.5h5V18" />
    </svg>
  );
}

function IconBarrel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 5h10l1 14H6z" />
      <path d="M6.5 9h11M6.7 15h10.6" />
      <path d="M9.5 5c-1 3-1 11 0 14M14.5 5c1 3 1 11 0 14" />
    </svg>
  );
}

function IconScope() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l6 6" />
      <path d="M10.5 7v2M10.5 12v2M7.5 10.5h2M12 10.5h2" />
    </svg>
  );
}

function IconMustang() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17c0-5 3-9 7-10 2.5-.6 4 .3 4 2 0 1-1 1.5-2 2l4 1.5" />
      <path d="M17 12.5c1.5.4 3 1.8 3 4v1.5" />
      <path d="M6.5 17v3M9 17v3" />
      <circle cx="15.5" cy="7" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconJail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="16" rx="0.8" />
      <path d="M9 4v16M14 4v16" />
      <path d="M5 10h14M5 15h14" />
    </svg>
  );
}

function IconDynamite() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="9" width="4.5" height="11" rx="1" />
      <rect x="12" y="9" width="4.5" height="11" rx="1" />
      <path d="M12 20h1.5" />
      <path d="M9 9V6" />
      <path d="M9 6c1.5-1 1-3-1-3" />
      <circle cx="7.5" cy="2.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconWeapon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13.5h8l1.6-2.2 1.4 3.6" />
      <rect x="11" y="11" width="7" height="3" rx="0.6" />
      <path d="M18 12.2h2.6c.7 0 1.1.8.7 1.4l-.9 1.3" />
    </svg>
  );
}

const CARD_ICONS: Record<CardKind, () => ReactElement> = {
  Bang: IconBang,
  Missed: IconMissed,
  Beer: IconBeer,
  Panic: IconPanic,
  CatBalou: IconCatBalou,
  Duel: IconDuel,
  Indians: IconIndians,
  Gatling: IconGatling,
  Saloon: IconSaloon,
  Stagecoach: IconStagecoach,
  WellsFargo: IconWellsFargo,
  GeneralStore: IconGeneralStore,
  Barrel: IconBarrel,
  Scope: IconScope,
  Mustang: IconMustang,
  Jail: IconJail,
  Dynamite: IconDynamite,
  Volcanic: IconWeapon,
  Schofield: IconWeapon,
  Remington: IconWeapon,
  RevCarabine: IconWeapon,
  Winchester: IconWeapon,
};

export function CardBack({ small }: { small?: boolean }) {
  return (
    <div
      className={`${small ? "w-10 h-14" : "w-16 h-24"} rounded-md bg-gradient-to-br from-rust to-ink border-2 border-dust/50 flex items-center justify-center shadow relative overflow-hidden`}
    >
      <div className="absolute inset-1 rounded border border-dust/30" />
      <span className="font-western text-parchment/80 text-xs rotate-12 select-none">BANG!</span>
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
}: {
  card: PlayingCard;
  label: string;
  kind?: CardKind;
  onClick?: () => void;
  selected?: boolean;
  small?: boolean;
}) {
  const isRed = card.suit === "Hearts" || card.suit === "Diamonds";
  const Icon = kind ? CARD_ICONS[kind] : undefined;
  return (
    <button
      onClick={onClick}
      className={`${small ? "w-16 h-24 text-[10px]" : "w-24 h-36 text-xs"} rounded-md bg-parchment text-ink border-2 flex flex-col justify-between p-1.5 shadow transition-transform hover:-translate-y-1 ${
        selected ? "border-rust ring-2 ring-rust -translate-y-2" : "border-ink/30"
      }`}
    >
      <div className={`text-left font-bold ${isRed ? "text-rust" : "text-ink"}`}>
        {card.rank}
        {SUIT_SYMBOL[card.suit]}
      </div>
      {Icon && (
        <div className={`${small ? "w-6 h-6" : "w-9 h-9"} mx-auto ${isRed ? "text-rust" : "text-ink/80"}`}>
          <Icon />
        </div>
      )}
      <div className="text-center leading-tight font-semibold px-0.5">{label}</div>
      <div className={`text-right font-bold rotate-180 ${isRed ? "text-rust" : "text-ink"}`}>
        {card.rank}
        {SUIT_SYMBOL[card.suit]}
      </div>
    </button>
  );
}
