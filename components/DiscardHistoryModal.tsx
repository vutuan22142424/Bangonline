import { PlayingCard } from "@/lib/types";
import { CARD_DEFS, kindOfCardId } from "@/lib/data/cards";
import { CardFace } from "./CardView";

export function DiscardHistoryModal({
  discardPile,
  onClose,
}: {
  discardPile: PlayingCard[];
  onClose: () => void;
}) {
  // Most recently discarded card first.
  const ordered = [...discardPile].reverse();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-leather/95 border-2 border-dust/40 rounded-lg p-5 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-western text-2xl text-rust">
            Lịch sử bài đã bỏ {discardPile.length > 0 ? `(${discardPile.length})` : ""}
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded border border-dust/60 hover:border-rust text-sm"
          >
            Đóng
          </button>
        </div>

        {ordered.length === 0 ? (
          <p className="text-dust text-sm italic">Chưa có lá nào bị bỏ.</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {ordered.map((c, i) => {
              const kind = kindOfCardId(c.id);
              const label = kind ? CARD_DEFS[kind].label : "?";
              return (
                <div key={c.id} className="flex flex-col items-center gap-1">
                  <CardFace card={c} label={label} kind={kind} small />
                  {i === 0 && <span className="text-[10px] text-rust">Mới nhất</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
