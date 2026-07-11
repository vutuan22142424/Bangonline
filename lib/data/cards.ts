import { CardDef, CardKind, PlayingCard, Rank, Suit } from "../types";

export const CARD_DEFS: Record<CardKind, CardDef> = {
  Bang: { kind: "Bang", category: "brown", label: "Bang!", description: "Bắn 1 người trong tầm bắn. Mục tiêu mất 1 máu trừ khi có Missed!." },
  Missed: { kind: "Missed", category: "brown", label: "Missed!", description: "Né 1 phát Bang!." },
  Beer: { kind: "Beer", category: "brown", label: "Beer", description: "Hồi 1 máu (không tác dụng nếu chỉ còn 2 người)." },
  Panic: { kind: "Panic", category: "brown", label: "Panic!", description: "Lấy 1 lá bài (tay hoặc đang chơi) từ người trong khoảng cách 1." },
  CatBalou: { kind: "CatBalou", category: "brown", label: "Cat Balou", description: "Buộc 1 người bỏ 1 lá bài bất kỳ (tay hoặc đang chơi), không giới hạn khoảng cách." },
  Duel: { kind: "Duel", category: "brown", label: "Duel", description: "Đấu tay đôi: lần lượt bỏ Bang!, ai hết bài trước mất 1 máu." },
  Indians: { kind: "Indians", category: "brown", label: "Indians!", description: "Tất cả người khác phải bỏ Bang! hoặc mất 1 máu." },
  Gatling: { kind: "Gatling", category: "brown", label: "Gatling", description: "Bắn tất cả người khác (như Bang! diện rộng)." },
  Saloon: { kind: "Saloon", category: "brown", label: "Saloon", description: "Mọi người còn sống hồi 1 máu." },
  Stagecoach: { kind: "Stagecoach", category: "brown", label: "Stagecoach", description: "Rút thêm 2 lá." },
  WellsFargo: { kind: "WellsFargo", category: "brown", label: "Wells Fargo", description: "Rút thêm 3 lá." },
  GeneralStore: { kind: "GeneralStore", category: "brown", label: "General Store", description: "Lật số lá = số người chơi, mỗi người chọn 1 lá theo lượt." },
  Barrel: { kind: "Barrel", category: "blue", label: "Barrel", description: "Khi bị Bang!, lật 1 lá: ra Cơ (Hearts) thì né được." },
  Scope: { kind: "Scope", category: "blue", label: "Scope", description: "Bạn thấy mọi người gần hơn 1 (tăng tầm bắn của bạn)." },
  Mustang: { kind: "Mustang", category: "blue", label: "Mustang", description: "Người khác thấy bạn xa hơn 1." },
  Jail: { kind: "Jail", category: "blue", label: "Jail", description: "Gắn vào 1 người (trừ Sheriff): đầu lượt họ phải lật bài, ra Rô (Diamonds) thì thoát, không thì mất lượt." },
  Dynamite: { kind: "Dynamite", category: "blue", label: "Dynamite", description: "Đầu lượt lật bài: 2-9 Bích (Spades) thì nổ mất 3 máu và bỏ bài, ngược lại chuyền sang người kế." },
  Volcanic: { kind: "Volcanic", category: "blue", label: "Volcanic (súng)", description: "Tầm bắn 1, được đánh nhiều Bang! trong 1 lượt." },
  Schofield: { kind: "Schofield", category: "blue", label: "Schofield (súng)", description: "Tầm bắn 2." },
  Remington: { kind: "Remington", category: "blue", label: "Remington (súng)", description: "Tầm bắn 3." },
  RevCarabine: { kind: "RevCarabine", category: "blue", label: "Rev. Carabine (súng)", description: "Tầm bắn 4." },
  Winchester: { kind: "Winchester", category: "blue", label: "Winchester (súng)", description: "Tầm bắn 5." },
};

// Weapon range lookup (default range without a weapon equipped = 1)
export const WEAPON_RANGE: Partial<Record<CardKind, number>> = {
  Volcanic: 1,
  Schofield: 2,
  Remington: 3,
  RevCarabine: 4,
  Winchester: 5,
};

interface DeckEntry {
  kind: CardKind;
  suit: Suit;
  rank: Rank;
}

// Standard Bang! deck (base game, ~80 cards). Suits/ranks matter for cards
// like Barrel (Hearts), Dynamite (Spades 2-9), Jail (Diamonds).
// Build deck explicitly for clarity/correctness instead of clever generation.
function e(kind: CardKind, suit: Suit, rank: Rank): DeckEntry {
  return { kind, suit, rank };
}

