import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../../types/database";
import { AUTH_CACHE_HEADERS, readServerSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  const config = readServerSupabaseConfig();
  let response = NextResponse.next({ request });
  // Public mock screens can render during setup; data endpoints return 503.
  if (!config) return response;
  const supabase = createServerClient<Database>(config.url,config.key,{
    cookieOptions: { path: "/", sameSite: "lax" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values,headers) {
        values.forEach(({name,value}) => request.cookies.set(name,value));
        const previousCookies = response.cookies.getAll();
        const previousHeaders = new Headers(response.headers);
        response = NextResponse.next({ request });
        previousCookies.forEach(cookie => response.cookies.set(cookie));
        values.forEach(({name,value,options}) => response.cookies.set(name,value,options));
        // SSR may deliver the cache headers only on its first cookie write.
        for (const key of ["cache-control","expires","pragma"]) {
          const value = previousHeaders.get(key);
          if (value) response.headers.set(key,value);
        }
        Object.entries(headers).forEach(([key,value]) => response.headers.set(key,value));
      },
    },
    global: { fetch: (input,init) => fetch(input,{ ...init, cache: "no-store" }) },
  });
  // getUser verifies with Auth and lazily refreshes expired access tokens.
  // It never authorizes from the unverified user object stored in a cookie.
  await supabase.auth.getUser();
  if (request.cookies.getAll().some(c => c.name.startsWith("sb-") && c.name.includes("auth-token")) || response.cookies.getAll().length) {
    Object.entries(AUTH_CACHE_HEADERS).forEach(([key,value]) => response.headers.set(key,value));
    response.headers.set("Vary","Cookie");
  }
  return response;
}
