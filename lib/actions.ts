import {
  applyDamage,
  cardKindOf,
  checkWinCondition,
  drawJudgeCard,
  effectiveDistance,
  endTurn,
  finalizeCharacterSelection,
  isInRange,
} from "./gameEngine";
import { CARD_DEFS, WEAPON_RANGE } from "./data/cards";
import { CardKind, CharacterId, GameState, PlayingCard } from "./types";

export type ActionType =
  | { type: "PLAY_CARD"; playerId: string; cardId: string; kind: CardKind; targetId?: string; targetIds?: string[] }
  | { type: "RESPOND_MISSED"; playerId: string; cardId: string | null; cardIds?: string[] } // null/[] = no Missed!, take the hit
  | { type: "RESPOND_DUEL"; playerId: string; cardId: string | null }
  | { type: "RESPOND_INDIANS"; playerId: string; cardId: string | null }
  | { type: "RESPOND_GATLING"; playerId: string; cardId: string | null }
  | { type: "ATTEMPT_BARREL"; playerId: string }
  | { type: "CHOOSE_JESSE_DRAW"; playerId: string; targetId?: string }
  | { type: "CHOOSE_PEDRO_DRAW"; playerId: string; useDiscard: boolean }
  | { type: "CHOOSE_KIT_CARLSON"; playerId: string; keepCardIds: string[] }
  | { type: "USE_SID_KETCHUM"; playerId: string; cardIds: string[] }
  | { type: "GENERAL_STORE_PICK"; playerId: string; cardId: string }
  | { type: "DISCARD_EXCESS"; playerId: string; cardIds: string[] }
  | { type: "CHOOSE_CHARACTER"; playerId: string; characterId: CharacterId }
  | { type: "END_TURN"; playerId: string };

export class GameError extends Error {}

function requireCurrentPlayer(state: GameState, playerId: string) {
  if (state.currentPlayerId !== playerId) {
    throw new GameError("Chưa tới lượt của bạn.");
  }
}

function takeFromHand(state: GameState, playerId: string, cardId: string): PlayingCard {
  const p = state.players[playerId];
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) throw new GameError("Bạn không có lá bài này trong tay.");
  const [card] = p.hand.splice(idx, 1);
  checkSuzyLafayette(state, playerId);
  return card;
}

/** Suzy Lafayette: the instant her hand hits 0 cards, she immediately draws 1. */
function checkSuzyLafayette(state: GameState, playerId: string) {
  const p = state.players[playerId];
  if (p && p.isAlive && p.character === "SuzyLafayette" && p.hand.length === 0) {
    const drawn = drawN(state, 1);
    if (drawn.length > 0) {
      p.hand.push(...drawn);
      state.log.push(`${p.name} (Suzy Lafayette) hết bài trên tay, rút ngay 1 lá.`);
    }
  }
}

/** Records a played/discarded card as the latest event so every client can
 * animate it flying from that player's seat to the center pile (only for
 * `toDiscard: true` cards — blue/equip cards stay in play instead). */
function recordPlayedCard(
  state: GameState,
  playerId: string,
  card: PlayingCard,
  kind: CardKind,
  targetId: string | undefined,
  toDiscard: boolean
) {
  state.eventSeq += 1;
  state.lastPlayedCard = { seq: state.eventSeq, playerId, card, kind, targetId, toDiscard };
}