const RAW_DECK: DeckEntry[] = [
  // Bang! (25)
  e("Bang", "Hearts", "A"), e("Bang", "Hearts", "2"), e("Bang", "Hearts", "3"),
  e("Bang", "Diamonds", "A"), e("Bang", "Diamonds", "2"), e("Bang", "Diamonds", "3"),
  e("Bang", "Diamonds", "4"), e("Bang", "Diamonds", "5"), e("Bang", "Diamonds", "6"),
  e("Bang", "Diamonds", "7"), e("Bang", "Diamonds", "8"), e("Bang", "Diamonds", "9"),
  e("Bang", "Clubs", "2"), e("Bang", "Clubs", "3"), e("Bang", "Clubs", "4"),
  e("Bang", "Clubs", "5"), e("Bang", "Clubs", "6"), e("Bang", "Clubs", "7"),
  e("Bang", "Clubs", "8"), e("Bang", "Clubs", "9"), e("Bang", "Spades", "2"),
  e("Bang", "Spades", "3"), e("Bang", "Spades", "4"), e("Bang", "Spades", "5"),
  e("Bang", "Spades", "6"),
  // Missed! (12)
  e("Missed", "Clubs", "10"), e("Missed", "Clubs", "J"), e("Missed", "Clubs", "Q"),
  e("Missed", "Clubs", "K"), e("Missed", "Clubs", "A"), e("Missed", "Spades", "10"),
  e("Missed", "Spades", "J"), e("Missed", "Spades", "Q"), e("Missed", "Spades", "K"),
  e("Missed", "Spades", "A"), e("Missed", "Spades", "7"), e("Missed", "Spades", "8"),
  // Beer (6)
  e("Beer", "Hearts", "6"), e("Beer", "Hearts", "7"), e("Beer", "Hearts", "8"),
  e("Beer", "Hearts", "9"), e("Beer", "Hearts", "10"), e("Beer", "Hearts", "J"),
  // Panic! (4)
  e("Panic", "Hearts", "J"), e("Panic", "Diamonds", "J"), e("Panic", "Hearts", "8"),
  e("Panic", "Hearts", "Q"),
  // Cat Balou (4)
  e("CatBalou", "Diamonds", "9"), e("CatBalou", "Diamonds", "K"), e("CatBalou", "Hearts", "K"),
  e("CatBalou", "Clubs", "Q"),
  // Duel (3)
  e("Duel", "Diamonds", "Q"), e("Duel", "Spades", "8"), e("Duel", "Spades", "9"),
  // Indians! (2)
  e("Indians", "Diamonds", "K"), e("Indians", "Diamonds", "A"),
  // Gatling (1)
  e("Gatling", "Hearts", "10"),
  // Saloon (1)
  e("Saloon", "Hearts", "5"),
  // Stagecoach (2)
  e("Stagecoach", "Spades", "9"), e("Stagecoach", "Spades", "6"),
  // Wells Fargo (1)
  e("WellsFargo", "Hearts", "3"),
  // General Store (2)
  e("GeneralStore", "Clubs", "K"), e("GeneralStore", "Spades", "Q"),
  // Barrel (2)
  e("Barrel", "Spades", "K"), e("Barrel", "Spades", "A"),
  // Scope (1)
  e("Scope", "Spades", "J"),
  // Mustang (2)
  e("Mustang", "Hearts", "8"), e("Mustang", "Hearts", "9"),
  // Jail (3)
  e("Jail", "Spades", "10"), e("Jail", "Hearts", "4"), e("Jail", "Diamonds", "J"),
  // Dynamite (1)
  e("Dynamite", "Clubs", "8"),
  // Volcanic (2)
  e("Volcanic", "Clubs", "10"), e("Volcanic", "Spades", "10"),
  // Schofield (3)
  e("Schofield", "Clubs", "J"), e("Schofield", "Clubs", "Q"), e("Schofield", "Clubs", "K"),
  // Remington (1)
  e("Remington", "Clubs", "A"),
  // Rev. Carabine (1)
  e("RevCarabine", "Clubs", "9"),
  // Winchester (1)
  e("Winchester", "Hearts", "Q"),
];

export function buildFreshDeck(): PlayingCard[] {
  return RAW_DECK.map((c, i) => ({ id: `c_${i.toString().padStart(3, "0")}`, suit: c.suit, rank: c.rank }));
}

// Card instance ids are deterministic (c_000, c_001, ...) matching RAW_DECK's
// order, so we can always resolve "what kind of card is this id" without any
// runtime/server-only registry. This is what lets the client render a
// player's own hand (labels, playable actions) correctly.
const CARD_ID_TO_KIND: Record<string, CardKind> = Object.fromEntries(
  RAW_DECK.map((c, i) => [`c_${i.toString().padStart(3, "0")}`, c.kind])
);

export function kindOfCardId(cardId: string): CardKind | undefined {
  return CARD_ID_TO_KIND[cardId];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rankValueIsRed(suit: Suit) {
  return suit === "Hearts" || suit === "Diamonds";
}
