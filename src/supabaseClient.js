// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Vite requires variables to start with VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Let's add a quick check so you know if your .env file is broken
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables! Check your .env.local file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);