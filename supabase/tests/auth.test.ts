import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { createAuthService, confirmationRedirect, getSiteOrigin } from "../../src/services/auth";
import { ServiceError } from "../../src/services/core";
import { createCookieClient } from "../../src/lib/supabase/cookie-client";
import { SupabaseConfigurationError } from "../../src/lib/supabase/config";
import { handleApi } from "../../src/services/http";

const id = "00000000-0000-4000-8000-000000000001";
const user = { id,email:"client@example.test",aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:{full_name:"Client"},created_at:"2026-01-01T00:00:00Z" };
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = () => `${encoded({alg:"HS256",typ:"JWT"})}.${encoded({sub:id,exp:Math.floor(Date.now()/1000)+3600})}.${Buffer.from("test-signature").toString("base64url")}`;
const session = () => ({ access_token:token(),refresh_token:"test-refresh",token_type:"bearer",expires_in:3600,user });
type Call = { url: URL; body: Record<string,unknown> | null };
function fixture(responder?: (call: Call) => Response) {
  const calls: Call[] = [];
  const db = createClient<Database>("https://example.supabase.co","public-test-key",{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:async (input,init) => {
      const request = new Request(input,init);
      const raw = await request.text();
      const call = {url:new URL(request.url),body:raw ? JSON.parse(raw) : null};
      calls.push(call);
      return responder?.(call) ?? Response.json(session());
    }},
  });
  return {db,calls,auth:createAuthService(db,{siteUrl:"https://optizap.test"})};
}
const rejects = (fn: () => Promise<unknown>, code: string) => assert.rejects(fn,e => e instanceof ServiceError && e.code === code);
const failure = (code: string,status: number) => Response.json({code,message:"internal auth details"},{status,headers:{"x-supabase-api-version":"2024-01-01"}});

