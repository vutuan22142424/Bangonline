import { WEAPON_RANGE, buildFreshDeck, kindOfCardId, shuffle } from "./data/cards";
import { CHARACTERS, dealCharacterChoices, roleCountFor } from "./data/characters";
import {
  CardKind,
  CharacterId,
  GameState,
  PlayerState,
  PlayingCard,
  RoleName,
} from "./types";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * Sets up roles and deals each player 2 candidate characters to choose from
 * (as in the physical game). No hands are dealt and no turn order exists
 * yet — the game stays in "characterSelect" until every player has picked
 * one via the CHOOSE_CHARACTER action, at which point actions.ts calls
 * finalizeCharacterSelection below.
 */
export function createInitialGameState(
  roomId: string,
  playerIds: string[],
  names: Record<string, string>
): GameState {
  const n = playerIds.length;
  const roles = shuffle(roleCountFor(n));
  const choiceHands = dealCharacterChoices(n);
  const deck = shuffle(buildFreshDeck());

  const players: Record<string, PlayerState> = {};
  playerIds.forEach((id, seat) => {
    const role = roles[seat];
    const isSheriff = role === "Sheriff";
    const choices = choiceHands[seat];
    players[id] = {
      id,
      seat,
      name: names[id] ?? `Player ${seat + 1}`,
      role,
      roleRevealed: isSheriff, // Sheriff is always known
      character: choices[0], // placeholder only; redact.ts masks this until chosen
      characterChoices: choices,
      characterChosen: false,
      hp: 0,
      maxHp: 0,
      hand: [],
      inPlay: [],
      isAlive: true,
      isSheriff,
      distanceMod: 0,
    };
  });

  return {
    roomId,
    phase: "characterSelect",
    turnOrder: [...playerIds],
    currentPlayerId: null,
    deck,
    discardPile: [],
    players,
    pendingResponse: null,
    bangPlayedThisTurn: {},
    beerPlayedThisTurn: {},
    log: [`Ván bắt đầu. Mọi người hãy chọn nhân vật của mình.`],
    winner: null,
    version: 1,
    eventSeq: 0,
    lastPlayedCard: null,
    lastJudgeDraw: null,
  };
}

/**
 * Runs once every player has chosen a character (called from actions.ts).
 * Sets each player's real max HP (character + Sheriff bonus), deals their
 * starting hand, fixes turn order starting with the Sheriff, and kicks off
 * the first draw phase.
 */
