// ─────────────────────────────────────────────────────────────
//  CargoTrack — Supabase Client
//  Bu dosyadaki URL ve KEY değerlerini Supabase dashboard'dan alın.
//  Supabase → Settings → API bölümüne bakın.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tamdwyoulwtufhjhvdnn.supabase.co";   // ← değiştirin
const SUPABASE_ANON_KEY = "sb_secret_YHBk0h_jIw0XxL2IpaPNfQ_TMn4gZko";                     // ← değiştirin

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
