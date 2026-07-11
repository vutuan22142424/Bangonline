"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom } from "@/lib/api";

export default function LobbyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return setError("Nhập tên của bạn trước đã.");
    setLoading(true);
    setError(null);
    try {
      const { roomId, playerId } = await createRoom(name.trim());
      sessionStorage.setItem(`bang_playerId_${roomId}`, playerId);
      router.push(`/room/${roomId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError("Nhập tên của bạn trước đã.");
    if (!roomCode.trim()) return setError("Nhập mã phòng.");
    setLoading(true);
    setError(null);
    try {
      const code = roomCode.trim().toUpperCase();
      const { roomId, playerId } = await joinRoom(code, name.trim());
      sessionStorage.setItem(`bang_playerId_${roomId}`, playerId);
      router.push(`/room/${roomId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md border-2 border-dust/40 rounded-lg p-8 bg-leather/60 shadow-2xl">
        <h1 className="font-western text-5xl text-center text-rust mb-1 tracking-wide">BANG!</h1>
        <p className="text-center text-dust text-sm mb-8">Miền Viễn Tây đang chờ bạn</p>

        <label className="block text-sm mb-1 text-dust">Tên của bạn</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Long"
          className="w-full mb-5 px-3 py-2 rounded bg-ink border border-dust/40 text-parchment placeholder:text-dust/50 focus:outline-none focus:ring-2 focus:ring-rust"
          suppressHydrationWarning
        />

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full mb-6 py-2 rounded bg-rust hover:bg-rust/80 transition-colors font-semibold disabled:opacity-50"
        >
          Tạo phòng mới
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-dust/30" />
          <span className="text-dust text-xs">HOẶC</span>
          <div className="h-px flex-1 bg-dust/30" />
        </div>

        <label className="block text-sm mb-1 text-dust">Mã phòng</label>
        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          placeholder="VD: A1B2C3"
          className="w-full mb-5 px-3 py-2 rounded bg-ink border border-dust/40 text-parchment placeholder:text-dust/50 focus:outline-none focus:ring-2 focus:ring-rust uppercase"
          suppressHydrationWarning
        />
        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full py-2 rounded border border-dust/60 hover:bg-dust/10 transition-colors font-semibold disabled:opacity-50"
        >
          Tham gia phòng
        </button>

        {error && <p className="mt-4 text-sm text-rust">{error}</p>}
      </div>
    </main>
  );
}