export function finalizeCharacterSelection(state: GameState) {
  const playerIds = Object.keys(state.players);
  const n = playerIds.length;

  playerIds.forEach((id) => {
    const p = state.players[id];
    const charDef = CHARACTERS[p.character];
    const maxHp = charDef.maxHp + (p.isSheriff ? 1 : 0);
    p.maxHp = maxHp;
    p.hp = maxHp;
    const hand: PlayingCard[] = [];
    for (let i = 0; i < maxHp; i++) {
      const c = state.deck.pop();
      if (c) hand.push(c);
    }
    p.hand = hand;
  });

  const sheriffId = playerIds.find((id) => state.players[id].isSheriff)!;
  const sheriffSeat = state.players[sheriffId].seat;
  state.turnOrder = [...playerIds].sort(
    (a, b) =>
      ((state.players[a].seat - sheriffSeat + n) % n) - ((state.players[b].seat - sheriffSeat + n) % n)
  );
  state.currentPlayerId = sheriffId;
  state.phase = "draw";
  state.log.push(`Mọi người đã chọn xong nhân vật. ${state.players[sheriffId].name} là Sheriff và đi trước.`);

  startTurnDrawPhase(state);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Distance/range math only ever touches seat, isAlive, inPlay, and character —
// all of which exist on both the full server-side GameState and the redacted
// view sent to clients (RedactedGameState). Typing these against this minimal
// shape (rather than the full GameState) lets room/[roomId]/page.tsx call
// effectiveDistance/isInRange directly on the redacted state it already has,
// with no unsafe `as any` cast.
interface DistanceQueryablePlayer {
  id: string;
  seat: number;
  isAlive: boolean;
  inPlay: PlayingCard[];
  character: CharacterId | "Unknown";
}
interface DistanceQueryableState {
  players: Record<string, DistanceQueryablePlayer>;
}

function alivePlayersInSeatOrder(state: DistanceQueryableState): DistanceQueryablePlayer[] {
  return Object.values(state.players)
    .filter((p) => p.isAlive)
    .sort((a, b) => a.seat - b.seat);
}

/** Circular seat distance between two alive players, adjusted by Mustang/Scope/character mods. */
export function distanceBetween(state: DistanceQueryableState, fromId: string, toId: string): number {
  if (fromId === toId) return 0;
  const alive = alivePlayersInSeatOrder(state);
  const idx = alive.findIndex((p) => p.id === fromId);
  const targetIdx = alive.findIndex((p) => p.id === toId);
  if (idx === -1 || targetIdx === -1) return Infinity;
  const n = alive.length;
  const clockwise = (targetIdx - idx + n) % n;
  const counter = (idx - targetIdx + n) % n;
  // Base circular seat distance; Mustang/Scope/character modifiers are
  // applied on top of this in effectiveDistance().
  return Math.min(clockwise, counter);
}

function hasCardKindInPlay(p: DistanceQueryablePlayer, kind: CardKind): boolean {
  return p.inPlay.some((c) => cardKindOf(c) === kind);
}

// A card's kind (Bang, Missed, Beer, ...) is resolved deterministically from
// its instance id via kindOfCardId — no runtime bookkeeping needed. This also
// means the client can identify cards in its own hand without extra data.
export function cardKindOf(card: PlayingCard): CardKind | undefined {
  return kindOfCardId(card.id);
}

/** Effective distance including Mustang (+1 to how far FROM sees TO... actually target's Mustang adds to others' view) and Scope. */
export function effectiveDistance(state: DistanceQueryableState, fromId: string, toId: string): number {
  let base = distanceBetween(state, fromId, toId);
  const from = state.players[fromId];
  const to = state.players[toId];
  if (hasCardKindInPlay(to, "Mustang")) base += 1;
  if (to.character === "ParisPete") base += 1;
  if (hasCardKindInPlay(from, "Scope")) base -= 1;
  if (from.character === "RoseDoolan") base -= 1;
  return Math.max(1, base);
}

function weaponRangeOf(p: DistanceQueryablePlayer): number {
  const weapon = p.inPlay.find((c) => WEAPON_RANGE[cardKindOf(c) ?? ("" as CardKind)] !== undefined);
  if (!weapon) return 1; // default range without weapon
  return WEAPON_RANGE[cardKindOf(weapon)!] ?? 1;
}

export function isInRange(state: DistanceQueryableState, shooterId: string, targetId: string): boolean {
  return effectiveDistance(state, shooterId, targetId) <= weaponRangeOf(state.players[shooterId]);
}

function drawFromDeck(state: GameState, count: number): PlayingCard[] {
  const drawn: PlayingCard[] = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      // reshuffle discard pile into deck (keep top card of discard aside)
      const top = state.discardPile.pop();
      state.deck = shuffle(state.discardPile);
      state.discardPile = top ? [top] : [];
    }
    const c = state.deck.pop();
    if (c) drawn.push(c);
  }
  return drawn;
}

function discard(state: GameState, card: PlayingCard) {
  state.discardPile.push(card);
}

function log(state: GameState, msg: string) {
  state.log.push(msg);
  if (state.log.length > 200) state.log.shift();
}

/** Increments the shared event counter and returns the new value, so a
 * PlayedCardEvent/JudgeDrawEvent gets a unique, ever-increasing `seq` that
 * clients can compare against the last one they've already animated. */
function bumpSeq(state: GameState): number {
  state.eventSeq += 1;
  return state.eventSeq;
}

