import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.SUPABASE_URL || 
  '';

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  '';

// Check if credentials are valid and not the placeholder strings
const isConfigured = 
  !!supabaseUrl && 
  supabaseUrl !== 'https://your-project.supabase.co' && 
  !!supabaseAnonKey && 
  supabaseAnonKey !== 'your-anon-key';

export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export function isSupabaseConfigured(): boolean {
  return isConfigured;
}

export function getSupabaseConfigInfo() {
  return {
    url: supabaseUrl,
    configured: isConfigured
  };
}
