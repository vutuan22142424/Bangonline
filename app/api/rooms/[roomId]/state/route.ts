import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { redactForPlayer } from "@/lib/redact";
import { GameState } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const playerId = req.nextUrl.searchParams.get("playerId");
  if (!playerId) return NextResponse.json({ error: "Thiếu playerId." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("game_states").select("*").eq("room_id", roomId).single();
  if (error || !data) return NextResponse.json({ error: "Chưa có ván nào đang diễn ra." }, { status: 404 });

  const state = data.state as GameState;
  if (!state.players[playerId]) {
    return NextResponse.json({ error: "Bạn không nằm trong ván này." }, { status: 403 });
  }

  return NextResponse.json(redactForPlayer(state, playerId));
}