/**
 * Shared "judge draw" for anything that flips a card from the deck to
 * decide an outcome (Dynamite check, Jail check, Barrel dodge attempt...).
 * Always discards the drawn card(s) and always publishes the result via
 * `state.lastJudgeDraw` so every client can see the flip (previously this
 * only happened server-side and was invisible to players).
 *
 * Lucky Duke draws 2 cards instead of 1 and gets to use whichever one is
 * more favorable (`isGood`), matching his character ability.
 */
export function drawJudgeCard(
  state: GameState,
  playerId: string,
  reason: "Dynamite" | "Jail" | "Barrel",
  isGood: (c: PlayingCard) => boolean,
  labelFor: (chosen: PlayingCard, good: boolean) => string
): { chosen: PlayingCard; good: boolean } {
  const player = state.players[playerId];
  const isLucky = player.character === "LuckyDuke";
  const drawnCount = isLucky ? 2 : 1;
  const drawn = drawFromDeck(state, drawnCount);
  drawn.forEach((c) => discard(state, c));
  let chosen = drawn[0];
  if (isLucky && drawn.length === 2) {
    chosen = drawn.find(isGood) ?? drawn[0];
  }
  const good = isGood(chosen);
  state.lastJudgeDraw = {
    seq: bumpSeq(state),
    playerId,
    card: chosen,
    reason,
    success: good,
    resultLabel: labelFor(chosen, good) + (isLucky ? " (Lucky Duke: chọn lá tốt hơn trong 2 lá)" : ""),
  };
  return { chosen, good };
}

// ---------------------------------------------------------------------------
// Turn flow
// ---------------------------------------------------------------------------

