"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../../types/database";
import { requireSupabaseConfig } from "./config";

/** Browser singleton managed by @supabase/ssr; shares cookies with Next SSR. */
export function createBrowserSupabaseClient() {
  const { url, key } = requireSupabaseConfig();
  return createBrowserClient<Database>(url,key,{ cookieOptions: { path: "/", sameSite: "lax" } });
}
