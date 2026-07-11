import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { name } = await req.json().catch(() => ({ name: "Player" }));
  const supabase = getSupabaseServerClient();

  const { data: room, error: roomErr } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (roomErr || !room) return NextResponse.json({ error: "Không tìm thấy phòng." }, { status: 404 });
  if (room.status !== "lobby") return NextResponse.json({ error: "Ván đã bắt đầu." }, { status: 400 });

  const { data: existing } = await supabase.from("room_players").select("*").eq("room_id", roomId);
  if ((existing?.length ?? 0) >= room.max_players) {
    return NextResponse.json({ error: "Phòng đã đầy." }, { status: 400 });
  }

  const playerId = crypto.randomUUID();
  const seat = existing?.length ?? 0;
  const { error: insertErr } = await supabase
    .from("room_players")
    .insert({ room_id: roomId, player_id: playerId, name: name ?? "Player", seat });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ roomId, playerId });
}
