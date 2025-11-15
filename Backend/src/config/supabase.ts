import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"]!;
const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"]!;
const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing SUPABASE_ANON_KEY");
if (!supabaseServiceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

/* Cliente con permisos limitados (Anon Key) */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: false },
});

/* Cliente con permisos de administrador (Service Role Key) */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
  global: {
    headers: {
      'apikey': supabaseServiceKey,
    },
  },
});

/* Función para testear la conexión a Supabase */
export const testSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from("_healthcheck").select("*").limit(1);
    if (error && !error.message.includes("relation")) throw error;
    return true;
  } catch (err) {
    console.error("Supabase connection test failed:", err);
    return false;
  }
};