export function applyAction(state: GameState, action: ActionType): GameState {
  switch (action.type) {
    case "PLAY_CARD":
      handlePlayCard(state, action);
      break;
    case "RESPOND_MISSED":
      handleRespondMissed(state, action);
      break;
    case "RESPOND_DUEL":
      handleRespondDuel(state, action);
      break;
    case "RESPOND_INDIANS":
      handleRespondIndians(state, action);
      break;
    case "RESPOND_GATLING":
      handleRespondGatling(state, action);
      break;
    case "ATTEMPT_BARREL":
      handleAttemptBarrel(state, action);
      break;
    case "CHOOSE_JESSE_DRAW":
      handleChooseJesseDraw(state, action);
      break;
    case "CHOOSE_PEDRO_DRAW":
      handleChoosePedroDraw(state, action);
      break;
    case "CHOOSE_KIT_CARLSON":
      handleChooseKitCarlson(state, action);
      break;
    case "USE_SID_KETCHUM":
      handleUseSidKetchum(state, action);
      break;
    case "GENERAL_STORE_PICK":
      handleGeneralStorePick(state, action);
      break;
    case "DISCARD_EXCESS":
      handleDiscardExcess(state, action);
      break;
    case "CHOOSE_CHARACTER":
      handleChooseCharacter(state, action);
      break;
    case "END_TURN":
      requireCurrentPlayer(state, action.playerId);
      if (state.phase !== "play" && state.phase !== "discard") {
        throw new GameError("Không thể kết thúc lượt lúc này.");
      }
      endTurn(state);
      break;
  }
  state.version += 1;
  return state;
}

