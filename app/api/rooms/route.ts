import { NextRequest, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const genRoomId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export async function POST(req: NextRequest) {
  const { hostName } = await req.json().catch(() => ({ hostName: "Host" }));
  const supabase = getSupabaseServerClient();
  const roomId = genRoomId();
  const playerId = crypto.randomUUID();

  const { error: roomErr } = await supabase.from("rooms").insert({ id: roomId, status: "lobby" });
  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 });

  const { error: playerErr } = await supabase
    .from("room_players")
    .insert({ room_id: roomId, player_id: playerId, name: hostName ?? "Host", seat: 0 });
  if (playerErr) return NextResponse.json({ error: playerErr.message }, { status: 500 });

  return NextResponse.json({ roomId, playerId });
}
