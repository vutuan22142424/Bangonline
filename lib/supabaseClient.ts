"use client";

import { createClient } from "@supabase/supabase-js";

// Anon key only — Row Level Security must block direct reads of sensitive
// tables (game_state). The browser only uses this client to (a) receive
// "something changed, refetch" realtime notifications, and (b) for anything
// deliberately marked publicly readable (e.g. room metadata).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser = createClient(url, anonKey);
