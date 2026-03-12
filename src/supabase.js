// ─────────────────────────────────────────────────────────────
//  CargoTrack — Supabase Client
//  Bu dosyadaki URL ve KEY değerlerini Supabase dashboard'dan alın.
//  Supabase → Settings → API bölümüne bakın.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tamdwyoulwtufhjhvdnn.supabase.co";   // ← değiştirin
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhbWR3eW91bHd0dWZoamh2ZG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTE1ODQsImV4cCI6MjA4ODg4NzU4NH0.stIDyNh8rBRJiZa8kVOoy6lh3dqOLKzghkwSoqSVbc0";                     // ← değiştirin

export const isConfigured =
  SUPABASE_URL !== "https://tamdwyoulwtufhjhvdnn.supabase.co" &&
  SUPABASE_ANON_KEY !== "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhbWR3eW91bHd0dWZoamh2ZG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTE1ODQsImV4cCI6MjA4ODg4NzU4NH0.stIDyNh8rBRJiZa8kVOoy6lh3dqOLKzghkwSoqSVbc0" &&
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 20;

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
