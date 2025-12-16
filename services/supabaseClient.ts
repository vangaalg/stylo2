import { createClient } from '@supabase/supabase-js';

// Access variables directly so Vite can perform static replacement via 'define' in vite.config.ts
// @ts-ignore
const supabaseUrl = process.env.SUPABASE_URL;
// @ts-ignore
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Strict check to ensure values are actually strings and not undefined/null
export const isSupabaseConfigured = 
  typeof supabaseUrl === 'string' && 
  supabaseUrl.length > 0 &&
  typeof supabaseAnonKey === 'string' && 
  supabaseAnonKey.length > 0;

let client;

if (isSupabaseConfigured) {
  try {
    // We cast to string because the if-check guarantees they are strings
    // Configure storage to use localStorage for session persistence
    client = createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  } catch (error) {
    console.error("Supabase client initialization failed:", error);
    client = createMockClient(); 
  }
} else {
  console.warn("Supabase credentials missing or invalid! App running in offline/mock mode.");
  client = createMockClient();
}

function createMockClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: async () => ({ error: { message: "Supabase not configured" } }),
      signInWithPassword: async () => ({ error: { message: "Supabase not configured" } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: "DB not configured" } }) }) }),
      update: () => ({ eq: async () => ({ error: { message: "DB not configured" } }) }),
    })
  } as any;
}

export const signInWithGoogle = async () => {
  if (!client) return { error: { message: "Supabase not configured" } };
  
  const redirectUrl = window.location.origin;
  console.log("Initiating Google Auth with redirect to:", redirectUrl);

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        prompt: 'select_account' // Force Google to show account selection
      }
    }
  });
  return { data, error };
};

export const signOut = async () => {
  if (!client) return { error: null };
  return await client.auth.signOut();
};

export const supabase = client;