export function startTurnDrawPhase(state: GameState) {
  const p = state.players[state.currentPlayerId!];
  state.bangPlayedThisTurn[p.id] = 0;
  state.beerPlayedThisTurn[p.id] = 0;

  // Dynamite check (attached as blue card)
  const dynamite = p.inPlay.find((c) => cardKindOf(c) === "Dynamite");
  if (dynamite) {
    const { good: safe } = drawJudgeCard(
      state,
      p.id,
      "Dynamite",
      (c) => !(c.suit === "Spades" && ["2", "3", "4", "5", "6", "7", "8", "9"].includes(c.rank)),
      (_c, good) => (good ? "Thoát! Chuyền cho người kế tiếp" : "2-9 Bích — Nổ! Mất 3 máu")
    );
    p.inPlay = p.inPlay.filter((c) => c.id !== dynamite.id);
    if (!safe) {
      log(state, `${p.name} bị Dynamite nổ! Mất 3 máu.`);
      applyDamage(state, p.id, 3, null);
      discard(state, dynamite);
    } else {
      log(state, `${p.name} thoát Dynamite, chuyền cho người kế tiếp.`);
      const nextId = nextAlivePlayer(state, p.id);
      state.players[nextId].inPlay.push(dynamite);
    }
  }

  // Jail check (attached by an opponent)
  const jail = p.inPlay.find((c) => cardKindOf(c) === "Jail");
  if (jail && p.isAlive) {
    const { good: escaped } = drawJudgeCard(
      state,
      p.id,
      "Jail",
      (c) => c.suit === "Hearts",
      (_c, good) => (good ? "Ra Cơ — Thoát khỏi Jail!" : "Không phải Cơ — Bị giam, mất lượt này")
    );
    p.inPlay = p.inPlay.filter((c) => c.id !== jail.id);
    discard(state, jail);
    if (escaped) {
      log(state, `${p.name} thoát Jail (ra Cơ).`);
    } else {
      log(state, `${p.name} bị giam, mất lượt này.`);
      state.phase = "discard";
      endTurn(state);
      return;
    }
  }

  // Jesse Jones: may take the first card from another player's hand instead
  // of drawing from the deck. Only offer the choice if someone else still
  // has cards; otherwise just fall through to a normal draw.
  if (p.character === "JesseJones") {
    const eligible = Object.values(state.players).some((o) => o.isAlive && o.id !== p.id && o.hand.length > 0);
    if (eligible) {
      state.pendingResponse = { kind: "JesseDrawChoice", fromPlayerId: p.id, targetPlayerId: p.id };
      log(state, `${p.name} (Jesse Jones) có thể chọn rút bài từ tay người khác hoặc từ bộ bài.`);
      return;
    }
  }

  // Pedro Ramirez (JourdonaisPed): may take the top card of the discard
  // pile instead of drawing the first card from the deck.
  if (p.character === "JourdonaisPed" && state.discardPile.length > 0) {
    state.pendingResponse = { kind: "PedroDrawChoice", fromPlayerId: p.id, targetPlayerId: p.id };
    log(state, `${p.name} (Pedro Ramirez) có thể chọn lấy lá trên nóc chồng bỏ hoặc rút từ bộ bài.`);
    return;
  }

  // Kit Carlson: looks at the top 3 cards, keeps 2, puts 1 back on the
  // bottom of the deck unseen by anyone else.
  if (p.character === "KitCarlson") {
    const pool = drawFromDeck(state, 3);
    state.pendingResponse = { kind: "KitCarlsonDraw", fromPlayerId: p.id, targetPlayerId: p.id, data: { pool } };
    log(state, `${p.name} (Kit Carlson) lật 3 lá trên cùng để chọn 2 lá giữ lại.`);
    return;
  }

  const drawCount = 2;
  const drawn = drawFromDeck(state, drawCount);
  p.hand.push(...drawn);
  log(state, `${p.name} rút ${drawCount} lá.`);

  // Black Jack: if the second card drawn is Hearts or Diamonds, reveal it
  // and draw one extra card.
  if (p.character === "BlackJack" && drawn[1] && (drawn[1].suit === "Hearts" || drawn[1].suit === "Diamonds")) {
    state.lastJudgeDraw = {
      seq: bumpSeq(state),
      playerId: p.id,
      card: drawn[1],
      reason: "BlackJack",
      success: true,
      resultLabel: `${drawn[1].suit === "Hearts" ? "Cơ" : "Rô"}! Rút thêm 1 lá`,
    };
    const extra = drawFromDeck(state, 1);
    p.hand.push(...extra);
    log(state, `${p.name} (Black Jack) lá thứ 2 là ${drawn[1].suit === "Hearts" ? "Cơ" : "Rô"}, rút thêm 1 lá.`);
  }

  state.phase = "play";
}

function nextAlivePlayer(state: GameState, fromId: string): string {
  const order = state.turnOrder;
  const idx = order.indexOf(fromId);
  for (let i = 1; i <= order.length; i++) {
    const candidate = order[(idx + i) % order.length];
    if (state.players[candidate].isAlive) return candidate;
  }
  return fromId;
}

export function endTurn(state: GameState) {
  const current = state.players[state.currentPlayerId!];
  // Discard down to hand limit == hp
  if (current.hand.length > current.hp) {
    // In a real UI, the client should call discardExcessCards before endTurn.
    // As a safety net, auto-discard the excess from the end of the hand.
    while (current.hand.length > current.hp) {
      const c = current.hand.pop()!;
      discard(state, c);
    }
    log(state, `${current.name} bỏ bớt bài dư (giới hạn ${current.hp}).`);
  }
  const nextId = nextAlivePlayer(state, current.id);
  state.currentPlayerId = nextId;
  state.phase = "draw";
  startTurnDrawPhase(state);
}

// ---------------------------------------------------------------------------
// Damage / death / win condition
// ---------------------------------------------------------------------------

