import {
  applyDamage,
  cardKindOf,
  checkWinCondition,
  effectiveDistance,
  endTurn,
  finalizeCharacterSelection,
  isInRange,
} from "./gameEngine";
import { CARD_DEFS, WEAPON_RANGE } from "./data/cards";
import { CardKind, CharacterId, GameState, PlayingCard } from "./types";

export type ActionType =
  | { type: "PLAY_CARD"; playerId: string; cardId: string; kind: CardKind; targetId?: string; targetIds?: string[] }
  | { type: "RESPOND_MISSED"; playerId: string; cardId: string | null } // null = no Missed!, take the hit
  | { type: "RESPOND_DUEL"; playerId: string; cardId: string | null }
  | { type: "RESPOND_INDIANS"; playerId: string; cardId: string | null }
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
  return p.hand.splice(idx, 1)[0];
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
  if (actualKind !== action.kind) {
    throw new GameError("Lá bài không khớp với loại được yêu cầu.");
  }
  const def = CARD_DEFS[action.kind];

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
      state.pendingResponse = {
        kind: "IndiansResponse",
        fromPlayerId: player.id,
        targetPlayerId: others[0]?.id ?? player.id,
        data: { remaining: others.map((p) => p.id) },
      };
      state.phase = "targeting";
      state.log.push(`${player.name} chơi Indians! Mọi người phải bỏ Bang! hoặc mất máu.`);
      break;
    }
    case "Gatling": {
      state.discardPile.push(card);
      Object.values(state.players)
        .filter((p) => p.isAlive && p.id !== player.id)
        .forEach((target) => {
          // Simplified: Gatling lets each target respond with Missed! is normally
          // required, but to keep the engine tractable we resolve immediately.
          // TODO: route each target through a Missed! response like Bang!.
          applyDamage(state, target.id, 1, player.id);
        });
      state.log.push(`${player.name} chơi Gatling, bắn tất cả mọi người!`);
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

function stealOneCard(state: GameState, fromId: string, toId: string) {
  const target = state.players[toId];
  const thief = state.players[fromId];
  if (target.hand.length > 0) {
    const idx = Math.floor(Math.random() * target.hand.length);
    const [c] = target.hand.splice(idx, 1);
    thief.hand.push(c);
  } else if (target.inPlay.length > 0) {
    const c = target.inPlay.pop()!;
    thief.hand.push(c);
  }
  state.log.push(`${thief.name} lấy 1 lá từ ${target.name}.`);
}

function forceDiscardOneCard(state: GameState, targetId: string) {
  const target = state.players[targetId];
  if (target.hand.length > 0) {
    const idx = Math.floor(Math.random() * target.hand.length);
    const [c] = target.hand.splice(idx, 1);
    state.discardPile.push(c);
  } else if (target.inPlay.length > 0) {
    const c = target.inPlay.pop()!;
    state.discardPile.push(c);
  }
  state.log.push(`${target.name} bị buộc bỏ 1 lá.`);
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

function handleRespondMissed(state: GameState, action: Extract<ActionType, { type: "RESPOND_MISSED" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "BangResponse") throw new GameError("Không có Bang! nào đang chờ trả lời.");
  if (pending.targetPlayerId !== action.playerId) throw new GameError("Không phải bạn cần trả lời.");
  const target = state.players[action.playerId];
  const shooter = state.players[pending.fromPlayerId];

  let dodged = false;
  if (action.cardId) {
    const card = takeFromHand(state, action.playerId, action.cardId);
    if (cardKindOf(card) !== "Missed") throw new GameError("Lá bài này không phải Missed!.");
    state.discardPile.push(card);
    dodged = true;
  }

  if (!dodged) {
    applyDamage(state, target.id, 1, shooter.id);
    state.log.push(`${target.name} không né được, mất 1 máu.`);
  } else {
    state.log.push(`${target.name} né được Bang! bằng Missed!.`);
  }
  state.pendingResponse = null;
  state.phase = "play";
  checkWinCondition(state);
}

function handleRespondDuel(state: GameState, action: Extract<ActionType, { type: "RESPOND_DUEL" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "DuelResponse") throw new GameError("Không có Duel nào đang chờ.");
  if (pending.targetPlayerId !== action.playerId) throw new GameError("Không phải bạn cần trả lời.");

  if (!action.cardId) {
    // This player has no more Bang! to play -> loses the duel
    applyDamage(state, action.playerId, 1, pending.fromPlayerId);
    state.log.push(`${state.players[action.playerId].name} thua Duel, mất 1 máu.`);
    state.pendingResponse = null;
    state.phase = "play";
    checkWinCondition(state);
    return;
  }

  const card = takeFromHand(state, action.playerId, action.cardId);
  if (cardKindOf(card) !== "Bang") throw new GameError("Lá bài này không phải Bang!.");
  state.discardPile.push(card);
  // Swap turn: the other player must now respond
  state.pendingResponse = {
    kind: "DuelResponse",
    fromPlayerId: action.playerId,
    targetPlayerId: pending.fromPlayerId,
  };
  state.log.push(`${state.players[action.playerId].name} đáp trả trong Duel.`);
}

function handleRespondIndians(state: GameState, action: Extract<ActionType, { type: "RESPOND_INDIANS" }>) {
  const pending = state.pendingResponse;
  if (!pending || pending.kind !== "IndiansResponse") throw new GameError("Không có Indians! nào đang chờ.");
  const remaining = (pending.data?.remaining as string[]) ?? [];
  if (remaining[0] !== action.playerId) throw new GameError("Chưa tới lượt bạn trả lời Indians!.");

  if (action.cardId) {
    const card = takeFromHand(state, action.playerId, action.cardId);
    if (cardKindOf(card) !== "Bang") throw new GameError("Lá bài này không phải Bang!.");
    state.discardPile.push(card);
    state.log.push(`${state.players[action.playerId].name} bỏ Bang! để né Indians!.`);
  } else {
    applyDamage(state, action.playerId, 1, pending.fromPlayerId);
    state.log.push(`${state.players[action.playerId].name} mất 1 máu vì Indians!.`);
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
