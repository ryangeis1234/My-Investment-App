import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseUrl !== 'https://your-project.supabase.co' && 
  supabaseAnonKey && 
  !supabaseAnonKey.includes('dummy_key');

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;