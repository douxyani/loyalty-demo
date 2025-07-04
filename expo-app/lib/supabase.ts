import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;

// Regular client (v2+ API, do not pass legacy auth options)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (uses service role key for admin operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
