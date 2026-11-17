import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { ServiceError, type Client } from "../../services/core";

/** Per-request client for Route Handlers. Uses only the caller's session. */
export async function createRequestClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ServiceError("UNAVAILABLE", "El servicio de datos no está configurado.", 503);
  const store = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values: { name: string; value: string; options: CookieOptions }[]) => values.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }) },
    // SSR 0.5.x uses the pre-2.75 SDK generic parameter order in its .d.ts.
    // The runtime client is unchanged; normalize its type at this boundary.
  }) as unknown as Client;
}
