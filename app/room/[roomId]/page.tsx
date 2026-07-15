"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { fetchState, joinRoom, sendAction, startGame } from "@/lib/api";
import { PlayingCard, RedactedGameState } from "@/lib/types";
import { CARD_DEFS, kindOfCardId } from "@/lib/data/cards";
import { CardFace } from "@/components/CardView";
import { DeckPile } from "@/components/DeckPile";
import { DiscardHistoryModal } from "@/components/DiscardHistoryModal";
import { JudgeDrawReveal } from "@/components/JudgeDrawReveal";
import { FlyingCard } from "@/components/FlyingCard";
import { PlayerSeat, ROLE_LABEL } from "@/components/PlayerSeat";
import { CharacterModal } from "@/components/CharacterModal";
import { CHARACTERS, CHARACTER_IMAGE_SRC } from "@/lib/data/characters";
import { ActionType } from "@/lib/actions";
import { effectiveDistance, isInRange } from "@/lib/gameEngine";

interface LobbyPlayer {
  player_id: string;
  name: string;
  seat: number;
}

const TARGETABLE_KINDS = new Set(["Bang", "Panic", "CatBalou", "Duel", "Jail"]);

/** Even spread of the other players across the top arc of the oval table
 * (the viewer's own seat sits below, outside this arc). angleDeg 0 = top
 * dead-center; the arc widens symmetrically to both sides as there are
 * more players. */
