"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { fetchState, joinRoom, sendAction, startGame } from "@/lib/api";
import { RedactedGameState } from "@/lib/types";
import { CARD_DEFS, kindOfCardId } from "@/lib/data/cards";
import Image from "next/image";
import { CHARACTER_IMAGE_SRC } from "@/lib/data/characters";
import { CardFace } from "@/components/CardView";
import { PlayerSeat, ROLE_LABEL } from "@/components/PlayerSeat";
import { CharacterModal } from "@/components/CharacterModal";
import { CHARACTERS } from "@/lib/data/characters";
import { ActionType } from "@/lib/actions";
import { effectiveDistance, isInRange } from "@/lib/gameEngine";

interface LobbyPlayer {
  player_id: string;
  name: string;
  seat: number;
}

const TARGETABLE_KINDS = new Set(["Bang", "Panic", "CatBalou", "Duel", "Jail"]);

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
    } catch (e) {
      setError((e as Error).message);
    }
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
            <div className="text-center text-dust italic py-10">
              Bạn đã chọn <span className="text-parchment font-semibold">{CHARACTERS[me.character as keyof typeof CHARACTERS]?.name}</span>.
              <br />
              Đang chờ những người còn lại chọn nhân vật...
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
                {(me.characterChoices ?? []).map((charId) => {
                                const c = CHARACTERS[charId];
                                const imgSrc = CHARACTER_IMAGE_SRC[charId];
                                return (
                                  <button
                                    key={charId}
                                    onClick={() => act({ type: "CHOOSE_CHARACTER", playerId: playerId!, characterId: charId })}
                                    className="text-left rounded-lg border-2 border-dust/40 bg-leather/60 p-5 hover:border-rust hover:bg-rust/10 transition-colors flex gap-4"
                                  >
                                    {imgSrc && (
                                      <div className="w-20 aspect-[250/389] relative flex-shrink-0 rounded-md overflow-hidden border border-dust/30">
                                        <Image src={imgSrc} alt={c.name} fill className="object-cover" sizes="80px" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="flex items-center justify-between mb-2 gap-2">
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
    if (!isMyTurn || pending) return;
    if (cardNeedsTarget(kind)) {
      setSelectedCardId(cardId);
      setPendingTargetCardId(cardId);
    } else {
      act({ type: "PLAY_CARD", playerId: playerId!, cardId, kind: kind as ActionType extends { kind: infer K } ? K : never });
    }
  }

  function handleTargetClick(targetId: string) {
    if (!pendingTargetCardId || !state) return;
    const card = me!.hand!.find((c) => c.id === pendingTargetCardId);
    if (!card) return;
    act({
      type: "PLAY_CARD",
      playerId: playerId!,
      cardId: card.id,
      kind: selectedKindOf(card.id) as never,
      targetId,
    });
  }

  function selectedKindOf(cardId: string): string {
    return kindOfCardId(cardId) ?? "Bang";
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <h1 className="font-western text-3xl text-rust">BANG! — Phòng {roomId}</h1>
          {isMyTurn && !pending && (
            <button
              onClick={() => act({ type: "END_TURN", playerId: playerId! })}
              className="px-4 py-2 rounded bg-rust hover:bg-rust/80 font-semibold"
            >
              Kết thúc lượt
            </button>
          )}
        </header>

        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between text-sm bg-ink/40 p-3 rounded border border-dust/20">
          <div>
            <span className="text-dust">Lượt chơi: </span>
            <span className={`font-semibold ${isMyTurn ? "text-rust animate-pulse" : "text-parchment"}`}>
              {isMyTurn ? "Lượt của BẠN! (Hãy đánh bài)" : `Lượt của ${state.players[state.currentPlayerId!]?.name ?? "..."}`}
            </span>
          </div>
          <div>
            <span className="text-dust">Vai trò của bạn: </span>
            <span className="font-semibold text-rust">
              {ROLE_LABEL[me.role] ?? me.role}
            </span>
          </div>
        </div>

        {error && <div className="mb-4 px-4 py-2 rounded bg-rust/20 border border-rust text-sm">{error}</div>}

        {state.winner && (
          <div className="mb-6 px-4 py-3 rounded bg-rust/30 border-2 border-rust text-center font-western text-2xl">
            {state.winner === "Sheriff" ? "Sheriff & Deputy thắng!" : `${state.winner} thắng!`}
          </div>
        )}

        {/* Other players */}
        <div className="flex flex-wrap gap-3 mb-6">
          {others.map((p) => {
            const distance = state && playerId ? effectiveDistance(state, playerId, p.id) : undefined;
            const inRange = state && playerId ? isInRange(state, playerId, p.id) : false;
            return (
              <PlayerSeat
                key={p.id}
                player={p}
                isMe={false}
                isCurrentTurn={state.currentPlayerId === p.id}
                isTargetable={!!pendingTargetCardId}
                onTargetClick={() => handleTargetClick(p.id)}
                onInfoClick={() => setInfoPlayerId(p.id)}
                distance={distance}
                inRange={inRange}
              />
            );
          })}
        </div>

        {/* Pending response banner */}
        {pending && isMyResponse && (
          <ResponsePanel pending={pending} me={me} act={act} playerId={playerId!} />
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
          <PlayerSeat player={me} isMe isCurrentTurn={isMyTurn} onInfoClick={() => setInfoPlayerId(me.id)} />
          <div className="mt-4 flex flex-wrap gap-2">
            {me.hand?.map((c) => {
              const kind = selectedKindOf(c.id);
              const def = CARD_DEFS[kind as keyof typeof CARD_DEFS];
              return (
                <CardFace
                  key={c.id}
                  card={c}
                  label={def?.label ?? "?"}
                  kind={kindOfCardId(c.id)}
                  selected={selectedCardId === c.id}
                  onClick={() => handleHandCardClick(c.id, kind)}
                />
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
    </main>
  );
}

function ResponsePanel({
  pending,
  me,
  act,
  playerId,
}: {
  pending: NonNullable<RedactedGameState["pendingResponse"]>;
  me: RedactedGameState["players"][string];
  act: (a: ActionType) => void;
  playerId: string;
}) {
  if (pending.kind === "BangResponse") {
    const missed = me.hand?.find((c) => kindOfCardId(c.id) === "Missed");
    return (
      <div className="mb-4 p-4 rounded bg-rust/20 border border-rust flex items-center gap-3">
        <span>Bạn bị bắn! Dùng Missed! để né, hoặc chịu trận.</span>
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

  if (pending.kind === "DuelResponse") {
    const bang = me.hand?.find((c) => kindOfCardId(c.id) === "Bang");
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
    const bang = me.hand?.find((c) => kindOfCardId(c.id) === "Bang");
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
