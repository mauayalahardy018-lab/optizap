import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createServerClient } from '@supabase/ssr';

// Runs the built Next.js server against a local Supabase HTTP stub. Exercises
// real SSR cookie decoding, auth.getUser, routing and SDK transport together.
test('production Route Handlers with SSR cookies', async t => {
  const id = '00000000-0000-4000-8000-000000000001';
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'test@example.test',
    app_metadata: {}, user_metadata: { role: 'admin' }, created_at: '2026-01-01T00:00:00Z' };
  const calls = [];
  let refreshedAccessToken;
  const authSession = marker => {
    const access_token = `${encoded({alg:'HS256',typ:'JWT'})}.${encoded({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,marker})}.${Buffer.from('test-signature').toString('base64url')}`;
    if (marker === 'refreshed') refreshedAccessToken = access_token;
    return {access_token,refresh_token:'rotated-refresh-token',token_type:'bearer',expires_in:3600,user};
  };
  const stub = createServer(async (req,res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    calls.push({ path: req.url, method: req.method, auth: req.headers.authorization, body });
    res.setHeader('Content-Type','application/json');
    res.setHeader('x-supabase-api-version','2024-01-01');
    if (req.url.startsWith('/auth/v1/user')) res.end(JSON.stringify(user));
    else if (req.url.startsWith('/auth/v1/token')) {
      const grant = new URL(req.url,'http://stub').searchParams.get('grant_type');
      if (grant === 'refresh_token') res.end(JSON.stringify(authSession('refreshed')));
      else if (grant === 'password' && body.password === 'Test-password-123') res.end(JSON.stringify(authSession('login')));
      else if (grant === 'pkce' && body.auth_code === 'valid-code' && body.code_verifier) res.end(JSON.stringify(authSession('pkce')));
      else { res.statusCode=400; res.end(JSON.stringify({code:'invalid_credentials',message:'internal Auth detail'})); }
    }
    else if (req.url.startsWith('/auth/v1/signup')) res.end(JSON.stringify(user));
    else if (req.url.startsWith('/auth/v1/verify')) {
      if (body.token_hash === 'valid-token') res.end(JSON.stringify(authSession('confirmed')));
      else {res.statusCode=403;res.end(JSON.stringify({code:'otp_expired',message:'internal Auth detail'}));}
    }
    else if (req.url.startsWith('/auth/v1/logout')) {res.statusCode=204;res.end();}
    else if (req.url.startsWith('/rest/v1/profiles')) res.end(JSON.stringify([{ ...user, full_name: 'Client', role: 'cliente', avatar_url: null, updated_at: user.created_at }]));
    else if (req.url.startsWith('/rest/v1/frames')) { res.setHeader('Content-Range','0-0/1'); res.end(JSON.stringify([{ id, sku: 'RB-1', name: 'Frame', brand: { id, name: 'Ray-Ban' } }])); }
    else if (req.url.startsWith('/rest/v1/appointments') && req.method === 'POST') { res.statusCode=409; res.end(JSON.stringify({ code:'23P01', message:'private SQL details' })); }
    else { res.statusCode=404; res.end(JSON.stringify({code:'not_found'})); }
  });
  await new Promise(resolve => stub.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => { stub.closeAllConnections(); stub.close(resolve); }));
  const supabaseUrl = `http://127.0.0.1:${stub.address().port}`;
  const cookies = new Map();
  const authClient = createServerClient(supabaseUrl,'public-test-key',{
    cookies: { getAll: () => [...cookies].map(([name,value]) => ({name,value})),
      setAll: values => values.forEach(({name,value}) => cookies.set(name,value)) },
  });
  const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encoded({alg:'HS256',typ:'JWT'})}.${encoded({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.${Buffer.from('test-signature').toString('base64url')}`;
  const session = await authClient.auth.setSession({access_token:token,refresh_token:'test-refresh-token'});
  assert.equal(session.error,null);
  const cookieHeader = [...cookies].map(([name,value]) => `${name}=${value}`).join('; ');
  assert.ok(cookieHeader.includes('auth-token'));

  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0,'127.0.0.1',resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const root = fileURLToPath(new URL('../../',import.meta.url));
  const next = spawn(process.execPath,[fileURLToPath(new URL('../../node_modules/next/dist/bin/next',import.meta.url)),'start','--hostname','127.0.0.1','--port',String(port)],{
    cwd:root, windowsHide:true, stdio:['ignore','pipe','pipe'],
    env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:supabaseUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-test-key',SITE_URL:`http://127.0.0.1:${port}`},
  });
  t.after(async () => { if (next.exitCode === null) { const exited = new Promise(resolve => next.once('exit',resolve)); next.kill(); await exited; } });
  let output = '';
  await new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(new Error(`Next readiness timeout: ${output}`)),20000);
    const collect = chunk => { output += chunk; if (output.includes('Ready in')) { clearTimeout(timer); resolve(); } };
    next.stdout.on('data',collect); next.stderr.on('data',collect);
    next.once('exit',code => { clearTimeout(timer); reject(new Error(`Next exited ${code}: ${output}`)); });
  });
  const base = `http://127.0.0.1:${port}/api`;
  const readCookies = (jar,result) => {
    for (const cookie of result.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]; const equals = pair.indexOf('=');
      const name = pair.slice(0,equals), value = pair.slice(equals+1);
      if (!value || /max-age=0(?:;|$)/i.test(cookie)) jar.delete(name); else jar.set(name,value);
    }
    return [...jar].map(([name,value])=>`${name}=${value}`).join('; ');
  };
  const post = (path,payload,cookie='') => fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(payload)});
  await t.test('public catalog works through the actual production route', async () => {
    const result = await fetch(`${base}/catalog/frames?search=RB&limit=10`);
    assert.equal(result.status,200,await result.clone().text());
    assert.equal((await result.json()).data.items[0].sku,'RB-1');
    assert.match(result.headers.get('cache-control'),/no-store/);
  });
  await t.test('SSR cookie is verified and the stored role defeats editable metadata', async () => {
    const profile = await fetch(`${base}/me/profile`,{headers:{Cookie:cookieHeader}});
    assert.equal(profile.status,200,await profile.clone().text());
    assert.equal((await profile.json()).data.role,'cliente');
    assert.ok(calls.some(c => c.path.startsWith('/auth/v1/user') && c.auth === `Bearer ${token}`));
    const forbidden = await fetch(`${base}/catalog/frames`,{method:'POST',headers:{Cookie:cookieHeader,'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`},body:'{}'});
    assert.equal(forbidden.status,403);
    assert.ok(!calls.some(c => c.path.startsWith('/rest/v1/frames') && c.method === 'POST'));
  });
  await t.test('real route translates an appointment race without leaking SQL details', async () => {
    const result = await fetch(`${base}/appointments`,{method:'POST',headers:{Cookie:cookieHeader,'Content-Type':'application/json'},body:JSON.stringify({patient_id:id,optometrist_id:id,starts_at:'2099-01-01T10:00:00Z',ends_at:'2099-01-01T10:30:00Z'})});
    assert.equal(result.status,409);
    const payload = await result.json();
    assert.equal(payload.error.code,'SLOT_UNAVAILABLE');
    assert.ok(!payload.error.message.includes('private'));
  });
  await t.test('login writes SSR cookies and local logout removes them',async () => {
    const invalid = await post('/auth/login',{email:user.email,password:'wrong'});
    assert.equal(invalid.status,401); assert.equal((await invalid.json()).error.code,'INVALID_CREDENTIALS');
    const login = await post('/auth/login',{email:user.email,password:'Test-password-123'});
    assert.equal(login.status,200,await login.clone().text());
    assert.deepEqual(await login.json(),{data:{user:{id,email:user.email}}});
    const jar = new Map();
    const cookie = readCookies(jar,login);
    assert.ok(cookie.includes('auth-token'));
    assert.equal((await fetch(`${base}/me/profile`,{headers:{Cookie:cookie}})).status,200);
    const logout = await post('/auth/logout',{},cookie);
    assert.equal(logout.status,200);
    assert.deepEqual(await logout.json(),{data:{signed_out:true}});
    assert.ok(calls.some(c=>c.path==='/auth/v1/logout?scope=local'));
    const clearedCookie = readCookies(jar,logout);
    assert.ok(!clearedCookie.includes('auth-token'));
    assert.equal((await fetch(`${base}/me/profile`,{headers:{Cookie:clearedCookie}})).status,401);
  });
  await t.test('registration needs confirmation and never accepts a requested role',async () => {
    const signup = {email:user.email,password:'Test-password-123',full_name:'Client'};
    assert.equal((await post('/auth/register',{...signup,role:'admin'})).status,400);
    const result = await post('/auth/register',signup);
    assert.equal(result.status,202,await result.clone().text());
    assert.deepEqual(await result.json(),{data:{user:null,requires_email_confirmation:true}});
    assert.deepEqual(calls.filter(c=>c.path.startsWith('/auth/v1/signup')).at(-1).body.data,{full_name:'Client'});
  });
  await t.test('email token verification creates a session and redirects without the token',async () => {
    const result = await fetch(`${base}/auth/confirm?token_hash=valid-token&type=email&next=%2Fhistorial`,{redirect:'manual'});
    assert.equal(result.status,303,await result.clone().text());
    assert.equal(result.headers.get('location'),`http://127.0.0.1:${port}/historial`);
    assert.equal(result.headers.get('referrer-policy'),'no-referrer');
    assert.ok(result.headers.getSetCookie().some(c=>c.includes('auth-token')));
    const expired = await fetch(`${base}/auth/confirm?token_hash=expired&type=email`,{redirect:'manual'});
    assert.equal(expired.status,400);
    const malicious = await fetch(`${base}/auth/confirm?token_hash=valid-token&type=email&next=https%3A%2F%2Fevil.test`,{redirect:'manual'});
    assert.equal(malicious.status,400); assert.equal(malicious.headers.get('location'),null);
  });
  await t.test('PKCE callback uses the signup verifier cookie',async () => {
    const registration = await post('/auth/register',{email:user.email,password:'Test-password-123',full_name:'Client'});
    const jar = new Map(); const cookie = readCookies(jar,registration);
    assert.ok(cookie.includes('code-verifier'));
    const result = await fetch(`${base}/auth/callback?code=valid-code&next=%2Fcitas`,{headers:{Cookie:cookie},redirect:'manual'});
    assert.equal(result.status,303,await result.clone().text());
    assert.equal(result.headers.get('location'),`http://127.0.0.1:${port}/citas`);
    assert.ok(readCookies(jar,result).includes('auth-token'));
  });
  await t.test('middleware refreshes once and forwards the new cookie to server and browser',async () => {
    const jar = new Map();
    const client = createServerClient(supabaseUrl,'public-test-key',{
      cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))},
    });
    const soon = `${encoded({alg:'HS256',typ:'JWT'})}.${encoded({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+15})}.${Buffer.from('test-signature').toString('base64url')}`;
    assert.equal((await client.auth.setSession({access_token:soon,refresh_token:'test-refresh-token'})).error,null);
    const before = calls.length;
    const result = await fetch(`${base}/me/profile`,{headers:{Cookie:[...jar].map(([name,value])=>`${name}=${value}`).join('; ')}});
    assert.equal(result.status,200,await result.clone().text());
    const refreshes = calls.slice(before).filter(c=>c.path.includes('grant_type=refresh_token'));
    assert.equal(refreshes.length,1);
    assert.ok(calls.slice(before).some(c=>c.path.startsWith('/auth/v1/user') && c.auth===`Bearer ${refreshedAccessToken}`));
    assert.ok(result.headers.getSetCookie().some(c=>c.includes('auth-token')));
    assert.match(result.headers.get('cache-control'),/no-store/);
    assert.equal(result.headers.get('expires'),'0');
  });
});
