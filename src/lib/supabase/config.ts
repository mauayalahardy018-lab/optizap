export type SupabaseConfig = { url: string; key: string };
export class SupabaseConfigurationError extends Error {}

export function readSupabaseConfig(): SupabaseConfig | null {
  // Explicit property access is required for Next's browser env substitution.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
export function requireSupabaseConfig(): SupabaseConfig {
  const config = readSupabaseConfig();
  if (!config) throw new SupabaseConfigurationError("El servicio de datos no está configurado.");
  return config;
}
/** Server/Edge clients read runtime env, independently of the browser build. */
export function readServerSupabaseConfig(): SupabaseConfig | null {
  // Copying keeps Webpack from folding property access into build constants.
  const env = { ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
export function requireServerSupabaseConfig(): SupabaseConfig {
  const config = readServerSupabaseConfig();
  if (!config) throw new SupabaseConfigurationError("El servicio de datos no está configurado.");
  return config;
}
export const AUTH_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};