test("password login uses Auth and returns no access/refresh tokens",async () => {
  const {auth,calls} = fixture();
  const result = await auth.login({email:" client@example.test ",password:" pass with spaces "});
  assert.deepEqual(result,{user:{id,email:user.email}});
  assert.equal(calls[0].url.searchParams.get("grant_type"),"password");
  assert.equal(calls[0].body?.password," pass with spaces ");
  assert.equal(calls[0].body?.email,user.email);
  assert.ok(!JSON.stringify(result).includes("refresh_token"));
});
test("login sanitizes invalid credentials, unconfirmed email and rate limits",async () => {
  for (const [code,status,expected] of [["invalid_credentials",400,"INVALID_CREDENTIALS"],["email_not_confirmed",400,"EMAIL_NOT_CONFIRMED"],["over_request_rate_limit",429,"RATE_LIMITED"]] as const) {
    const {auth} = fixture(() => failure(code,status));
    await rejects(() => auth.login({email:user.email,password:"wrong-password"}),expected);
  }
});
test("registration sends full_name only and a trusted PKCE callback",async () => {
  const {auth,calls} = fixture(() => Response.json(user));
  const result = await auth.register({email:user.email,password:"Test-password-123",full_name:" Client "});
  assert.deepEqual(result,{user:null,requires_email_confirmation:true});
  assert.deepEqual(calls[0].body?.data,{full_name:"Client"});
  assert.equal(calls[0].url.searchParams.get("redirect_to"),"https://optizap.test/api/auth/callback");
});
test("registration with confirmations disabled returns the authenticated user",async () => {
  const {auth} = fixture();
  assert.deepEqual(await auth.register({email:user.email,password:"Test-password-123",full_name:"Client"}),{user:{id,email:user.email},requires_email_confirmation:false});
});
test("registration cannot choose roles, user IDs, redirect URLs or short passwords",async () => {
  const {auth,calls} = fixture();
  const valid = {email:user.email,password:"Test-password-123",full_name:"Client"};
  for (const payload of [{...valid,role:"admin"},{...valid,id},{...valid,emailRedirectTo:"https://evil.test"},{...valid,password:"short"},{...valid,email:"invalid"}]) await rejects(() => auth.register(payload),"VALIDATION_ERROR");
  assert.equal(calls.length,0);
});
test("existing signup accounts produce the same generic confirmation response",async () => {
  const {auth} = fixture(() => failure("user_already_exists",422));
  assert.deepEqual(await auth.register({email:user.email,password:"Test-password-123",full_name:"Client"}),{user:null,requires_email_confirmation:true});
});
test("logout revokes only the current session",async () => {
  const {auth,db,calls} = fixture(call => call.url.pathname.endsWith("/logout") ? new Response(null,{status:204}) : Response.json(session()));
  await db.auth.setSession({access_token:token(),refresh_token:"test-refresh"});
  assert.deepEqual(await auth.logout(),{signed_out:true});
  assert.equal(calls.find(c => c.url.pathname.endsWith("/logout"))?.url.searchParams.get("scope"),"local");
});
test("logout is idempotent without a session and rejects scope overrides",async () => {
  const {auth} = fixture();
  assert.deepEqual(await auth.logout(),{signed_out:true});
  await rejects(() => auth.logout({scope:"global"}),"VALIDATION_ERROR");
});
test("token hash confirmation verifies Auth then returns a clean trusted redirect",async () => {
  const {auth,calls} = fixture();
  const target = await auth.confirmEmail({token_hash:"test-token-hash",type:"email",next:"/citas"});
  assert.equal(target,"https://optizap.test/citas");
  assert.equal(calls[0].url.pathname,"/auth/v1/verify");
  assert.equal(calls[0].body?.token_hash,"test-token-hash");
  assert.ok(!target.includes("token_hash"));
});
test("confirmation refuses expired tokens and recovery flows",async () => {
  const {auth} = fixture(() => failure("otp_expired",403));
  await rejects(() => auth.confirmEmail({token_hash:"expired",type:"email"}),"INVALID_CONFIRMATION");
  await rejects(() => auth.confirmEmail({token_hash:"test",type:"recovery"}),"VALIDATION_ERROR");
});
test("confirmation validates the redirect before consuming a token",async () => {
  const {auth,calls} = fixture();
  for (const next of ["https://evil.test","//evil.test","/\\evil.test","/\r\nLocation: https://evil.test"]) await rejects(() => auth.confirmEmail({token_hash:"test",type:"email",next}),"VALIDATION_ERROR");
  assert.equal(calls.length,0);
});
test("canonical site URL and relative redirect rules are explicit",() => {
  assert.equal(getSiteOrigin("https://optizap.test/"),"https://optizap.test");
  for (const value of ["javascript:alert(1)","https://user:pass@optizap.test","https://optizap.test/path"]) assert.throws(() => getSiteOrigin(value),SupabaseConfigurationError);
  assert.equal(confirmationRedirect(undefined,"https://optizap.test"),"https://optizap.test/");
});
test("PKCE callback requires the verifier and reports invalid exchanges safely",async () => {
  const {auth} = fixture(() => failure("bad_code_verifier",400));
  await rejects(() => auth.exchangeCode({code:"used-or-invalid-code"}),"INVALID_CONFIRMATION");
});
test("HTTP login errors are sanitized and cross-origin login is rejected",async () => {
  const {db} = fixture(() => failure("invalid_credentials",400));
  const request = (origin: string) => new Request("https://optizap.test/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify({email:user.email,password:"wrong"})});
  const result = await handleApi(request("https://optizap.test"),async () => db);
  assert.equal(result.status,401); assert.equal((await result.json()).error.code,"INVALID_CREDENTIALS");
  assert.equal((await handleApi(request("https://evil.test"),async () => db)).status,403);
});
test("HTTP logout needs no body and responses cannot be cached",async () => {
  const {db} = fixture();
  const result = await handleApi(new Request("https://optizap.test/api/auth/logout",{method:"POST"}),async () => db);
  assert.equal(result.status,200); assert.deepEqual(await result.json(),{data:{signed_out:true}});
  assert.match(result.headers.get("Cache-Control")!,/no-store/);
  assert.equal(result.headers.get("Referrer-Policy"),"no-referrer");
});
test("Server Component cookie client tolerates the read-only cookie store",async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(session());
  t.after(() => {globalThis.fetch=originalFetch;});
  let writes = 0;
  const client = createCookieClient({getAll:() => [],set:() => { writes++; throw new Error("read-only cookies"); }},true,{url:"https://example.supabase.co",key:"public-test-key"});
  const result = await client.auth.signInWithPassword({email:user.email,password:"test-password"});
  assert.equal(result.error,null); assert.ok(writes>0);
});
test("Route Handler cookie client persists new session cookies",async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(session());
  t.after(() => {globalThis.fetch=originalFetch;});
  const jar = new Map<string,string>();
  const client = createCookieClient({getAll:() => [...jar].map(([name,value])=>({name,value})),set:(name,value) => {jar.set(name,value);}},false,{url:"https://example.supabase.co",key:"public-test-key"});
  const result = await client.auth.signInWithPassword({email:user.email,password:"test-password"});
  assert.equal(result.error,null); assert.ok([...jar.keys()].some(name=>name.includes("auth-token")));
});
