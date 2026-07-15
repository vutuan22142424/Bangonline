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
  kind:
    | "BangResponse"
    | "DuelResponse"
    | "IndiansResponse"
    | "GeneralStoreDraw"
    | "JailCheck"
    | "DynamiteCheck"
    | "GatlingResponse"
    | "JesseDrawChoice"
    | "PedroDrawChoice"
    | "KitCarlsonDraw";
  fromPlayerId: string;
  targetPlayerId: string;
  cardInstanceId?: string;
  data?: Record<string, unknown>;
}

/**
 * Emitted whenever any player plays/discards a card, so every client (not
 * just the one who played it) can animate the card flying from that
 * player's seat down to the center pile. `seq` is a monotonically
 * increasing counter (see GameState.eventSeq) so the client can detect a
 * *new* event even if the same card kind gets played twice in a row.
 * `toDiscard` is false for blue/equip cards (Barrel, Scope, Mustang, Jail,
 * Dynamite, weapons) which stay in play instead of landing on the discard
 * pile, so the client knows not to fly those to the center.
 */
export interface PlayedCardEvent {
  seq: number;
  playerId: string;
  card: PlayingCard;
  kind: CardKind;
  targetId?: string;
  toDiscard: boolean;
}

/**
 * Emitted whenever the engine flips a card to judge something (Dynamite
 * check, Jail check, ...) so the client can reveal that draw instead of it
 * happening invisibly on the server.
 */
export interface JudgeDrawEvent {
  seq: number;
  playerId: string;
  card: PlayingCard;
  reason: "Dynamite" | "Jail" | "Barrel" | "BlackJack";
  success: boolean;
  resultLabel: string;
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
  beerPlayedThisTurn: Record<string, number>; // playerId -> count (limited to 1/turn)
  log: string[];
  winner: RoleName | "Outlaws+Renegade" | null;
  version: number;
  eventSeq: number;
  lastPlayedCard: PlayedCardEvent | null;
  lastJudgeDraw: JudgeDrawEvent | null;
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
