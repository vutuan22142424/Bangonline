import { PlayerHandView } from "@/lib/types";
import { CHARACTERS } from "@/lib/data/characters";
import { ROLE_LABEL } from "./PlayerSeat";

export function CharacterModal({
  player,
  isMe,
  onClose,
}: {
  player: PlayerHandView;
  isMe: boolean;
  onClose: () => void;
}) {
  const character = player.character !== "Unknown" ? CHARACTERS[player.character] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border-2 border-dust/40 bg-leather/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-western text-2xl text-rust leading-tight">
              {player.name}
              {isMe ? " (Bạn)" : ""}
            </h2>
            <p className="text-dust text-xs mt-0.5">
              {ROLE_LABEL[player.role] ?? player.role}
              {player.isSheriff && " · ⭐ Sheriff"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-dust hover:text-parchment text-xl leading-none px-1"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <div className="flex gap-1 mb-1">
            {Array.from({ length: player.maxHp }).map((_, i) => (
              <span key={i} className={`text-lg ${i < player.hp ? "text-rust" : "text-dust/30"}`}>
                ♥
              </span>
            ))}
          </div>
          <p className="text-xs text-dust">
            {player.hp} / {player.maxHp} máu
          </p>
        </div>

        {character ? (
          <div className="rounded border border-dust/30 bg-ink/40 p-4">
            <h3 className="font-semibold text-parchment mb-1">{character.name}</h3>
            <p className="text-sm text-dust leading-relaxed">{character.ability}</p>
          </div>
        ) : (
          <div className="rounded border border-dust/30 bg-ink/40 p-4 text-sm text-dust italic">
            {player.isAlive
              ? "Người chơi này chưa chọn xong nhân vật."
              : "Đã bị hạ gục trước khi lộ nhân vật."}
          </div>
        )}

        {!player.isAlive && (
          <p className="mt-3 text-xs text-rust font-semibold">☠ Đã bị hạ gục</p>
        )}
      </div>
    </div>
  );
}
