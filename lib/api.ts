import { ActionType } from "./actions";
import { RedactedGameState } from "./types";

async function jsonOrThrow(res: Response) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra.");
  return data;
}

export async function createRoom(hostName: string): Promise<{ roomId: string; playerId: string }> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostName }),
  });
  return jsonOrThrow(res);
}

export async function joinRoom(roomId: string, name: string): Promise<{ roomId: string; playerId: string }> {
  const res = await fetch(`/api/rooms/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow(res);
}

export async function startGame(roomId: string): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}/start`, { method: "POST" });
  await jsonOrThrow(res);
}

export async function fetchState(roomId: string, playerId: string): Promise<RedactedGameState> {
  const res = await fetch(`/api/rooms/${roomId}/state?playerId=${playerId}`, { cache: "no-store" });
  return jsonOrThrow(res);
}

export async function sendAction(roomId: string, playerId: string, action: ActionType): Promise<RedactedGameState> {
  const res = await fetch(`/api/rooms/${roomId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, action }),
  });
  return jsonOrThrow(res);
}
