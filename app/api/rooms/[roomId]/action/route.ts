import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { applyAction, ActionType, GameError } from "@/lib/actions";
import { redactForPlayer } from "@/lib/redact";
import { GameState } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = (await req.json()) as { playerId: string; action: ActionType };
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.from("game_states").select("*").eq("room_id", roomId).single();
  if (error || !data) return NextResponse.json({ error: "Chưa có ván nào đang diễn ra." }, { status: 404 });

  const state = data.state as GameState;

  try {
    const next = applyAction(state, body.action);
    const { error: updateErr } = await supabase
      .from("game_states")
      .update({ state: next, version: next.version, updated_at: new Date().toISOString() })
      .eq("room_id", roomId);
    if (updateErr) throw updateErr;

    await supabase
      .from("room_state_version")
      .upsert({ room_id: roomId, version: next.version, updated_at: new Date().toISOString() });

    return NextResponse.json(redactForPlayer(next, body.playerId));
  } catch (e) {
    if (e instanceof GameError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Có lỗi xảy ra khi xử lý hành động." }, { status: 500 });
  }
}
