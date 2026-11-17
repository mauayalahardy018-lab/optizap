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
  const stub = createServer((req,res) => {
    calls.push({ path: req.url, method: req.method, auth: req.headers.authorization });
    res.setHeader('Content-Type','application/json');
    if (req.url.startsWith('/auth/v1/user')) res.end(JSON.stringify(user));
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
    env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:supabaseUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test-key',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-test-key'},
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
});