export function applyDamage(state: GameState, targetId: string, amount: number, sourceId: string | null) {
  const target = state.players[targetId];
  target.hp -= amount;
  if (target.character === "BartCassidy" && sourceId) {
    const drawn = drawFromDeck(state, amount);
    target.hand.push(...drawn);
    log(state, `${target.name} (Bart Cassidy) rút thêm ${amount} lá vì mất máu.`);
  }
  if (target.character === "ElGringo" && sourceId && state.players[sourceId]?.hand.length) {
    const shooterHand = state.players[sourceId].hand;
    const idx = Math.floor(Math.random() * shooterHand.length);
    const stolen = shooterHand.splice(idx, 1)[0];
    target.hand.push(stolen);
    log(state, `${target.name} (El Gringo) cướp 1 lá từ tay người bắn.`);
  }
  if (target.hp <= 0) {
    handleDeath(state, targetId, sourceId);
  }
}

function handleDeath(state: GameState, targetId: string, killerId: string | null) {
  const target = state.players[targetId];
  target.isAlive = false;
  target.roleRevealed = true;
  log(state, `${target.name} đã bị hạ gục! Vai trò: ${roleLabel(target.role)}.`);

  // Vulture Sam: whoever has this character takes the dead player's cards
  const sam = Object.values(state.players).find((p) => p.isAlive && p.character === "VultureSam");
  if (sam) {
    sam.hand.push(...target.hand, ...target.inPlay);
    log(state, `${sam.name} (Vulture Sam) lấy hết bài của ${target.name}.`);
  } else {
    target.inPlay.forEach((c) => discard(state, c));
  }
  target.hand = [];
  target.inPlay = [];

  // Killing an Outlaw as the shooter draws 3 cards (base game rule)
  if (killerId && killerId !== targetId && target.role === "Outlaw") {
    const drawn = drawFromDeck(state, 3);
    state.players[killerId].hand.push(...drawn);
    log(state, `${state.players[killerId].name} hạ được Outlaw, rút thêm 3 lá.`);
  }
  // Renegade killing the Sheriff by mistake (actually Sheriff killing Deputy) -> Sheriff loses all cards
  if (killerId && target.role === "Deputy" && state.players[killerId]?.role === "Sheriff") {
    const sheriff = state.players[killerId];
    sheriff.inPlay.forEach((c) => discard(state, c));
    sheriff.hand.forEach((c) => discard(state, c));
    sheriff.hand = [];
    sheriff.inPlay = [];
    log(state, `${sheriff.name} (Sheriff) giết nhầm Deputy nên mất hết bài!`);
  }

  checkWinCondition(state);

  // If the dead player was mid-turn, advance turn
  if (state.currentPlayerId === targetId && state.winner === null) {
    const nextId = nextAlivePlayer(state, targetId);
    state.currentPlayerId = nextId;
    state.phase = "draw";
    startTurnDrawPhase(state);
  }
}

function roleLabel(r: RoleName): string {
  return { Sheriff: "Cảnh trưởng", Deputy: "Phó cảnh trưởng", Outlaw: "Ngoài vòng pháp luật", Renegade: "Phản bội" }[r];
}

export function checkWinCondition(state: GameState) {
  const alive = Object.values(state.players).filter((p) => p.isAlive);
  const sheriffAlive = alive.some((p) => p.role === "Sheriff");
  const outlawsAlive = alive.filter((p) => p.role === "Outlaw").length;
  const renegadeAlive = alive.some((p) => p.role === "Renegade");

  if (!sheriffAlive) {
    if (alive.length === 1 && alive[0].role === "Renegade") {
      state.winner = "Renegade";
    } else if (outlawsAlive > 0 || renegadeAlive) {
      state.winner = "Outlaws+Renegade"; // Sheriff dead, Outlaws (or lone renegade path continues) -- simplified
      if (outlawsAlive === 0 && renegadeAlive) state.winner = "Renegade";
      else state.winner = "Outlaw";
    }
    state.phase = "gameover";
    log(state, `Sheriff đã chết. Trò chơi kết thúc.`);
    return;
  }
  if (outlawsAlive === 0 && !renegadeAlive) {
    state.winner = "Sheriff"; // Sheriff + Deputies win
    state.phase = "gameover";
    log(state, `Tất cả Outlaw và Renegade đã bị hạ. Sheriff & Deputy thắng!`);
  }
}


