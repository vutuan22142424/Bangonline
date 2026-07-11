import { GameState, PlayerHandView, RedactedGameState } from "./types";

/**
 * Produces the view of the game state that a specific player is allowed to
 * see: their own hand in full, everyone else's hand only as a count, and
 * roles hidden unless revealed (dead, or Sheriff which is always public).
 */
export function redactForPlayer(state: GameState, viewerId: string): RedactedGameState {
  const players: Record<string, PlayerHandView> = {};
  for (const [id, p] of Object.entries(state.players)) {
    const isSelf = id === viewerId;
    players[id] = {
      ...p,
      role: p.roleRevealed || isSelf ? p.role : ("Unknown" as PlayerHandView["role"]),
      // A character is public knowledge the instant its owner picks it (same
      // as the physical game); until then it's still just one of 2 secret
      // candidates, so mask it from everyone but the owner.
      character: p.characterChosen || isSelf ? p.character : "Unknown",
      // Only the owner ever sees their own pair of candidates.
      characterChoices: isSelf ? p.characterChoices : null,
      hand: isSelf ? p.hand : null,
      handCount: p.hand.length,
    };
  }

  return {
    ...state,
    deckCount: state.deck.length,
    players,
    you: viewerId,
  } as RedactedGameState;
}