function handlePlayCard(state: GameState, action: Extract<ActionType, { type: "PLAY_CARD" }>) {
  requireCurrentPlayer(state, action.playerId);
  if (state.phase !== "play") throw new GameError("Không phải giai đoạn ra bài.");
  const player = state.players[action.playerId];
  const card = takeFromHand(state, action.playerId, action.cardId);
  const actualKind = cardKindOf(card);
  // Calamity Janet can play Missed! as if it were Bang! (the reverse — using
  // Bang! as Missed! — is handled in the response handlers below).
  const calamitySwap = player.character === "CalamityJanet" && actualKind === "Missed" && action.kind === "Bang";
  if (actualKind !== action.kind && !calamitySwap) {
    throw new GameError("Lá bài không khớp với loại được yêu cầu.");
  }
  const def = CARD_DEFS[action.kind];
  recordPlayedCard(state, player.id, card, action.kind, action.targetId, def.category === "brown");

  switch (action.kind) {
    case "Bang": {
      const target = requireTarget(action);
      const unlimitedBang = player.character === "WillyTheKid";
      const bangCount = state.bangPlayedThisTurn[player.id] ?? 0;
      const hasVolcanicEquipped = player.inPlay.some((c) => cardKindOf(c) === "Volcanic");
      if (bangCount >= 1 && !unlimitedBang && !hasVolcanicEquipped && player.character !== "CalamityJanet") {
        throw new GameError("Bạn chỉ được đánh 1 Bang! mỗi lượt (trừ khi có Volcanic hoặc nhân vật đặc biệt).");
      }
      if (!isInRange(state, player.id, target)) {
        throw new GameError("Mục tiêu ngoài tầm bắn.");
      }
      state.bangPlayedThisTurn[player.id] = bangCount + 1;
      state.discardPile.push(card);
      state.pendingResponse = {
        kind: "BangResponse",
        fromPlayerId: player.id,
        targetPlayerId: target,
        cardInstanceId: card.id,
      };
      state.phase = "targeting";
      state.log.push(`${player.name} bắn ${state.players[target].name}!`);
      break;
    }
    case "Beer": {
      const beerCount = state.beerPlayedThisTurn[player.id] ?? 0;
      if (beerCount >= 1) {
        throw new GameError("Bạn chỉ được uống Beer 1 lần mỗi lượt.");
      }
      state.beerPlayedThisTurn[player.id] = beerCount + 1;
      const alivePlayers = Object.values(state.players).filter((p) => p.isAlive).length;
      state.discardPile.push(card);
      if (alivePlayers > 2 && player.hp < player.maxHp) {
        player.hp += 1;
        state.log.push(`${player.name} uống Beer, hồi 1 máu.`);
      } else {
        state.log.push(`${player.name} uống Beer nhưng không có tác dụng (chỉ còn 2 người / đã đầy máu).`);
      }
      break;
    }
    case "Saloon": {
      state.discardPile.push(card);
      Object.values(state.players).forEach((p) => {
        if (p.isAlive && p.hp < p.maxHp) p.hp += 1;
      });
      state.log.push(`${player.name} chơi Saloon, mọi người hồi 1 máu.`);
      break;
    }
    case "Stagecoach": {
      state.discardPile.push(card);
      const drawn = drawN(state, 2);
      player.hand.push(...drawn);
      state.log.push(`${player.name} rút thêm 2 lá từ Stagecoach.`);
      break;
    }
    case "WellsFargo": {
      state.discardPile.push(card);
      const drawn = drawN(state, 3);
      player.hand.push(...drawn);
      state.log.push(`${player.name} rút thêm 3 lá từ Wells Fargo.`);
      break;
    }
    case "Panic": {
      const target = requireTarget(action);
      if (effectiveDistance(state, player.id, target) > 1) {
        throw new GameError("Panic! chỉ dùng được với người trong khoảng cách 1.");
      }
      stealOneCard(state, player.id, target);
      state.discardPile.push(card);
      break;
    }
    case "CatBalou": {
      const target = requireTarget(action);
      forceDiscardOneCard(state, target);
      state.discardPile.push(card);
      break;
    }
    case "Duel": {
      const target = requireTarget(action);
      state.discardPile.push(card);
      state.pendingResponse = {
        kind: "DuelResponse",
        fromPlayerId: player.id,
        targetPlayerId: target,
      };
      state.phase = "targeting";
      state.log.push(`${player.name} thách đấu ${state.players[target].name}!`);
      break;
    }
    case "Indians": {
      state.discardPile.push(card);
      const others = Object.values(state.players).filter((p) => p.isAlive && p.id !== player.id);
      if (others.length === 0) {
        state.log.push(`${player.name} chơi Indians! nhưng không có ai khác.`);
        break;
      }
      state.pendingResponse = {
        kind: "IndiansResponse",
        fromPlayerId: player.id,
        targetPlayerId: others[0].id,
        data: { remaining: others.map((p) => p.id) },
      };
      state.phase = "targeting";
      state.log.push(`${player.name} chơi Indians! Mọi người phải bỏ Bang! hoặc mất máu.`);
      break;
    }
    case "Gatling": {
      state.discardPile.push(card);
      const targets = Object.values(state.players)
        .filter((p) => p.isAlive && p.id !== player.id)
        .map((p) => p.id);
      if (targets.length === 0) {
        state.log.push(`${player.name} chơi Gatling nhưng không có ai để bắn.`);
        break;
      }
      state.pendingResponse = {
        kind: "GatlingResponse",
        fromPlayerId: player.id,
        targetPlayerId: targets[0],
        data: { remaining: targets },
      };
      state.phase = "targeting";
      state.log.push(`${player.name} chơi Gatling, bắn tất cả mọi người! Mỗi người có thể dùng Missed! để né.`);
      break;
    }
    case "GeneralStore": {
      state.discardPile.push(card);
      const aliveCount = Object.values(state.players).filter((p) => p.isAlive).length;
      const revealed = drawN(state, aliveCount);
      state.pendingResponse = {
        kind: "GeneralStoreDraw",
        fromPlayerId: player.id,
        targetPlayerId: player.id,
        data: { pool: revealed, pickOrder: pickOrderFrom(state, player.id) },
      };
      state.phase = "targeting";
      state.log.push(`${player.name} chơi General Store, lật ${aliveCount} lá.`);
      break;
    }
    case "Barrel":
    case "Scope":
    case "Mustang":
      player.inPlay.push(card);
      state.log.push(`${player.name} trang bị ${def.label}.`);
      break;
    case "Volcanic":
    case "Schofield":
    case "Remington":
    case "RevCarabine":
    case "Winchester": {
      const existingWeapon = player.inPlay.find((c) => WEAPON_RANGE[cardKindOf(c) ?? ("" as CardKind)] !== undefined);
      if (existingWeapon) {
        player.inPlay = player.inPlay.filter((c) => c.id !== existingWeapon.id);
        state.discardPile.push(existingWeapon);
      }
      player.inPlay.push(card);
      state.log.push(`${player.name} trang bị súng ${def.label}.`);
      break;
    }
    case "Jail": {
      const target = requireTarget(action);
      if (state.players[target].isSheriff) throw new GameError("Không thể gắn Jail vào Sheriff.");
      state.players[target].inPlay.push(card);
      state.log.push(`${player.name} gắn Jail vào ${state.players[target].name}.`);
      break;
    }
    case "Dynamite":
      player.inPlay.push(card);
      state.log.push(`${player.name} trang bị Dynamite.`);
      break;
    case "Missed":
      throw new GameError("Missed! chỉ dùng để trả lời Bang!, không tự đánh ra được.");
    default:
      throw new GameError(`Chưa hỗ trợ lá bài ${action.kind}.`);
  }

  checkWinCondition(state);
}

