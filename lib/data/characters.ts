import { CharacterDef, CharacterId, RoleName } from "../types";

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  WillyTheKid: { id: "WillyTheKid", name: "Willy the Kid", maxHp: 4, ability: "Được đánh bao nhiêu lá Bang! cũng được trong 1 lượt." },
  CalamityJanet: { id: "CalamityJanet", name: "Calamity Janet", maxHp: 4, ability: "Có thể dùng Missed! như Bang! và ngược lại." },
  BartCassidy: { id: "BartCassidy", name: "Bart Cassidy", maxHp: 4, ability: "Mỗi lần mất máu, rút thêm 1 lá bài." },
  BlackJack: { id: "BlackJack", name: "Black Jack", maxHp: 4, ability: "Khi rút lá thứ 2 lúc đầu lượt, nếu là Cơ/Rô thì lật thêm và được rút thêm." },
  ElGringo: { id: "ElGringo", name: "El Gringo", maxHp: 3, ability: "Khi bị đánh mất máu, rút ngẫu nhiên 1 lá từ tay người đánh mình." },
  JesseJones: { id: "JesseJones", name: "Jesse Jones", maxHp: 4, ability: "Lá đầu tiên đầu lượt có thể rút từ tay 1 người khác thay vì bốc từ chồng bài." },
  JourdonaisPed: { id: "JourdonaisPed", name: "Pedro Ramirez", maxHp: 4, ability: "Lá đầu tiên đầu lượt có thể lấy từ nóc chồng bỏ thay vì bốc từ chồng bài." },
  KitCarlson: { id: "KitCarlson", name: "Kit Carlson", maxHp: 4, ability: "Đầu lượt lật 3 lá trên cùng, chọn 2, úp lá còn lại xuống dưới." },
  LuckyDuke: { id: "LuckyDuke", name: "Lucky Duke", maxHp: 4, ability: "Mỗi khi cần lật bài may rủi (Barrel, Dynamite, Jail...), lật 2 lá và chọn lá có lợi hơn." },
  ParisPete: { id: "ParisPete", name: "Paul Regret", maxHp: 3, ability: "Người khác luôn thấy bạn xa hơn 1 (cộng dồn với Mustang)." },
  RoseDoolan: { id: "RoseDoolan", name: "Rose Doolan", maxHp: 4, ability: "Bạn thấy mọi người gần hơn 1 khi tấn công (cộng dồn với Scope)." },
  SidKetchum: { id: "SidKetchum", name: "Sid Ketchum", maxHp: 4, ability: "Bất kỳ lúc nào có thể bỏ 2 lá bài để hồi 1 máu." },
  SlabTheKiller: { id: "SlabTheKiller", name: "Slab the Killer", maxHp: 4, ability: "Đối thủ cần 2 lá Missed! mới né được Bang! của bạn." },
  SuzyLafayette: { id: "SuzyLafayette", name: "Suzy Lafayette", maxHp: 4, ability: "Khi tay hết bài, rút ngay 1 lá." },
  VultureSam: { id: "VultureSam", name: "Vulture Sam", maxHp: 4, ability: "Khi có người chơi khác chết, lấy hết bài của họ về tay mình." },
  JohnnyKisch: { id: "JohnnyKisch", name: "Jourdonnais", maxHp: 4, ability: "Có Barrel tự nhiên: khi bị Bang!, lật 1 lá Cơ thì né được, kể cả khi không có Barrel trong tay." },
};

export function roleCountFor(playerCount: number): RoleName[] {
  // Standard Bang! role distribution
  switch (playerCount) {
    case 4: return ["Sheriff", "Outlaw", "Outlaw", "Renegade"];
    case 5: return ["Sheriff", "Outlaw", "Outlaw", "Renegade", "Deputy"];
    case 6: return ["Sheriff", "Outlaw", "Outlaw", "Outlaw", "Renegade", "Deputy"];
    case 7: return ["Sheriff", "Outlaw", "Outlaw", "Outlaw", "Renegade", "Deputy", "Deputy"];
    default:
      throw new Error("Bang! hỗ trợ 4-7 người chơi");
  }
}

export function pickRandomCharacters(count: number): CharacterId[] {
  const ids = Object.keys(CHARACTERS) as CharacterId[];
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Deals 2 distinct candidate characters to each of `count` players (as in
 * the physical game: everyone gets 2 character cards, picks 1, the other
 * goes back in the box unseen by anyone else). Requires count * 2 <= the
 * total number of characters (16), which holds for the supported 4-7 players.
 */
export function dealCharacterChoices(count: number): CharacterId[][] {
  const ids = Object.keys(CHARACTERS) as CharacterId[];
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  const hands: CharacterId[][] = [];
  for (let i = 0; i < count; i++) {
    hands.push([shuffled[i * 2], shuffled[i * 2 + 1]]);
  }
  return hands;
}
