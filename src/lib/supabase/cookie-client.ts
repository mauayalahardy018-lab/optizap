import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "../../types/database";
import { requireServerSupabaseConfig, type SupabaseConfig } from "./config";

export type CookieStore = {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options: CookieOptions): void;
};

/** readOnly is only for Server Components; writes must use createRequestClient. */
export function createCookieClient(store: CookieStore, readOnly = false, config: SupabaseConfig = requireServerSupabaseConfig()) {
  return createServerClient<Database>(config.url,config.key,{
    cookieOptions: { path: "/", sameSite: "lax" },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values, _headers) {
        try { values.forEach(({name,value,options}) => store.set(name,value,options)); }
        catch (error) {
          // Next Server Components cannot write cookies; middleware persists refresh.
          if (!readOnly) throw error;
        }
        // API responses apply AUTH_CACHE_HEADERS; RSC refresh uses middleware.
      },
    },
    global: { fetch: (input,init) => fetch(input,{ ...init, cache: "no-store" }) },
  });
}
