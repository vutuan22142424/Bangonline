import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { createInitialGameState } from "@/lib/gameEngine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = getSupabaseServerClient();

  const { data: players, error } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!players || players.length < 4) {
    return NextResponse.json({ error: "Cần tối thiểu 4 người chơi để bắt đầu." }, { status: 400 });
  }
  if (players.length > 7) {
    return NextResponse.json({ error: "Bang! hỗ trợ tối đa 7 người chơi." }, { status: 400 });
  }

  const playerIds = players.map((p) => p.player_id);
  const names = Object.fromEntries(players.map((p) => [p.player_id, p.name]));
  const state = createInitialGameState(roomId, playerIds, names);

  const { error: upsertErr } = await supabase
    .from("game_states")
    .upsert({ room_id: roomId, state, version: state.version });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  await supabase.from("rooms").update({ status: "playing" }).eq("id", roomId);
  await supabase
    .from("room_state_version")
    .upsert({ room_id: roomId, version: state.version, updated_at: new Date().toISOString() });

  return NextResponse.json({ ok: true });
}
