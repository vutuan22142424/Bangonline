import { createClient } from "@supabase/supabase-js";

// IMPORTANT: this file must only ever be imported from server-side code
// (API routes / route handlers). It uses the Supabase service role key,
// which bypasses Row Level Security — never expose it to the browser.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
