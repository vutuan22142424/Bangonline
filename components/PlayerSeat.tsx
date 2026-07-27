import Image from "next/image";
import { PlayerHandView } from "@/lib/types";
import { CardFace } from "./CardView";
import { CHARACTERS, CHARACTER_IMAGE_SRC } from "@/lib/data/characters";
import { CARD_DEFS } from "@/lib/data/cards";
import { kindOfCardId } from "@/lib/data/cards";

export const ROLE_LABEL: Record<string, string> = {
  Sheriff: "Cảnh sát trưởng",
  Deputy: "Phó cảnh sát trưởng",
  Outlaw: "Cướp",
  Renegade: "Kẻ 2 mặt",
  Unknown: "???",
};

export function PlayerSeat({
  player,
  isMe,
  isCurrentTurn,
  isTargetable,
  onTargetClick,
  onInfoClick,
  distance,
  inRange,
}: {
  player: PlayerHandView;
  isMe: boolean;
  isCurrentTurn: boolean;
  isTargetable?: boolean;
  onTargetClick?: () => void;
  onInfoClick?: () => void;
  distance?: number;
  inRange?: boolean;
}) {
  const character = player.character !== "Unknown" ? CHARACTERS[player.character] : null;
  const portraitSrc = player.character !== "Unknown" ? CHARACTER_IMAGE_SRC[player.character] : undefined;

  function handleClick() {
    if (isTargetable) {
      onTargetClick?.();
    } else {
      onInfoClick?.();
    }
  }

  return (
    <div
      onClick={handleClick}
      title={isTargetable ? undefined : "Bấm để xem thông tin nhân vật"}
      className={`rounded-lg border-2 p-3 bg-leather/50 min-w-[190px] transition-all cursor-pointer ${
        isCurrentTurn ? "border-rust shadow-[0_0_12px_rgba(166,61,47,0.6)]" : "border-dust/30"
      } ${!player.isAlive ? "opacity-40 grayscale" : ""} ${
        isTargetable
          ? "cursor-crosshair border-rust/80 animate-pulse shadow-[0_0_8px_rgba(166,61,47,0.4)] bg-rust/5"
          : "hover:border-dust/60"
      }`}
    >
      <div className="flex gap-2 mb-1">
        {portraitSrc && (
          <div className="w-10 aspect-[250/389] relative flex-shrink-0 rounded overflow-hidden border border-dust/30">
            <Image src={portraitSrc} alt={character?.name ?? ""} fill className="object-cover" sizes="40px" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm truncate">{player.name}{isMe ? " (Bạn)" : ""}</span>
            {player.isSheriff && <span title="Sheriff">⭐</span>}
          </div>
          <div className="text-xs text-dust mb-1 truncate">{character ? character.name : "Đang chọn nhân vật..."}</div>
          <div className="text-xs mb-2">{ROLE_LABEL[player.role] ?? player.role}</div>
        </div>
      </div>
      <div className="flex gap-1 mb-2">
        {Array.from({ length: player.maxHp }).map((_, i) => (
          <span key={i} className={i < player.hp ? "text-rust" : "text-dust/30"}>
            ♥
          </span>
        ))}
      </div>
      <div className="flex gap-1 flex-wrap mb-1">
        {player.inPlay.map((c) => {
          const kind = kindOfCardId(c.id);
          return (
            <div key={c.id} title={kind ? CARD_DEFS[kind].label : ""}>
              <CardFace card={c} label={kind ? CARD_DEFS[kind].label : "?"} kind={kind} small />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-center text-xs text-dust mt-2">
        <span>{player.handCount} lá trên tay</span>
        {!isMe && distance !== undefined && (
          <span className={inRange ? "text-rust font-semibold" : "text-dust/60"}>
            KC: {distance} {inRange ? "🎯" : ""}
          </span>
        )}
      </div>
    </div>
  );
}