function requireTarget(action: Extract<ActionType, { type: "PLAY_CARD" }>): string {
  if (!action.targetId) throw new GameError("Lá bài này cần chọn mục tiêu.");
  return action.targetId;
}

function drawN(state: GameState, n: number): PlayingCard[] {
  const out: PlayingCard[] = [];
  for (let i = 0; i < n; i++) {
    if (state.deck.length === 0) {
      const top = state.discardPile.pop();
      state.deck = state.discardPile;
      state.discardPile = top ? [top] : [];
    }
    const c = state.deck.pop();
    if (c) out.push(c);
  }
  return out;
}

/** A single pool of "hand or field" locations, used so Panic!/Cat Balou can
 * genuinely land on either — previously this only ever touched a player's
 * field cards once their hand was completely empty. */
function handAndFieldPool(target: { hand: PlayingCard[]; inPlay: PlayingCard[] }): Array<{ from: "hand" | "inPlay"; index: number }> {
  return [
    ...target.hand.map((_, index) => ({ from: "hand" as const, index })),
    ...target.inPlay.map((_, index) => ({ from: "inPlay" as const, index })),
  ];
}

function stealOneCard(state: GameState, fromId: string, toId: string) {
  const target = state.players[toId];
  const thief = state.players[fromId];
  const pool = handAndFieldPool(target);
  if (pool.length === 0) {
    state.log.push(`${target.name} không còn lá nào để mất.`);
    return;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const c = pick.from === "hand" ? target.hand.splice(pick.index, 1)[0] : target.inPlay.splice(pick.index, 1)[0];
  thief.hand.push(c);
  checkSuzyLafayette(state, target.id);
  state.log.push(`${thief.name} lấy 1 lá từ ${target.name} (${pick.from === "hand" ? "trên tay" : "trên sân"}).`);
}

function forceDiscardOneCard(state: GameState, targetId: string) {
  const target = state.players[targetId];
  const pool = handAndFieldPool(target);
  if (pool.length === 0) {
    state.log.push(`${target.name} không còn lá nào để bỏ.`);
    return;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const c = pick.from === "hand" ? target.hand.splice(pick.index, 1)[0] : target.inPlay.splice(pick.index, 1)[0];
  state.discardPile.push(c);
  const kind = cardKindOf(c);
  if (kind) recordPlayedCard(state, target.id, c, kind, undefined, true);
  checkSuzyLafayette(state, target.id);
  state.log.push(`${target.name} bị buộc bỏ 1 lá (${pick.from === "hand" ? "trên tay" : "trên sân"}).`);
}

function pickOrderFrom(state: GameState, startId: string): string[] {
  const order = state.turnOrder;
  const idx = order.indexOf(startId);
  const rotated = [...order.slice(idx), ...order.slice(0, idx)];
  return rotated.filter((id) => state.players[id].isAlive);
}

// ---------------------------------------------------------------------------
// Character selection (pick 1 of 2 dealt candidates)
// ---------------------------------------------------------------------------

function handleChooseCharacter(state: GameState, action: Extract<ActionType, { type: "CHOOSE_CHARACTER" }>) {
  if (state.phase !== "characterSelect") {
    throw new GameError("Không phải giai đoạn chọn nhân vật.");
  }
  const player = state.players[action.playerId];
  if (!player) throw new GameError("Người chơi không tồn tại.");
  if (player.characterChosen) throw new GameError("Bạn đã chọn nhân vật rồi.");
  if (!player.characterChoices.includes(action.characterId)) {
    throw new GameError("Nhân vật này không nằm trong 2 lựa chọn của bạn.");
  }

  player.character = action.characterId;
  player.characterChosen = true;
  player.characterChoices = [];
  state.log.push(`${player.name} đã chọn xong nhân vật.`);

  const allChosen = Object.values(state.players).every((p) => p.characterChosen);
  if (allChosen) {
    finalizeCharacterSelection(state);
  }
}

// ---------------------------------------------------------------------------
// Responses to pending prompts
// ---------------------------------------------------------------------------

/** Calamity Janet can use a Bang! card as if it were Missed! when dodging. */
function isValidDodgeCard(target: { character: CharacterId }, kind: CardKind | undefined): boolean {
  return kind === "Missed" || (target.character === "CalamityJanet" && kind === "Bang");
}

/** Calamity Janet can use a Missed! card as if it were Bang! when countering (Duel/Indians!). */
function isValidCounterCard(player: { character: CharacterId }, kind: CardKind | undefined): boolean {
  return kind === "Bang" || (player.character === "CalamityJanet" && kind === "Missed");
}

function handleRespondMissed(state: GameState, action: Extract<ActionType, { type: "RESPOND_MISSED" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "BangResponse") throw new GameError("Không có Bang! nào đang chờ trả lời.");
  if (pending.targetPlayerId !== action.playerId) throw new GameError("Không phải bạn cần trả lời.");
  const target = state.players[action.playerId];
  const shooter = state.players[pending.fromPlayerId];
  const requiredCount = shooter.character === "SlabTheKiller" ? 2 : 1;

  const ids = action.cardIds && action.cardIds.length > 0 ? action.cardIds : action.cardId ? [action.cardId] : [];

  let dodged = false;
  if (ids.length > 0) {
    if (ids.length < requiredCount) {
      throw new GameError(`${shooter.name} là Slab the Killer, bạn cần ${requiredCount} lá Missed! để né.`);
    }
    const useIds = ids.slice(0, requiredCount);
    const peeked = useIds.map((id) => target.hand.find((c) => c.id === id));
    if (peeked.some((c) => !c)) throw new GameError("Bạn không có lá bài này trong tay.");
    const allValid = peeked.every((c) => isValidDodgeCard(target, cardKindOf(c!)));
    if (!allValid) throw new GameError("Lá bài này không dùng để né được.");
    const cards = useIds.map((id) => takeFromHand(state, action.playerId, id));
    cards.forEach((c) => {
      state.discardPile.push(c);
      recordPlayedCard(state, action.playerId, c, cardKindOf(c)!, pending.fromPlayerId, true);
    });
    dodged = true;
  }

  if (!dodged) {
    applyDamage(state, target.id, 1, shooter.id);
    state.log.push(`${target.name} không né được, mất 1 máu.`);
  } else {
    state.log.push(`${target.name} né được Bang!${requiredCount === 2 ? " bằng 2 lá Missed!" : ""}.`);
  }
  state.pendingResponse = null;
  state.phase = "play";
  checkWinCondition(state);
}

/** Barrel (or Jourdonnais's natural Barrel): before deciding on Missed!, the
 * target of a Bang! may flip a card — Hearts dodges it outright. */
function handleAttemptBarrel(state: GameState, action: Extract<ActionType, { type: "ATTEMPT_BARREL" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "BangResponse") throw new GameError("Không có Bang! nào đang chờ trả lời.");
  if (pending.targetPlayerId !== action.playerId) throw new GameError("Không phải bạn cần trả lời.");
  if (pending.data?.barrelAttempted) throw new GameError("Bạn đã thử Barrel cho lần Bang! này rồi.");
  const player = state.players[action.playerId];
  const hasBarrel = player.inPlay.some((c) => cardKindOf(c) === "Barrel") || player.character === "JohnnyKisch";
  if (!hasBarrel) throw new GameError("Bạn không có Barrel.");

  const { good: dodged } = drawJudgeCard(
    state,
    player.id,
    "Barrel",
    (c) => c.suit === "Hearts",
    (_c, good) => (good ? "Cơ! Né được Bang!" : "Không phải Cơ — không né được")
  );

  if (dodged) {
    state.log.push(`${player.name} dùng Barrel né được Bang!.`);
    state.pendingResponse = null;
    state.phase = "play";
  } else {
    state.log.push(`${player.name} thử Barrel nhưng không né được, vẫn có thể dùng Missed! hoặc chịu trận.`);
    state.pendingResponse = { ...pending, data: { ...(pending.data ?? {}), barrelAttempted: true } };
  }
}

function handleRespondDuel(state: GameState, action: Extract<ActionType, { type: "RESPOND_DUEL" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "DuelResponse") throw new GameError("Không có Duel nào đang chờ.");
  if (pending.targetPlayerId !== action.playerId) throw new GameError("Không phải bạn cần trả lời.");

  if (!action.cardId) {
    applyDamage(state, action.playerId, 1, pending.fromPlayerId);
    state.log.push(`${state.players[action.playerId].name} thua Duel, mất 1 máu.`);
    state.pendingResponse = null;
    state.phase = "play";
    checkWinCondition(state);
    return;
  }

  const player = state.players[action.playerId];
  const peeked = player.hand.find((c) => c.id === action.cardId);
  if (!peeked) throw new GameError("Bạn không có lá bài này trong tay.");
  const kind = cardKindOf(peeked);
  if (!isValidCounterCard(player, kind)) throw new GameError("Lá bài này không phải Bang!.");

  const card = takeFromHand(state, action.playerId, action.cardId);
  state.discardPile.push(card);
  recordPlayedCard(state, action.playerId, card, kind!, pending.fromPlayerId, true);
  // Swap turn: the other player must now respond
  state.pendingResponse = {
    kind: "DuelResponse",
    fromPlayerId: action.playerId,
    targetPlayerId: pending.fromPlayerId,
  };
  state.log.push(`${player.name} đáp trả trong Duel.`);
}

function handleRespondIndians(state: GameState, action: Extract<ActionType, { type: "RESPOND_INDIANS" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "IndiansResponse") throw new GameError("Không có Indians! nào đang chờ.");
  const remaining = (pending.data?.remaining as string[]) ?? [];
  if (remaining[0] !== action.playerId) throw new GameError("Chưa tới lượt bạn trả lời Indians!.");
  const player = state.players[action.playerId];

  if (action.cardId) {
    const peeked = player.hand.find((c) => c.id === action.cardId);
    if (!peeked) throw new GameError("Bạn không có lá bài này trong tay.");
    const kind = cardKindOf(peeked);
    if (!isValidCounterCard(player, kind)) throw new GameError("Lá bài này không phải Bang!.");
    const card = takeFromHand(state, action.playerId, action.cardId);
    state.discardPile.push(card);
    recordPlayedCard(state, action.playerId, card, kind!, pending.fromPlayerId, true);
    state.log.push(`${player.name} bỏ Bang! để né Indians!.`);
  } else {
    applyDamage(state, action.playerId, 1, pending.fromPlayerId);
    state.log.push(`${player.name} mất 1 máu vì Indians!.`);
  }

  const rest = remaining.slice(1);
  if (rest.length === 0) {
    state.pendingResponse = null;
    state.phase = "play";
  } else {
    state.pendingResponse = { ...pending, targetPlayerId: rest[0], data: { remaining: rest } };
  }
  checkWinCondition(state);
}

function handleRespondGatling(state: GameState, action: Extract<ActionType, { type: "RESPOND_GATLING" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "GatlingResponse") throw new GameError("Không có Gatling nào đang chờ.");
  const remaining = (pending.data?.remaining as string[]) ?? [];
  if (remaining[0] !== action.playerId) throw new GameError("Chưa tới lượt bạn trả lời Gatling.");
  const target = state.players[action.playerId];
  const shooter = state.players[pending.fromPlayerId];

  let dodged = false;
  if (action.cardId) {
    const peeked = target.hand.find((c) => c.id === action.cardId);
    if (!peeked) throw new GameError("Bạn không có lá bài này trong tay.");
    const kind = cardKindOf(peeked);
    if (!isValidDodgeCard(target, kind)) throw new GameError("Lá bài này không né được.");
    const card = takeFromHand(state, action.playerId, action.cardId);
    state.discardPile.push(card);
    recordPlayedCard(state, action.playerId, card, kind!, pending.fromPlayerId, true);
    dodged = true;
  }

  if (!dodged) {
    applyDamage(state, target.id, 1, shooter.id);
    state.log.push(`${target.name} trúng Gatling, mất 1 máu.`);
  } else {
    state.log.push(`${target.name} né được Gatling.`);
  }

  const rest = remaining.slice(1);
  if (rest.length === 0) {
    state.pendingResponse = null;
    state.phase = "play";
  } else {
    state.pendingResponse = { ...pending, targetPlayerId: rest[0], data: { remaining: rest } };
  }
  checkWinCondition(state);
}

// ---------------------------------------------------------------------------
// Start-of-turn draw choices (Jesse Jones / Pedro Ramirez / Kit Carlson)
// ---------------------------------------------------------------------------

function handleChooseJesseDraw(state: GameState, action: Extract<ActionType, { type: "CHOOSE_JESSE_DRAW" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "JesseDrawChoice") throw new GameError("Không có lựa chọn rút bài nào đang chờ.");
  if (pending.targetPlayerId !== action.playerId) throw new GameError("Không phải bạn.");
  const player = state.players[action.playerId];

  if (action.targetId) {
    const target = state.players[action.targetId];
    if (!target || !target.isAlive || target.id === player.id) throw new GameError("Mục tiêu không hợp lệ.");
    if (target.hand.length > 0) {
      const idx = Math.floor(Math.random() * target.hand.length);
      const [c] = target.hand.splice(idx, 1);
      player.hand.push(c);
      checkSuzyLafayette(state, target.id);
      state.log.push(`${player.name} (Jesse Jones) lấy 1 lá từ tay ${target.name}.`);
    } else {
      state.log.push(`${target.name} không còn lá nào trên tay.`);
    }
    const extra = drawN(state, 1);
    player.hand.push(...extra);
    state.log.push(`${player.name} rút thêm 1 lá từ bộ bài.`);
  } else {
    const drawn = drawN(state, 2);
    player.hand.push(...drawn);
    state.log.push(`${player.name} rút 2 lá từ bộ bài.`);
  }
  state.pendingResponse = null;
  state.phase = "play";
}

function handleChoosePedroDraw(state: GameState, action: Extract<ActionType, { type: "CHOOSE_PEDRO_DRAW" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "PedroDrawChoice") throw new GameError("Không có lựa chọn rút bài nào đang chờ.");
  if (pending.targetPlayerId !== action.playerId) throw new GameError("Không phải bạn.");
  const player = state.players[action.playerId];

  if (action.useDiscard && state.discardPile.length > 0) {
    const top = state.discardPile.pop()!;
    player.hand.push(top);
    state.log.push(`${player.name} (Pedro Ramirez) lấy 1 lá từ nóc chồng bỏ.`);
    const extra = drawN(state, 1);
    player.hand.push(...extra);
    state.log.push(`${player.name} rút thêm 1 lá từ bộ bài.`);
  } else {
    const drawn = drawN(state, 2);
    player.hand.push(...drawn);
    state.log.push(`${player.name} rút 2 lá từ bộ bài.`);
  }
  state.pendingResponse = null;
  state.phase = "play";
}

function handleChooseKitCarlson(state: GameState, action: Extract<ActionType, { type: "CHOOSE_KIT_CARLSON" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "KitCarlsonDraw") throw new GameError("Không có lựa chọn Kit Carlson nào đang chờ.");
  if (pending.targetPlayerId !== action.playerId) throw new GameError("Không phải bạn.");
  const pool = (pending.data?.pool as PlayingCard[]) ?? [];
  const player = state.players[action.playerId];
  if (action.keepCardIds.length !== 2) throw new GameError("Phải chọn đúng 2 lá để giữ lại.");
  const kept = action.keepCardIds.map((id) => pool.find((c) => c.id === id));
  if (kept.some((c) => !c)) throw new GameError("Lựa chọn không hợp lệ.");
  const keptCards = kept as PlayingCard[];
  const leftover = pool.find((c) => !action.keepCardIds.includes(c.id));

  player.hand.push(...keptCards);
  if (leftover) state.deck.unshift(leftover);
  state.log.push(`${player.name} (Kit Carlson) chọn 2 trong 3 lá, úp 1 lá xuống đáy bộ bài.`);
  state.pendingResponse = null;
  state.phase = "play";
}

// ---------------------------------------------------------------------------
// Sid Ketchum: discard 2 cards anytime on your turn to heal 1 HP
// ---------------------------------------------------------------------------

function handleUseSidKetchum(state: GameState, action: Extract<ActionType, { type: "USE_SID_KETCHUM" }>) {
  const player = state.players[action.playerId];
  if (!player) throw new GameError("Người chơi không tồn tại.");
  if (player.character !== "SidKetchum") throw new GameError("Chỉ Sid Ketchum mới dùng được khả năng này.");
  requireCurrentPlayer(state, action.playerId);
  if (state.phase !== "play") throw new GameError("Chỉ dùng được trong giai đoạn ra bài.");
  if (action.cardIds.length !== 2) throw new GameError("Cần bỏ đúng 2 lá.");
  if (player.hp >= player.maxHp) throw new GameError("Bạn đã đầy máu.");
  const uniqueIds = new Set(action.cardIds);
  if (uniqueIds.size !== 2) throw new GameError("Cần 2 lá khác nhau.");
  const peeked = action.cardIds.map((id) => player.hand.find((c) => c.id === id));
  if (peeked.some((c) => !c)) throw new GameError("Bạn không có lá bài này trong tay.");

  const cards = action.cardIds.map((id) => takeFromHand(state, action.playerId, id));
  cards.forEach((c) => state.discardPile.push(c));
  player.hp += 1;
  state.log.push(`${player.name} (Sid Ketchum) bỏ 2 lá để hồi 1 máu.`);
}

function handleGeneralStorePick(state: GameState, action: Extract<ActionType, { type: "GENERAL_STORE_PICK" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "GeneralStoreDraw") throw new GameError("Không có General Store đang chờ.");
  const order = (pending.data?.pickOrder as string[]) ?? [];
  if (order[0] !== action.playerId) throw new GameError("Chưa tới lượt bạn chọn bài.");
  const pool = (pending.data?.pool as PlayingCard[]) ?? [];
  const idx = pool.findIndex((c) => c.id === action.cardId);
  if (idx === -1) throw new GameError("Lá bài không có trong General Store.");
  const [card] = pool.splice(idx, 1);
  state.players[action.playerId].hand.push(card);

  const rest = order.slice(1);
  if (rest.length === 0 || pool.length === 0) {
    state.pendingResponse = null;
    state.phase = "play";
  } else {
    state.pendingResponse = { ...pending, targetPlayerId: rest[0], data: { pool, pickOrder: rest } };
  }
}

function handleDiscardExcess(state: GameState, action: Extract<ActionType, { type: "DISCARD_EXCESS" }>) {
  const player = state.players[action.playerId];
  action.cardIds.forEach((id) => {
    const c = takeFromHand(state, action.playerId, id);
    state.discardPile.push(c);
  });
  state.log.push(`${player.name} bỏ ${action.cardIds.length} lá dư.`);
}
