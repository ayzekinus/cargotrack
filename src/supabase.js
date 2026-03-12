// ─────────────────────────────────────────────────────────────
//  CargoTrack — Supabase Client
//  Bu dosyadaki URL ve KEY değerlerini Supabase dashboard'dan alın.
//  Supabase → Settings → API bölümüne bakın.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";   // ← değiştirin
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";                     // ← değiştirin

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