function otherSeatStyle(index: number, total: number): React.CSSProperties {
  const spread = Math.min(230, 90 + total * 24);
  const start = -spread / 2;
  const step = total > 1 ? spread / (total - 1) : 0;
  const angleDeg = start + step * index;
  const angleRad = (angleDeg * Math.PI) / 180;
  const rx = 46;
  const ry = 42;
  const left = 50 + rx * Math.sin(angleRad);
  const top = 50 - ry * Math.cos(angleRad);
  return { left: `${left}%`, top: `${top}%` };
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [roomStatus, setRoomStatus] = useState<"lobby" | "playing" | "finished" | "loading">("loading");
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [state, setState] = useState<RedactedGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [pendingTargetCardId, setPendingTargetCardId] = useState<string | null>(null);
  const [infoPlayerId, setInfoPlayerId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // ---- Saloon: choose "heal everyone" (official rule) or "heal only me" ----
  const [pendingSaloonCardId, setPendingSaloonCardId] = useState<string | null>(null);

  // ---- Cat Balou / Panic!: choose a specific visible field card of the
  // target to take/discard, or fall back to a random hand card ----
  const [pendingStealChoice, setPendingStealChoice] = useState<{ cardId: string; kind: string; targetId: string } | null>(
    null
  );

  // ---- Sid Ketchum: pick 2 hand cards to discard for +1 HP ----
  const [sidMode, setSidMode] = useState(false);
  const [sidSelected, setSidSelected] = useState<string[]>([]);

  // ---- End of turn: hand size over the limit (= current HP) — the player
  // must choose which cards to discard themselves before the turn can end ----
  const [discardMode, setDiscardMode] = useState(false);
  const [discardSelected, setDiscardSelected] = useState<string[]>([]);

  // ---- Slab the Killer: shooter requires 2 Missed! to dodge ----
  const [slabSelected, setSlabSelected] = useState<string[]>([]);

  // ---- Kit Carlson: choose 2 of 3 revealed cards to keep ----
  const [kitSelected, setKitSelected] = useState<string[]>([]);

  // ---- Card animation state ----
  // Ids of hand cards that just got drawn (deal-in animation), auto-cleared.
  const [justDrawnIds, setJustDrawnIds] = useState<Set<string>>(new Set());
  // Card currently being played, shown with a fly-away exit animation
  // (the card then lands in the messy discard pile via DeckPile once the
  // server confirms the play and refreshes state.discardPile).
  const [leavingCardId, setLeavingCardId] = useState<string | null>(null);
  const prevHandIdsRef = useRef<Set<string>>(new Set());

  // A flying card overlay for OTHER players' plays: reactive, triggered once
  // the server confirms (via state.lastPlayedCard), flying from that
  // player's seat position to the center discard pile.
  const [flight, setFlight] = useState<{
    id: number;
    card: PlayingCard;
    kind?: string;
    label: string;
    from: { x: number; y: number; width: number; height: number };
    to: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const seatElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const discardPileElRef = useRef<HTMLDivElement | null>(null);
  const lastPlayedSeqRef = useRef<number | null>(null);

  const playerIdRef = useRef<string | null>(null);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    const stored = sessionStorage.getItem(`bang_playerId_${roomId}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only API on mount
    setPlayerId(stored);
  }, [roomId]);

  const refreshLobby = useCallback(async () => {
    const { data: room } = await supabaseBrowser.from("rooms").select("*").eq("id", roomId).single();
    if (room) setRoomStatus(room.status);
    const { data: players } = await supabaseBrowser
      .from("room_players")
      .select("*")
      .eq("room_id", roomId)
      .order("seat", { ascending: true });
    if (players) setLobbyPlayers(players as LobbyPlayer[]);
  }, [roomId]);

  const refreshGameState = useCallback(async () => {
    const pid = playerIdRef.current;
    if (!pid) return;
    try {
      const s = await fetchState(roomId, pid);
      setState(s);
    } catch (e) {
      console.error("Realtime: Failed to fetch state", e);
    }
  }, [roomId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount, then realtime keeps it in sync
    refreshLobby();
    console.log("Realtime: Subscribing to room", roomId);
    const channel = supabaseBrowser
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, (payload) => {
        console.log("Realtime event: room_players changed", payload);
        refreshLobby();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (payload) => {
        console.log("Realtime event: rooms changed", payload);
        refreshLobby();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_state_version", filter: `room_id=eq.${roomId}` },
        (payload) => {
          console.log("Realtime event: room_state_version changed", payload);
          refreshGameState();
        }
      )
      .subscribe((status, err) => {
        console.log(`Realtime subscription status for room-${roomId}:`, status);
        if (err) console.error("Realtime subscription error:", err);
      });
    return () => {
      console.log("Realtime: Unsubscribing from room", roomId);
      supabaseBrowser.removeChannel(channel);
    };
  }, [roomId, refreshLobby, refreshGameState]);

  useEffect(() => {
    if (roomStatus === "playing") refreshGameState();
  }, [roomStatus, refreshGameState]);

  // Fallback Polling: Tự động cập nhật 2 giây một lần để đề phòng kết nối Realtime bị lỗi/chặn
  useEffect(() => {
    if (!playerId) return;

    const interval = setInterval(() => {
      if (roomStatus === "playing") {
        refreshGameState();
      } else if (roomStatus === "lobby") {
        refreshLobby();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [playerId, roomStatus, refreshGameState, refreshLobby]);

  async function handleJoinInline() {
    if (!joinName.trim()) return;
    try {
      const { playerId: pid } = await joinRoom(roomId, joinName.trim());
      sessionStorage.setItem(`bang_playerId_${roomId}`, pid);
      setPlayerId(pid);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleStart() {
    try {
      await startGame(roomId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function act(action: ActionType) {
    if (!playerId) return;
    setError(null);
    try {
      const s = await sendAction(roomId, playerId, action);
      setState(s);
      setSelectedCardId(null);
      setPendingTargetCardId(null);
      setSidMode(false);
      setSidSelected([]);
      setSlabSelected([]);
      setKitSelected([]);
    } catch (e) {
      setError((e as Error).message);
      // Action failed server-side (e.g. rejected move) — cancel the optimistic
      // "flying away" animation so the card reappears in hand normally.
      setLeavingCardId(null);
    }
  }

  // Kicks off the fly-away animation for a card as soon as it's played,
  // for immediate feedback while the server request is in flight. Once the
  // server confirms and state.discardPile refreshes, the card shows up
  // (freshly animated) in the messy pile rendered by <DeckPile>.
  function animateCardPlay(cardId: string) {
    const card = me?.hand?.find((c) => c.id === cardId);
    if (!card) return;
    setLeavingCardId(cardId);
    setTimeout(() => setLeavingCardId(null), 380);
  }

  function registerSeatEl(id: string, el: HTMLDivElement | null) {
    if (el) seatElRefs.current.set(id, el);
    else seatElRefs.current.delete(id);
  }

  const me = state && playerId ? state.players[playerId] : null;
  const isMyTurn = state?.currentPlayerId === playerId;
  const pending = state?.pendingResponse ?? null;
  const isMyResponse = pending?.targetPlayerId === playerId;

  const others = useMemo(() => {
    if (!state || !playerId) return [];
    const mySeat = state.players[playerId]?.seat ?? 0;
    const totalPlayers = Object.keys(state.players).length;
    return Object.values(state.players)
      .filter((p) => p.id !== playerId)
      .sort((a, b) => {
        const relA = (a.seat - mySeat + totalPlayers) % totalPlayers;
        const relB = (b.seat - mySeat + totalPlayers) % totalPlayers;
        return relA - relB;
      });
  }, [state, playerId]);

  // Animate other players' played cards flying from their seat to the
  // center discard pile. Guards against animating stale events from before
  // this client was even mounted (e.g. right after a page reload mid-game).
  useEffect(() => {
    const evt = state?.lastPlayedCard;
    if (!evt) return;
    if (lastPlayedSeqRef.current === null) {
      // First event we've ever seen this session — remember it but don't animate.
      lastPlayedSeqRef.current = evt.seq;
      return;
    }
    if (evt.seq <= lastPlayedSeqRef.current) return;
    lastPlayedSeqRef.current = evt.seq;
    if (!evt.toDiscard) return; // equip cards stay in play, no center flight
    if (evt.playerId === playerId) return; // already animated optimistically in my own hand

    const fromEl = seatElRefs.current.get(evt.playerId);
    const toEl = discardPileElRef.current;
    if (!fromEl || !toEl) return;
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const label = CARD_DEFS[evt.kind]?.label ?? "?";
    setFlight({
      id: evt.seq,
      card: evt.card,
      kind: evt.kind,
      label,
      from: { x: fromRect.x, y: fromRect.y, width: fromRect.width, height: fromRect.height },
      to: { x: toRect.x, y: toRect.y, width: toRect.width, height: toRect.height },
    });
  }, [state?.lastPlayedCard, playerId]);

  const handIdsKey = me?.hand?.map((c) => c.id).join(",") ?? "";

  useEffect(() => {
    const hand = me?.hand;
    if (!hand) return;
    const currentIds = new Set(hand.map((c) => c.id));
    const prevIds = prevHandIdsRef.current;
    const newlyDrawn = hand.filter((c) => !prevIds.has(c.id)).map((c) => c.id);
    prevHandIdsRef.current = currentIds;
    if (newlyDrawn.length === 0) return;
    setJustDrawnIds((prev) => new Set([...prev, ...newlyDrawn]));
    const timer = setTimeout(() => {
      setJustDrawnIds((prev) => {
        const next = new Set(prev);
        newlyDrawn.forEach((id) => next.delete(id));
        return next;
      });
    }, 550);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed by handIdsKey (content), not the me.hand object reference
  }, [handIdsKey]);

  if (!playerId) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm border-2 border-dust/40 rounded-lg p-8 bg-leather/60">
          <h1 className="font-western text-3xl text-rust mb-4 text-center">Vào phòng {roomId}</h1>
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Tên của bạn"
            className="w-full mb-4 px-3 py-2 rounded bg-ink border border-dust/40 text-parchment focus:outline-none focus:ring-2 focus:ring-rust"
            suppressHydrationWarning
          />
          <button onClick={handleJoinInline} className="w-full py-2 rounded bg-rust hover:bg-rust/80 font-semibold">
            Tham gia
          </button>
          {error && <p className="mt-3 text-sm text-rust">{error}</p>}
        </div>
      </main>
    );
  }

  if (roomStatus === "lobby") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md border-2 border-dust/40 rounded-lg p-8 bg-leather/60">
          <h1 className="font-western text-3xl text-rust mb-1 text-center">Phòng {roomId}</h1>
          <p className="text-center text-dust text-sm mb-6">Chia sẻ mã phòng này cho bạn bè (4–7 người)</p>
          <ul className="mb-6 space-y-1">
            {lobbyPlayers.map((p) => (
              <li key={p.player_id} className="px-3 py-2 rounded bg-ink/60 flex justify-between">
                <span>{p.name}</span>
                {p.player_id === playerId && <span className="text-dust text-xs">(Bạn)</span>}
              </li>
            ))}
          </ul>
          <button
            onClick={handleStart}
            disabled={lobbyPlayers.length < 4}
            className="w-full py-2 rounded bg-rust hover:bg-rust/80 font-semibold disabled:opacity-40"
          >
            {lobbyPlayers.length < 4 ? `Cần thêm ${4 - lobbyPlayers.length} người` : "Bắt đầu ván"}
          </button>
          {error && <p className="mt-3 text-sm text-rust">{error}</p>}
        </div>
      </main>
    );
  }

  if (!state || !me) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-dust font-western text-2xl animate-pulse">Đang tải ván chơi...</p>
      </main>
    );
  }

  if (state.phase === "characterSelect") {
    const chosenCount = Object.values(state.players).filter((p) => p.characterChosen).length;
    const totalCount = Object.keys(state.players).length;
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          <h1 className="font-western text-3xl text-rust text-center mb-2">Chọn nhân vật của bạn</h1>
          <p className="text-center text-dust text-sm mb-6">
            {chosenCount}/{totalCount} người đã chọn xong
          </p>

          {me.characterChosen ? (
            <div className="flex flex-col items-center text-center py-6">
              {me.character !== "Unknown" && (
                <div className="w-32 aspect-[250/389] relative rounded-lg overflow-hidden border-2 border-rust shadow-[0_0_16px_rgba(166,61,47,0.5)] mb-4 animate-card-deal-in">
                  <Image
                    src={CHARACTER_IMAGE_SRC[me.character]}
                    alt={CHARACTERS[me.character as keyof typeof CHARACTERS]?.name ?? ""}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              )}
              <p className="text-dust italic">
                Bạn đã chọn <span className="text-parchment font-semibold not-italic">{CHARACTERS[me.character as keyof typeof CHARACTERS]?.name}</span>.
                <br />
                Đang chờ những người còn lại chọn nhân vật...
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {(me.characterChoices ?? []).map((charId, i) => {
                const c = CHARACTERS[charId];
                return (
                  <button
                    key={charId}
                    onClick={() => act({ type: "CHOOSE_CHARACTER", playerId: playerId!, characterId: charId })}
                    style={{ animationDelay: `${i * 90}ms` }}
                    className="text-left rounded-lg border-2 border-dust/40 bg-leather/60 p-4 hover:border-rust hover:bg-rust/10 transition-colors flex gap-4 animate-card-deal-in"
                  >
                    <div className="w-20 aspect-[250/389] relative flex-shrink-0 rounded overflow-hidden border border-dust/40">
                      <Image src={CHARACTER_IMAGE_SRC[charId]} alt={c.name} fill className="object-cover" sizes="80px" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h2 className="font-western text-xl text-rust">{c.name}</h2>
                        <span className="text-xs text-dust whitespace-nowrap">{c.maxHp} ♥</span>
                      </div>
                      <p className="text-sm text-dust leading-relaxed">{c.ability}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <ul className="mt-8 flex flex-wrap gap-2 justify-center text-xs">
            {Object.values(state.players).map((p) => (
              <li
                key={p.id}
                className={`px-3 py-1 rounded-full border ${
                  p.characterChosen ? "border-rust/60 text-rust" : "border-dust/40 text-dust"
                }`}
              >
                {p.name} {p.characterChosen ? "✓" : "…"}
              </li>
            ))}
          </ul>

          {error && <p className="mt-4 text-sm text-rust text-center">{error}</p>}
        </div>
      </main>
    );
  }

  function cardNeedsTarget(kind: string) {
    return TARGETABLE_KINDS.has(kind);
  }

  function handleHandCardClick(cardId: string, kind: string) {
    if (discardMode) {
      toggleDiscardSelection(cardId);
      return;
    }
    if (sidMode) {
      toggleSidSelection(cardId);
      return;
    }
    if (!isMyTurn || pending) return;
    if (kind === "Saloon") {
      setPendingSaloonCardId(cardId);
      return;
    }
    if (cardNeedsTarget(kind)) {
      setSelectedCardId(cardId);
      setPendingTargetCardId(cardId);
    } else {
      animateCardPlay(cardId);
      act({ type: "PLAY_CARD", playerId: playerId!, cardId, kind: kind as ActionType extends { kind: infer K } ? K : never });
    }
  }

  // How many cards over the hand limit (limit == current HP) the player
  // needs to discard before they're allowed to end their turn.
  const handLimitExcess = me ? Math.max(0, (me.hand?.length ?? 0) - me.hp) : 0;

  function handleEndTurnClick() {
    if (handLimitExcess > 0) {
      setDiscardMode(true);
      setDiscardSelected([]);
      return;
    }
    act({ type: "END_TURN", playerId: playerId! });
  }

  function toggleDiscardSelection(cardId: string) {
    setDiscardSelected((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= handLimitExcess) return prev;
      const next = [...prev, cardId];
      if (next.length === handLimitExcess) {
        confirmDiscardExcessAndEndTurn(next);
      }
      return next;
    });
  }

  async function confirmDiscardExcessAndEndTurn(cardIds: string[]) {
    if (!playerId) return;
    setError(null);
    try {
      await sendAction(roomId, playerId, { type: "DISCARD_EXCESS", playerId, cardIds });
      const s2 = await sendAction(roomId, playerId, { type: "END_TURN", playerId });
      setState(s2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDiscardMode(false);
      setDiscardSelected([]);
    }
  }

  function toggleSidSelection(cardId: string) {
    setSidSelected((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= 2) return prev;
      const next = [...prev, cardId];
      if (next.length === 2) {
        act({ type: "USE_SID_KETCHUM", playerId: playerId!, cardIds: next });
      }
      return next;
    });
  }

  function toggleSlabSelection(cardId: string) {
    setSlabSelected((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= 2) return prev;
      return [...prev, cardId];
    });
  }

  function handleTargetClick(targetId: string) {
    if (!pendingTargetCardId || !state) return;
    const card = me!.hand!.find((c) => c.id === pendingTargetCardId);
    if (!card) return;
    const kind = selectedKindOf(card.id);

    // Cat Balou / Panic!: if the target has any visible field (equip) cards,
    // let the player choose a specific one to take/discard, or fall back to
    // a random card from the target's hidden hand.
    if (kind === "Panic" || kind === "CatBalou") {
      const targetPlayer = state.players[targetId];
      const hasFieldCards = (targetPlayer?.inPlay?.length ?? 0) > 0;
      setPendingTargetCardId(null);
      setSelectedCardId(null);
      if (hasFieldCards) {
        setPendingStealChoice({ cardId: card.id, kind, targetId });
        return;
      }
      animateCardPlay(card.id);
      act({ type: "PLAY_CARD", playerId: playerId!, cardId: card.id, kind: kind as never, targetId });
      return;
    }

    animateCardPlay(card.id);
    act({
      type: "PLAY_CARD",
      playerId: playerId!,
      cardId: card.id,
      kind: kind as never,
      targetId,
    });
  }

  function finalizeStealChoice(sourceCardId?: string) {
    if (!pendingStealChoice) return;
    animateCardPlay(pendingStealChoice.cardId);
    act({
      type: "PLAY_CARD",
      playerId: playerId!,
      cardId: pendingStealChoice.cardId,
      kind: pendingStealChoice.kind as never,
      targetId: pendingStealChoice.targetId,
      sourceCardId,
    });
    setPendingStealChoice(null);
  }

  function fireSaloon(mode: "all" | "self") {
    if (!pendingSaloonCardId) return;
    animateCardPlay(pendingSaloonCardId);
    act({ type: "PLAY_CARD", playerId: playerId!, cardId: pendingSaloonCardId, kind: "Saloon" as never, saloonMode: mode });
    setPendingSaloonCardId(null);
  }

  function selectedKindOf(cardId: string): string {
    return kindOfCardId(cardId) ?? "Bang";
  }

  const canUseSidKetchum =
    me.character === "SidKetchum" &&
    isMyTurn &&
    !pending &&
    !discardMode &&
    state.phase === "play" &&
    me.hp < me.maxHp &&
    (me.hand?.length ?? 0) >= 2;

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <h1 className="font-western text-3xl text-rust">BANG! — Phòng {roomId}</h1>
          <div className="flex items-center gap-2">
            {canUseSidKetchum && !sidMode && (
              <button
                onClick={() => setSidMode(true)}
                className="px-3 py-2 rounded border border-dust/60 hover:border-rust text-sm"
                title="Bỏ 2 lá bất kỳ trên tay để hồi 1 máu"
              >
                Sid Ketchum: hồi máu
              </button>
            )}
            {sidMode && (
              <button
                onClick={() => {
                  setSidMode(false);
                  setSidSelected([]);
                }}
                className="px-3 py-2 rounded border border-dust/60 text-sm"
              >
                Hủy ({sidSelected.length}/2)
              </button>
            )}
            {discardMode && (
              <span className="px-3 py-2 rounded border border-rust text-sm text-rust">
                Chọn {handLimitExcess} lá để bỏ ({discardSelected.length}/{handLimitExcess})
              </span>
            )}
            {discardMode && (
              <button
                onClick={() => {
                  setDiscardMode(false);
                  setDiscardSelected([]);
                }}
                className="px-3 py-2 rounded border border-dust/60 text-sm"
              >
                Hủy
              </button>
            )}
            {isMyTurn && !pending && !sidMode && !discardMode && (
              <button
                onClick={handleEndTurnClick}
                className="px-4 py-2 rounded bg-rust hover:bg-rust/80 font-semibold"
              >
                Kết thúc lượt
              </button>
            )}
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-4 items-center justify-between text-sm bg-ink/40 p-3 rounded border border-dust/20">
          <div>
            <span className="text-dust">Lượt chơi: </span>
            <span className={`font-semibold ${isMyTurn ? "text-rust animate-pulse" : "text-parchment"}`}>
              {isMyTurn ? "Lượt của BẠN! (Hãy đánh bài)" : `Lượt của ${state.players[state.currentPlayerId!]?.name ?? "..."}`}
            </span>
          </div>
          <div>
            <span className="text-dust">Vai trò của bạn: </span>
            <span className="font-semibold text-rust">{ROLE_LABEL[me.role] ?? me.role}</span>
          </div>
        </div>

        {error && <div className="mb-4 px-4 py-2 rounded bg-rust/20 border border-rust text-sm">{error}</div>}

        {state.winner && (
          <div className="mb-6 px-4 py-3 rounded bg-rust/30 border-2 border-rust text-center font-western text-2xl">
            {state.winner === "Sheriff" ? "Sheriff & Deputy thắng!" : `${state.winner} thắng!`}
          </div>
        )}

        {/* Round table: other players seated around the edge, deck + discard
            pile (and any judge-draw reveal) in the center. */}
        <div className="relative w-full mx-auto mb-6" style={{ aspectRatio: "16 / 10", maxWidth: 880 }}>
          <div className="absolute inset-[9%] rounded-[50%] bg-ink/50 border-4 border-dust/20 shadow-[inset_0_0_50px_rgba(0,0,0,0.55)]" />

          <div className="absolute inset-0 flex items-center justify-center">
            <DeckPile
              deckCount={state.deckCount}
              discardPile={state.discardPile}
              discardRef={discardPileElRef}
              onDiscardClick={() => setShowHistory(true)}
            />
          </div>

          {others.map((p, i) => {
            const distance = effectiveDistance(state, playerId!, p.id);
            const inRange = isInRange(state, playerId!, p.id);
            const style = otherSeatStyle(i, others.length);
            return (
              <div
                key={p.id}
                ref={(el) => registerSeatEl(p.id, el)}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={style}
              >
                <PlayerSeat
                  player={p}
                  isMe={false}
                  isCurrentTurn={state.currentPlayerId === p.id}
                  isTargetable={!!pendingTargetCardId}
                  onTargetClick={() => handleTargetClick(p.id)}
                  onInfoClick={() => setInfoPlayerId(p.id)}
                  distance={distance}
                  inRange={inRange}
                />
              </div>
            );
          })}

          <JudgeDrawReveal
            event={state.lastJudgeDraw}
            playerName={state.lastJudgeDraw ? state.players[state.lastJudgeDraw.playerId]?.name : undefined}
          />
        </div>

        {/* Saloon: choose to heal everyone (official rule) or only myself */}
        {pendingSaloonCardId && (
          <div className="mb-4 p-4 rounded bg-rust/20 border border-rust flex items-center gap-3 flex-wrap">
            <span>Saloon: hồi máu cho ai?</span>
            <button
              onClick={() => fireSaloon("all")}
              className="px-3 py-1 rounded bg-parchment text-ink font-semibold"
            >
              Hồi máu cho tất cả (đúng luật)
            </button>
            <button
              onClick={() => fireSaloon("self")}
              className="px-3 py-1 rounded border border-dust/60 hover:border-rust"
            >
              Chỉ hồi máu cho mình
            </button>
            <button
              onClick={() => setPendingSaloonCardId(null)}
              className="px-3 py-1 rounded border border-dust/40 text-dust"
            >
              Hủy
            </button>
          </div>
        )}

        {/* Cat Balou / Panic!: choose a specific field card of the target,
            or draw a random card from their hidden hand. */}
        {pendingStealChoice && (
          <div className="mb-4 p-4 rounded bg-rust/20 border border-rust">
            <p className="mb-2">
              {pendingStealChoice.kind === "Panic" ? "Panic!" : "Cat Balou"}: chọn 1 lá cụ thể trên sân của{" "}
              {state.players[pendingStealChoice.targetId]?.name}, hoặc {pendingStealChoice.kind === "Panic" ? "lấy" : "bỏ"}{" "}
              ngẫu nhiên 1 lá trên tay họ.
            </p>
            <div className="flex gap-2 flex-wrap mb-2">
              {(state.players[pendingStealChoice.targetId]?.inPlay ?? []).map((c) => {
                const kind = kindOfCardId(c.id);
                const label = kind ? CARD_DEFS[kind].label : "?";
                return (
                  <CardFace
                    key={c.id}
                    card={c}
                    label={label}
                    kind={kind}
                    small
                    onClick={() => finalizeStealChoice(c.id)}
                  />
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                disabled={(state.players[pendingStealChoice.targetId]?.handCount ?? 0) === 0}
                onClick={() => finalizeStealChoice(undefined)}
                className="px-3 py-1 rounded bg-parchment text-ink font-semibold disabled:opacity-40"
              >
                {pendingStealChoice.kind === "Panic" ? "Lấy" : "Bỏ"} ngẫu nhiên trên tay (
                {state.players[pendingStealChoice.targetId]?.handCount ?? 0} lá)
              </button>
              <button
                onClick={() => setPendingStealChoice(null)}
                className="px-3 py-1 rounded border border-dust/40 text-dust"
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* Pending response banner */}
        {pending && isMyResponse && (
          <ResponsePanel
            pending={pending}
            me={me}
            state={state}
            act={act}
            playerId={playerId!}
            slabSelected={slabSelected}
            onToggleSlab={toggleSlabSelection}
            kitSelected={kitSelected}
            onToggleKit={(id) =>
              setKitSelected((prev) => {
                if (prev.includes(id)) return prev.filter((x) => x !== id);
                if (prev.length >= 2) return prev;
                return [...prev, id];
              })
            }
          />
        )}
        {pending && !isMyResponse && (
          <div className="mb-4 text-dust text-sm italic">
            Đang chờ {state.players[pending.targetPlayerId]?.name} phản hồi...
          </div>
        )}

        {/* Log */}
        <div className="mb-6 h-28 overflow-y-auto text-xs text-dust bg-ink/40 rounded p-3 space-y-0.5">
          {state.log.slice(-30).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>

        {/* My seat + hand */}
        <div className="border-t-2 border-dust/30 pt-4">
          <div ref={(el) => registerSeatEl(me.id, el)}>
            <PlayerSeat player={me} isMe isCurrentTurn={isMyTurn} onInfoClick={() => setInfoPlayerId(me.id)} />
          </div>
          {sidMode && (
            <p className="mt-3 text-sm text-rust italic">Chọn 2 lá bất kỳ trên tay để bỏ, hồi 1 máu (Sid Ketchum).</p>
          )}
          {discardMode && (
            <p className="mt-3 text-sm text-rust italic">
              Tay đang có {me.hand?.length ?? 0} lá, giới hạn là {me.hp} (bằng máu hiện tại). Chọn {handLimitExcess} lá để
              bỏ trước khi kết thúc lượt.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {me.hand?.map((c) => {
              const kind = selectedKindOf(c.id);
              const def = CARD_DEFS[kind as keyof typeof CARD_DEFS];
              const animationClassName =
                c.id === leavingCardId
                  ? "animate-card-play-out"
                  : justDrawnIds.has(c.id)
                  ? "animate-card-deal-in"
                  : undefined;
              const isSidSelected = sidMode && sidSelected.includes(c.id);
              const isDiscardSelected = discardMode && discardSelected.includes(c.id);
              return (
                <div key={c.id} className={isSidSelected || isDiscardSelected ? "ring-2 ring-rust rounded-md" : undefined}>
                  <CardFace
                    card={c}
                    label={def?.label ?? "?"}
                    kind={kindOfCardId(c.id)}
                    selected={selectedCardId === c.id || isSidSelected || isDiscardSelected}
                    onClick={() => handleHandCardClick(c.id, kind)}
                    animationClassName={animationClassName}
                  />
                </div>
              );
            })}
          </div>
          {pendingTargetCardId && (
            <p className="mt-2 text-sm text-dust italic">Chọn một người chơi để nhắm mục tiêu ở trên...</p>
          )}
        </div>
      </div>

      {infoPlayerId && state.players[infoPlayerId] && (
        <CharacterModal
          player={state.players[infoPlayerId]}
          isMe={infoPlayerId === playerId}
          onClose={() => setInfoPlayerId(null)}
        />
      )}

      {showHistory && (
        <DiscardHistoryModal discardPile={state.discardPile} onClose={() => setShowHistory(false)} />
      )}

      {flight && (
        <FlyingCard
          key={flight.id}
          card={flight.card}
          kind={flight.kind as never}
          label={flight.label}
          from={flight.from}
          to={flight.to}
          onDone={() => setFlight(null)}
        />
      )}
    </main>
  );
}

function ResponsePanel({
  pending,
  me,
  state,
  act,
  playerId,
  slabSelected,
  onToggleSlab,
  kitSelected,
  onToggleKit,
}: {
  pending: NonNullable<RedactedGameState["pendingResponse"]>;
  me: RedactedGameState["players"][string];
  state: RedactedGameState;
  act: (a: ActionType) => void;
  playerId: string;
  slabSelected: string[];
  onToggleSlab: (id: string) => void;
  kitSelected: string[];
  onToggleKit: (id: string) => void;
}) {
  if (pending.kind === "BangResponse") {
    const shooter = state.players[pending.fromPlayerId];
    const requiredCount = shooter?.character === "SlabTheKiller" ? 2 : 1;
    const dodgeCards = (me.hand ?? []).filter((c) => {
      const k = kindOfCardId(c.id);
      return k === "Missed" || (me.character === "CalamityJanet" && k === "Bang");
    });
    const hasBarrel = (me.inPlay ?? []).some((c) => kindOfCardId(c.id) === "Barrel") || me.character === "JohnnyKisch";
    const canTryBarrel = hasBarrel && !pending.data?.barrelAttempted;

    if (requiredCount === 2) {
      return (
        <div className="mb-4 p-4 rounded bg-rust/20 border border-rust">
          <p className="mb-2">
            Bạn bị {shooter?.name} (Slab the Killer) bắn! Cần <b>2</b> lá Missed! để né.
          </p>
          <div className="flex gap-2 flex-wrap mb-2">
            {dodgeCards.map((c) => {
              const kind = kindOfCardId(c.id);
              const label = kind ? CARD_DEFS[kind].label : "?";
              return (
                <CardFace
                  key={c.id}
                  card={c}
                  label={label}
                  kind={kind}
                  small
                  selected={slabSelected.includes(c.id)}
                  onClick={() => onToggleSlab(c.id)}
                />
              );
            })}
          </div>
          <div className="flex gap-2">
            {canTryBarrel && (
              <button
                onClick={() => act({ type: "ATTEMPT_BARREL", playerId })}
                className="px-3 py-1 rounded border border-dust/60 hover:border-rust"
              >
                Thử Barrel
              </button>
            )}
            <button
              disabled={slabSelected.length !== 2}
              onClick={() => act({ type: "RESPOND_MISSED", playerId, cardId: null, cardIds: slabSelected })}
              className="px-3 py-1 rounded bg-parchment text-ink font-semibold disabled:opacity-40"
            >
              Dùng 2 Missed! đã chọn
            </button>
            <button
              onClick={() => act({ type: "RESPOND_MISSED", playerId, cardId: null })}
              className="px-3 py-1 rounded border border-dust/60"
            >
              Chịu 1 máu
            </button>
          </div>
        </div>
      );
    }

    const missed = dodgeCards[0];
    return (
      <div className="mb-4 p-4 rounded bg-rust/20 border border-rust flex items-center gap-3 flex-wrap">
        <span>Bạn bị bắn! Dùng Missed! để né, hoặc chịu trận.</span>
        {canTryBarrel && (
          <button
            onClick={() => act({ type: "ATTEMPT_BARREL", playerId })}
            className="px-3 py-1 rounded border border-dust/60 hover:border-rust"
          >
            Thử Barrel
          </button>
        )}
        {missed && (
          <button
            onClick={() => act({ type: "RESPOND_MISSED", playerId, cardId: missed.id })}
            className="px-3 py-1 rounded bg-parchment text-ink font-semibold"
          >
            Dùng Missed!
          </button>
        )}
        <button
          onClick={() => act({ type: "RESPOND_MISSED", playerId, cardId: null })}
          className="px-3 py-1 rounded border border-dust/60"
        >
          Chịu 1 máu
        </button>
      </div>
    );
  }

  if (pending.kind === "GatlingResponse") {
    const missed = (me.hand ?? []).find((c) => {
      const k = kindOfCardId(c.id);
      return k === "Missed" || (me.character === "CalamityJanet" && k === "Bang");
    });
    return (
      <div className="mb-4 p-4 rounded bg-rust/20 border border-rust flex items-center gap-3">
        <span>Trúng Gatling! Dùng Missed! để né, hoặc chịu trận.</span>
        {missed && (
          <button
            onClick={() => act({ type: "RESPOND_GATLING", playerId, cardId: missed.id })}
            className="px-3 py-1 rounded bg-parchment text-ink font-semibold"
          >
            Dùng Missed!
          </button>
        )}
        <button
          onClick={() => act({ type: "RESPOND_GATLING", playerId, cardId: null })}
          className="px-3 py-1 rounded border border-dust/60"
        >
          Chịu 1 máu
        </button>
      </div>
    );
  }

  if (pending.kind === "DuelResponse") {
    const bang = (me.hand ?? []).find((c) => {
      const k = kindOfCardId(c.id);
      return k === "Bang" || (me.character === "CalamityJanet" && k === "Missed");
    });
    return (
      <div className="mb-4 p-4 rounded bg-rust/20 border border-rust flex items-center gap-3">
        <span>Duel! Đánh Bang! để tiếp tục, hoặc chịu thua.</span>
        {bang && (
          <button
            onClick={() => act({ type: "RESPOND_DUEL", playerId, cardId: bang.id })}
            className="px-3 py-1 rounded bg-parchment text-ink font-semibold"
          >
            Đánh Bang!
          </button>
        )}
        <button
          onClick={() => act({ type: "RESPOND_DUEL", playerId, cardId: null })}
          className="px-3 py-1 rounded border border-dust/60"
        >
          Chịu thua
        </button>
      </div>
    );
  }

  if (pending.kind === "IndiansResponse") {
    const bang = (me.hand ?? []).find((c) => {
      const k = kindOfCardId(c.id);
      return k === "Bang" || (me.character === "CalamityJanet" && k === "Missed");
    });
    return (
      <div className="mb-4 p-4 rounded bg-rust/20 border border-rust flex items-center gap-3">
        <span>Indians! Bỏ Bang! hoặc mất 1 máu.</span>
        {bang && (
          <button
            onClick={() => act({ type: "RESPOND_INDIANS", playerId, cardId: bang.id })}
            className="px-3 py-1 rounded bg-parchment text-ink font-semibold"
          >
            Bỏ Bang!
          </button>
        )}
        <button
          onClick={() => act({ type: "RESPOND_INDIANS", playerId, cardId: null })}
          className="px-3 py-1 rounded border border-dust/60"
        >
          Chịu 1 máu
        </button>
      </div>
    );
  }

  if (pending.kind === "JesseDrawChoice") {
    const others = Object.values(state.players).filter((p) => p.isAlive && p.id !== playerId && p.handCount > 0);
    return (
      <div className="mb-4 p-4 rounded bg-rust/20 border border-rust">
        <p className="mb-2">Jesse Jones: rút lá đầu tiên từ tay 1 người khác, hoặc rút bình thường.</p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => act({ type: "CHOOSE_JESSE_DRAW", playerId })}
            className="px-3 py-1 rounded border border-dust/60 hover:border-rust"
          >
            Rút 2 lá từ bộ bài
          </button>
          {others.map((p) => (
            <button
              key={p.id}
              onClick={() => act({ type: "CHOOSE_JESSE_DRAW", playerId, targetId: p.id })}
              className="px-3 py-1 rounded bg-parchment text-ink font-semibold"
            >
              Lấy 1 lá từ {p.name} + rút 1
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (pending.kind === "PedroDrawChoice") {
    return (
      <div className="mb-4 p-4 rounded bg-rust/20 border border-rust">
        <p className="mb-2">Pedro Ramirez: lấy lá trên nóc chồng bỏ, hoặc rút bình thường.</p>
        <div className="flex gap-2">
          <button
            onClick={() => act({ type: "CHOOSE_PEDRO_DRAW", playerId, useDiscard: true })}
            className="px-3 py-1 rounded bg-parchment text-ink font-semibold"
          >
            Lấy lá trên nóc chồng bỏ + rút 1
          </button>
          <button
            onClick={() => act({ type: "CHOOSE_PEDRO_DRAW", playerId, useDiscard: false })}
            className="px-3 py-1 rounded border border-dust/60 hover:border-rust"
          >
            Rút 2 lá từ bộ bài
          </button>
        </div>
      </div>
    );
  }

  if (pending.kind === "KitCarlsonDraw") {
    const pool = (pending.data?.pool as { id: string; suit: string; rank: string }[]) ?? [];
    return (
      <div className="mb-4 p-4 rounded bg-rust/20 border border-rust">
        <p className="mb-2">Kit Carlson: chọn 2 trong 3 lá để giữ lại ({kitSelected.length}/2).</p>
        <div className="flex gap-2 flex-wrap mb-2">
          {pool.map((c) => {
            const kind = kindOfCardId(c.id);
            const def = kind ? CARD_DEFS[kind] : undefined;
            return (
              <CardFace
                key={c.id}
                card={c as never}
                label={def?.label ?? kind ?? "?"}
                kind={kind}
                small
                selected={kitSelected.includes(c.id)}
                onClick={() => onToggleKit(c.id)}
              />
            );
          })}
        </div>
        <button
          disabled={kitSelected.length !== 2}
          onClick={() => act({ type: "CHOOSE_KIT_CARLSON", playerId, keepCardIds: kitSelected })}
          className="px-3 py-1 rounded bg-parchment text-ink font-semibold disabled:opacity-40"
        >
          Xác nhận giữ 2 lá đã chọn
        </button>
      </div>
    );
  }

  if (pending.kind === "GeneralStoreDraw") {
    const pool = (pending.data?.pool as { id: string; suit: string; rank: string }[]) ?? [];
    return (
      <div className="mb-4 p-4 rounded bg-rust/20 border border-rust">
        <p className="mb-2">General Store! Chọn 1 lá:</p>
        <div className="flex gap-2 flex-wrap">
          {pool.map((c) => {
            const kind = kindOfCardId(c.id);
            const def = kind ? CARD_DEFS[kind] : undefined;
            return (
              <CardFace
                key={c.id}
                card={c as never}
                label={def?.label ?? kind ?? "?"}
                kind={kind}
                small
                onClick={() => act({ type: "GENERAL_STORE_PICK", playerId, cardId: c.id })}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
