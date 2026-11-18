import { cookies } from "next/headers";
import { createCookieClient } from "./cookie-client";

/** Per-request client for Route Handlers. Uses only the caller's session. */
export async function createRequestClient() {
  return createCookieClient(await cookies());
}

/** Server Components: read session/data, with refresh persisted by middleware. */
export async function createServerSupabaseClient() {
  return createCookieClient(await cookies(),true);
}
