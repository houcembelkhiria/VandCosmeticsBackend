import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Log warning if using placeholder values
if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseServiceKey === 'placeholder-service-key') {
  console.warn('⚠️  Using placeholder Supabase credentials. Please set up your .env file with real Supabase credentials.');
}

// Admin client with service role key for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Client for user operations (uses anon key)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default supabaseAdmin;
