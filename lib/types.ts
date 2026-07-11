// ---------- Core enums ----------
export type Suit = "Spades" | "Hearts" | "Diamonds" | "Clubs";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface PlayingCard {
  id: string; // unique instance id, e.g. "c_014"
  suit: Suit;
  rank: Rank;
}

export type CardKind =
  | "Bang"
  | "Missed"
  | "Beer"
  | "Panic"
  | "CatBalou"
  | "Duel"
  | "Indians"
  | "Gatling"
  | "Saloon"
  | "Stagecoach"
  | "WellsFargo"
  | "GeneralStore"
  | "Barrel"
  | "Scope"
  | "Mustang"
  | "Jail"
  | "Dynamite"
  | "Volcanic"
  | "Schofield"
  | "Remington"
  | "RevCarabine"
  | "Winchester";

export type CardCategory = "brown" | "blue"; // brown = played then discarded, blue = stays in play

export interface CardDef {
  kind: CardKind;
  category: CardCategory;
  label: string; // Vietnamese display name
  description: string;
}

export type RoleName = "Sheriff" | "Deputy" | "Outlaw" | "Renegade";

export type CharacterId =
  | "WillyTheKid"
  | "CalamityJanet"
  | "BartCassidy"
  | "BlackJack"
  | "ElGringo"
  | "JesseJones"
  | "JourdonaisPed" // Pedro Ramirez
  | "KitCarlson"
  | "LuckyDuke"
  | "ParisPete" // Paul Regret
  | "RoseDoolan"
  | "SidKetchum"
  | "SlabTheKiller"
  | "SuzyLafayette"
  | "VultureSam"
  | "JohnnyKisch"; // Renegade special char stand-in for Sheriff-of-Nottingham? we'll drop unused

export interface CharacterDef {
  id: CharacterId;
  name: string;
  maxHp: number; // base 4, Sheriff gets +1 at runtime
  ability: string; // human readable description; actual logic lives in gameEngine hooks
}

// ---------- Player & game state ----------
export interface PlayerState {
  id: string; // supabase auth id or session id
  seat: number;
  name: string;
  role: RoleName; // hidden from other clients unless revealed
  roleRevealed: boolean;
  character: CharacterId;
  characterChoices: CharacterId[]; // the 2 candidates dealt before picking; cleared once chosen
  characterChosen: boolean;
  hp: number;
  maxHp: number;
  hand: PlayingCard[]; // hidden from other clients
  inPlay: PlayingCard[]; // visible to all (blue cards: Barrel, Scope, Mustang, Jail, Dynamite, weapons)
  isAlive: boolean;
  isSheriff: boolean;
  distanceMod: number; // Mustang -1 (others see you farther), Scope +1 (you see others closer)
}

export type GamePhase =
  | "lobby"
  | "setup"
  | "characterSelect"
  | "draw"
  | "play"
  | "discard"
  | "targeting" // waiting for a target player to respond (Missed?/Beer/etc.)
  | "gameover";

export interface PendingResponse {
  kind: "BangResponse" | "DuelResponse" | "IndiansResponse" | "GeneralStoreDraw" | "JailCheck" | "DynamiteCheck";
  fromPlayerId: string;
  targetPlayerId: string;
  cardInstanceId?: string;
  data?: Record<string, unknown>;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  turnOrder: string[]; // player ids in seat order
  currentPlayerId: string | null;
  deck: PlayingCard[];
  discardPile: PlayingCard[];
  players: Record<string, PlayerState>;
  pendingResponse: PendingResponse | null;
  bangPlayedThisTurn: Record<string, number>; // playerId -> count (Volcanic allows unlimited)
  log: string[];
  winner: RoleName | "Outlaws+Renegade" | null;
  version: number;
}

// ---------- Redacted view sent to a specific client ----------
export interface PlayerHandView extends Omit<PlayerState, "hand" | "character" | "characterChoices"> {
  handCount: number;
  hand: PlayingCard[] | null; // only populated for the requesting player
  character: CharacterId | "Unknown"; // masked until this player has chosen
  characterChoices: CharacterId[] | null; // only populated for the requesting player
}

export interface RedactedGameState extends Omit<GameState, "players" | "deck"> {
  deckCount: number;
  players: Record<string, PlayerHandView>;
  you: string; // requesting player's id
}
