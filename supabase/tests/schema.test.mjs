import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

// Embedded PostgreSQL, with the minimal Auth interfaces used by migrations.
// No Supabase account, production keys, Docker or remote database is needed.
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [admin, opto, reception, client, other, opto2] = [1, 2, 3, 4, 5, 6].map(uid);
const [patient, patient2, record, record2, appointment] = [11, 12, 21, 22, 31].map(uid);
const frame = { brand_id: uid(100), sku: 'TEST-FRAME', name: 'Test frame', material: 'acetato', shape: 'redondo', color: 'Negro', lens_width_mm: 52, bridge_width_mm: 18, temple_length_mm: 140, price: 1250.50 };

test('Optizap migrations, constraints and RLS', async t => {
  const db = new PGlite({ extensions: { btree_gist } });
  t.after(() => db.close());
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users(id, email) values ('${admin}', 'admin@example.test');
  `);
  for (const file of (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  const rows = async sql => (await db.query(sql)).rows;
  const count = async table => Number((await rows(`select count(*) as n from public.${table}`))[0].n);
  const insert = async (table, data) => {
    const keys = Object.keys(data);
    return db.query(`insert into public.${table} (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(data));
  };
  const as = async (role, user, action) => {
    await db.exec('begin');
    try {
      await db.exec(`set local role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
      return await action();
    } finally {
      await db.exec('rollback');
    }
  };
  const denied = (action, code = '42501') => assert.rejects(action, err => err.code === code);

  await t.test('backfills existing auth users and seeds exactly the requested brands', async () => {
    assert.equal(await count('profiles'), 1);
    assert.deepEqual((await rows('select name from public.brands order by name')).map(r => r.name), ['Essilor', 'Oakley', 'Persol', 'Ray-Ban', 'Tom Ford', 'ZEISS']);
  });
  await t.test('reference seed is repeatable and preserves existing brand edits', async () => {
    const seed = await readFile(new URL('../seed.sql',import.meta.url),'utf8');
    await db.exec("update public.brands set description='Edited by admin' where slug='ray-ban'");
    await db.exec(seed); await db.exec(seed);
    assert.equal(await count('brands'),6);
    assert.equal((await rows("select description from public.brands where slug='ray-ban'"))[0].description,'Edited by admin');
  });
  await db.exec(`
    insert into auth.users(id, email, raw_user_meta_data) values
      ('${opto}', 'opto@example.test', '{}'), ('${reception}', 'reception@example.test', '{}'),
      ('${client}', 'client@example.test', '{"role":"admin", "full_name":"Client"}'),
      ('${other}', 'other@example.test', '{}'), ('${opto2}', 'opto2@example.test', '{}');
    update public.profiles set role = 'admin' where id = '${admin}';
    update public.profiles set role = 'optometrista' where id in ('${opto}', '${opto2}');
    update public.profiles set role = 'vendedor' where id = '${reception}';
    insert into public.brands(id,name,slug) values ('${uid(100)}','Test','test');
    insert into public.brands(id,name,slug,is_active) values ('${uid(101)}','Hidden','hidden',false);
    insert into public.patients(id, profile_id, full_name) values
      ('${patient}', '${client}', 'Patient One'), ('${patient2}', '${other}', 'Patient Two');
    insert into public.clinical_records(id,patient_id,optometrist_id,notes) values
      ('${record}', '${patient}', '${opto}', 'Confidential One'),
      ('${record2}', '${patient2}', '${opto2}', 'Confidential Two');
    insert into public.prescriptions(clinical_record_id,eye,sphere) values
      ('${record}', 'OD', -1.5), ('${record2}', 'OI', -2);
    insert into public.appointments(id,patient_id,optometrist_id,starts_at,ends_at,created_by) values
      ('${appointment}', '${patient}', '${opto}', '2099-01-01 10:00Z', '2099-01-01 10:30Z', '${reception}');
  `);
  await insert('frames', frame);
  await insert('frames', { ...frame, sku: 'HIDDEN-BRAND-FRAME', brand_id: uid(101) });
  await insert('frames', { ...frame, sku: 'INACTIVE-FRAME', is_active: false });
  await insert('lenses', { brand_id: uid(100), sku: 'TEST-LENS', name: 'Test lens', lens_type: 'monofocal', material: 'cr39', refractive_index: 1.5, diameter_mm: 70, price: 500 });

  await t.test('enables RLS on all public tables including stock movements', async () => {
    const tables = await rows("select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r'");
    assert.ok(tables.some(r => r.relname === 'stock_movements'));
    assert.ok(tables.every(r => r.relrowsecurity));
  });
  await t.test('TypeScript Rows, Inserts and relationships match PostgreSQL metadata', async () => {
    const file = fileURLToPath(new URL('../../src/types/database.ts', import.meta.url));
    const program = ts.createProgram([file], { strict: true, noEmit: true, skipLibCheck: true });
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(file);
    const dbSymbol = checker.getExportsOfModule(checker.getSymbolAtLocation(source)).find(s => s.name === 'Database');
    const prop = (type, name) => checker.getTypeOfSymbolAtLocation(type.getProperty(name), source);
    const tables = prop(prop(checker.getDeclaredTypeOfSymbol(dbSymbol), 'public'), 'Tables');
    const metadata = await rows("select table_name, column_name, is_nullable, column_default from information_schema.columns where table_schema='public'");
    for (const table of tables.getProperties()) {
      const type = checker.getTypeOfSymbolAtLocation(table, source);
      const rowType = prop(type, 'Row');
      const columns = metadata.filter(c => c.table_name === table.name);
      assert.deepEqual(rowType.getProperties().map(p => p.name).sort(), columns.map(c => c.column_name).sort(), `${table.name} Row columns`);
      const required = prop(type, 'Insert').getProperties().filter(p => !(p.flags & ts.SymbolFlags.Optional)).map(p => p.name).sort();
      assert.deepEqual(required, columns.filter(c => c.is_nullable === 'NO' && c.column_default === null).map(c => c.column_name).sort(), `${table.name} Insert required fields`);
      for (const column of columns) {
        const columnType = prop(rowType, column.column_name);
        const nullable = (columnType.isUnion() ? columnType.types : [columnType]).some(v => v.flags & ts.TypeFlags.Null);
        assert.equal(nullable, column.is_nullable === 'YES', `${table.name}.${column.column_name} nullability`);
      }
      const fks = await db.query(`select conname from pg_constraint c join pg_class t on t.oid=c.conrelid
        join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=$1 and c.contype='f'
        and c.confrelid in (select oid from pg_class where relnamespace='public'::regnamespace)`, [table.name]);
      const relationships = checker.getTypeArguments(prop(type, 'Relationships'));
      assert.deepEqual(relationships.map(r => prop(r, 'foreignKeyName').value).sort(), fks.rows.map(r => r.conname).sort(), `${table.name} foreign keys`);
    }
  });
  await t.test('signup ignores user-supplied role metadata', async () => {
    assert.equal((await rows(`select role from public.profiles where id='${client}'`))[0].role, 'cliente');
  });
  await t.test('Auth email changes synchronize the profile', async () => {
    await db.exec(`update auth.users set email='new@example.test' where id='${client}'`);
    assert.equal((await rows(`select email from public.profiles where id='${client}'`))[0].email, 'new@example.test');
  });
  await t.test('anonymous catalog hides inactive products and inactive brands', () => as('anon', null, async () => {
    assert.equal(await count('brands'), 7);
    assert.equal(await count('frames'), 1);
    assert.equal(await count('lenses'), 1);
  }));
  for (const table of ['profiles', 'patients', 'clinical_records', 'prescriptions', 'appointments']) {
    await t.test(`anonymous cannot read ${table}`, () => denied(() => as('anon', null, () => count(table))));
  }
  await t.test('client only reads own profile, patient, clinical record, prescription and appointments', () => as('authenticated', client, async () => {
    for (const table of ['profiles', 'patients', 'clinical_records', 'prescriptions', 'appointments']) assert.equal(await count(table), 1, table);
  }));
  await t.test('client cannot enumerate unrelated profiles', () => as('authenticated', client, async () => {
    assert.equal((await rows(`select * from public.profiles where id='${admin}'`)).length, 0);
  }));
  await t.test('authenticated user without a profile has no private access', () => as('authenticated', uid(999), async () => {
    for (const table of ['profiles', 'patients', 'clinical_records', 'prescriptions', 'appointments']) assert.equal(await count(table), 0, table);
  }));
  await t.test('client can update own display name', () => as('authenticated', client, async () => {
    assert.equal((await rows(`update public.profiles set full_name='Updated' where id='${client}' returning full_name`))[0].full_name, 'Updated');
  }));
  for (const user of [client, reception, opto]) {
    await t.test(`non-admin ${user} cannot elevate role`, () => denied(() => as('authenticated', user, () => db.exec(`update public.profiles set role='admin' where id='${user}'`))));
  }
  await t.test('client cannot forge email or creation timestamp', () => denied(() => as('authenticated', client, () => db.exec(`update public.profiles set email='fake@example.test', created_at=now() where id='${client}'`))));
  await t.test('administrator can assign roles', () => as('authenticated', admin, async () => {
    assert.equal((await rows(`update public.profiles set role='vendedor' where id='${other}' returning role`))[0].role, 'vendedor');
  }));
  await t.test('administrator sees inactive catalog', () => as('authenticated', admin, async () => {
    assert.equal(await count('frames'), 3);
    assert.equal(await count('brands'), 8);
  }));
  await t.test('administrator can insert catalog', () => as('authenticated', admin, () => insert('frames', { ...frame, sku: 'ADMIN-FRAME' })));
  await t.test('frame segment stays unclassified until assigned and filters solar correctly', () => as('authenticated', admin, async () => {
    assert.equal((await rows("select segment from public.frames where sku='TEST-FRAME'"))[0].segment,null);
    await insert('frames',{...frame,sku:'SOLAR-FRAME',segment:'solar'});
    assert.deepEqual((await rows("select sku from public.frames where segment='solar'")).map(r => r.sku),['SOLAR-FRAME']);
    await db.exec("update public.frames set segment='oftalmico' where sku='SOLAR-FRAME'");
    assert.equal((await rows("select segment from public.frames where sku='SOLAR-FRAME'"))[0].segment,'oftalmico');
  }));
  for (const user of [client, reception, opto]) {
    await t.test(`non-admin ${user} cannot write catalog`, () => denied(() => as('authenticated', user, () => insert('frames', { ...frame, sku: 'FORBIDDEN' }))));
  }
  await t.test('reception sees contact data and appointments, never clinical details', () => as('authenticated', reception, async () => {
    assert.equal(await count('patients'), 2);
    assert.equal(await count('appointments'), 1);
    assert.equal(await count('clinical_records'), 0);
    assert.equal(await count('prescriptions'), 0);
  }));
  await t.test('reception can register patients', () => as('authenticated', reception, () => insert('patients', { full_name: 'New patient' })));
  await t.test('client cannot claim another patient by changing profile_id', () => as('authenticated', client, async () => {
    assert.equal((await rows(`update public.patients set profile_id='${client}' where id='${patient2}' returning id`)).length, 0);
  }));
  await t.test('client cannot create patient records', () => denied(() => as('authenticated', client, () => insert('patients', { full_name: 'Forged', profile_id: client }))));
  await t.test('reception cannot create clinical records', () => denied(() => as('authenticated', reception, () => insert('clinical_records', { patient_id: patient, optometrist_id: opto }))));
  await t.test('optometrist can read history and add own examination', () => as('authenticated', opto, async () => {
    assert.equal(await count('clinical_records'), 2);
    await insert('clinical_records', { patient_id: patient, optometrist_id: opto });
  }));
  await t.test('optometrist cannot impersonate another clinical author', () => denied(() => as('authenticated', opto, () => insert('clinical_records', { patient_id: patient, optometrist_id: opto2 }))));
  await t.test('optometrist cannot edit another author history', () => as('authenticated', opto, async () => {
    assert.equal((await rows(`update public.clinical_records set notes='Tampered' where id='${record2}' returning id`)).length, 0);
    assert.equal((await rows(`update public.prescriptions set sphere=1 where clinical_record_id='${record2}' returning id`)).length, 0);
  }));
  await t.test('clinical patient cannot be reassigned', () => denied(() => as('authenticated', opto, () => db.exec(`update public.clinical_records set patient_id='${patient2}' where id='${record}'`)), '23514'));
  await t.test('prescription cannot be moved to another examination', () => denied(() => as('authenticated', opto, () => db.exec(`update public.prescriptions set clinical_record_id='${record2}' where clinical_record_id='${record}'`)), '23514'));
  await t.test('client cannot write prescriptions', () => denied(() => as('authenticated', client, () => insert('prescriptions', { clinical_record_id: record, eye: 'OI', sphere: 0 }))));
  await t.test('optometrist can write own prescriptions', () => as('authenticated', opto, () => insert('prescriptions', { clinical_record_id: record, eye: 'OI', sphere: -1, cylinder: -0.5, axis: 90 })));

  const booking = { patient_id: patient, optometrist_id: opto, starts_at: '2099-01-01T11:00:00Z', ends_at: '2099-01-01T11:30:00Z' };
  await t.test('client can book an own appointment', () => as('authenticated', client, () => insert('appointments', booking)));
  await t.test('client cannot book for another patient', () => denied(() => as('authenticated', client, () => insert('appointments', { ...booking, patient_id: patient2 }))));
  await t.test('client cannot mark a new appointment completed', () => denied(() => as('authenticated', client, () => insert('appointments', { ...booking, status: 'completed' }))));
  await t.test('client cannot spoof appointment creator', () => denied(() => as('authenticated', client, () => insert('appointments', { ...booking, created_by: admin }))));
  await t.test('reception can book for any registered patient', () => as('authenticated', reception, () => insert('appointments', { ...booking, patient_id: patient2 })));
  await t.test('appointment must be assigned to an optometrist', () => denied(() => as('authenticated', reception, () => insert('appointments', { ...booking, optometrist_id: admin })), '23514'));
  await t.test('client can cancel an own upcoming appointment', () => as('authenticated', client, async () => {
    assert.equal((await rows(`update public.appointments set status='cancelled' where id='${appointment}' returning status`))[0].status, 'cancelled');
  }));
  await t.test('client cannot change the clinician while cancelling', () => denied(() => as('authenticated', client, () => db.exec(`update public.appointments set status='cancelled', optometrist_id='${opto2}' where id='${appointment}'`))));
  await t.test('client cannot confirm an own appointment', () => denied(() => as('authenticated', client, () => db.exec(`update public.appointments set status='confirmed' where id='${appointment}'`))));
  await t.test('unrelated client cannot cancel another appointment', () => as('authenticated', other, async () => {
    assert.equal((await rows(`update public.appointments set status='cancelled' where id='${appointment}' returning id`)).length, 0);
  }));
  await t.test('unassigned optometrist cannot read the appointment', () => as('authenticated', opto2, async () => assert.equal(await count('appointments'), 0)));
  await t.test('reception can confirm an appointment', () => as('authenticated', reception, () => db.exec(`update public.appointments set status='confirmed' where id='${appointment}'`)));
  await t.test('reception can complete appointments and clients cannot complete their own', async () => {
    await as('authenticated',reception,async () => {
      const result = await rows(`update public.appointments set status='completed' where id='${appointment}' and status in ('scheduled','confirmed') returning status`);
      assert.equal(result[0].status,'completed');
    });
    await denied(() => as('authenticated',client,() => db.exec(`update public.appointments set status='completed' where id='${appointment}'`)));
  });
  await t.test('overlapping clinician bookings are rejected', () => denied(() => as('authenticated', reception, () => insert('appointments', { ...booking, patient_id: patient2, starts_at: '2099-01-01T10:15Z', ends_at: '2099-01-01T10:45Z' })), '23P01'));
  await t.test('overlapping patient bookings with different clinicians are rejected', () => denied(() => as('authenticated', reception, () => insert('appointments', { ...booking, optometrist_id: opto2, starts_at: '2099-01-01T10:15Z', ends_at: '2099-01-01T10:45Z' })), '23P01'));
  await t.test('a conflicting reschedule fails and preserves the original slot', () => as('authenticated', reception, async () => {
    await insert('appointments',{...booking,patient_id:patient2,starts_at:'2099-01-01T09:00Z',ends_at:'2099-01-01T09:30Z'});
    await db.exec(`do $$ begin
      begin
        update public.appointments set starts_at='2099-01-01T09:15Z',ends_at='2099-01-01T09:45Z' where id='${appointment}';
        raise exception 'Expected scheduling conflict';
      exception when exclusion_violation then null;
      end;
    end $$;`);
    const original = (await rows(`select starts_at from public.appointments where id='${appointment}'`))[0];
    assert.equal(new Date(original.starts_at).toISOString(),'2099-01-01T10:00:00.000Z');
  }));
  await t.test('adjacent slots are allowed', () => as('authenticated', reception, () => insert('appointments', { ...booking, starts_at: '2099-01-01T10:30Z' })));
  await t.test('cancelling releases the slot', () => as('authenticated', reception, async () => {
    await db.exec(`update public.appointments set status='cancelled' where id='${appointment}'`);
    await insert('appointments', { ...booking, starts_at: '2099-01-01T10:00Z', ends_at: '2099-01-01T10:30Z' });
  }));
  await t.test('past appointment creation is rejected', () => denied(() => as('authenticated', reception, () => insert('appointments', { ...booking, starts_at: '2000-01-01T10:00Z', ends_at: '2000-01-01T10:30Z' })), '23514'));
  await t.test('end must follow start', () => denied(() => as('authenticated', reception, () => insert('appointments', { ...booking, ends_at: booking.starts_at })), '23514'));
  await t.test('NaN price and negative stock are rejected', async () => {
    await denied(() => as('authenticated', admin, () => insert('frames', { ...frame, sku: 'NAN', price: 'NaN' })), '23514');
    await denied(() => as('authenticated', admin, () => insert('frames', { ...frame, sku: 'STOCK', stock: -1 })), '23514');
  });
  await t.test('invalid frame measurements are rejected', () => denied(() => as('authenticated', admin, () => insert('frames', { ...frame, sku: 'BAD-MM', lens_width_mm: 0 })), '23514'));
  await t.test('duplicate SKU is rejected', () => denied(() => as('authenticated', admin, () => insert('frames', frame)), '23505'));
  await t.test('axis is required for nonzero cylinder', () => denied(() => as('authenticated', opto, () => insert('prescriptions', { clinical_record_id: record, eye: 'OI', sphere: 0, cylinder: -1 })), '23514'));
  await t.test('one prescription per eye per exam', () => denied(() => as('authenticated', opto, () => insert('prescriptions', { clinical_record_id: record, eye: 'OD', sphere: 0 })), '23505'));
  await t.test('clinical and appointment hard deletion is forbidden even for app admins', async () => {
    for (const table of ['patients', 'clinical_records', 'prescriptions', 'appointments']) await denied(() => as('authenticated', admin, () => db.exec(`delete from public.${table}`)));
  });
  await t.test('availability hides other patients while excluding their appointments', () => as('authenticated', reception, async () => {
    const day = (await rows("select ((now() at time zone 'America/Mexico_City')::date + 1)::text as day"))[0].day;
    await db.query(`insert into public.appointments(patient_id,optometrist_id,starts_at,ends_at)
      values ($1,$2,($3::date + time '10:00') at time zone 'America/Mexico_City',
                   ($3::date + time '10:30') at time zone 'America/Mexico_City')`, [patient2,opto,day]);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[client]);
    assert.equal((await rows(`select * from public.appointments where patient_id='${patient2}'`)).length,0);
    const result = await db.query('select * from public.get_available_slots($1,$2,30)',[day,opto]);
    assert.equal(result.rows.length,32);
    for (const slot of result.rows) {
      assert.deepEqual(Object.keys(slot).sort(),['ends_at','starts_at']);
      const start = new Date(slot.starts_at).toISOString();
      assert.ok(!['15:45','16:00','16:15'].includes(start.slice(11,16)));
    }
  }));
  await t.test('availability rejects dates outside the 90-day booking horizon', () => denied(() => as('authenticated', client, () => db.query('select * from public.get_available_slots($1,$2,30)',['2099-01-01',opto])), '23514'));
  await t.test('anonymous cannot query availability', () => denied(() => as('anon', null, () => db.query('select * from public.get_available_slots(current_date,$1,30)',[opto]))));
  await t.test('users without a profile cannot query availability', () => denied(() => as('authenticated', uid(999), () => db.query('select * from public.get_available_slots(current_date,$1,30)',[opto]))));
  await t.test('directory returns clinician IDs and names only', () => as('authenticated', client, async () => {
    const result = await rows('select * from public.list_optometrists()');
    assert.equal(result.length,2);
    assert.ok(result.every(r => Object.keys(r).sort().join(',') === 'full_name,id'));
  }));
  const clinicalPayload = { patient_id: patient, optometrist_id: opto, notes: 'Atomic exam' };
  await t.test('clinical RPC creates both eyes with the record in one transaction', () => as('authenticated', opto, async () => {
    const before = await count('clinical_records');
    const result = await db.query('select public.create_clinical_exam($1,$2) as exam',[clinicalPayload,[{ eye: 'OD',sphere: -1,pupillary_distance_mm:31.5,visual_acuity:'20/20' },{ eye: 'OI',sphere: -2,pupillary_distance_mm:30.5,visual_acuity:'20/25' }]]);
    assert.equal(await count('clinical_records'),before+1);
    assert.equal(result.rows[0].exam.prescriptions.length,2);
    assert.ok(result.rows[0].exam.prescriptions.every(p => p.clinical_record_id === result.rows[0].exam.record.id));
    assert.deepEqual(result.rows[0].exam.prescriptions.map(p => [p.eye,p.pupillary_distance_mm,p.visual_acuity]),[['OD',31.5,'20/20'],['OI',30.5,'20/25']]);
  }));
  await t.test('invalid second eye rolls back examination and first eye', () => as('authenticated', opto, async () => {
    const before = await count('clinical_records'), eyes = await count('prescriptions');
    await db.exec(`do $$ begin
      begin
        perform public.create_clinical_exam('${JSON.stringify(clinicalPayload)}'::jsonb,
          '[{"eye":"OD","sphere":-1},{"eye":"OI","sphere":99}]'::jsonb);
        raise exception 'Expected invalid prescription';
      exception when check_violation then null;
      end;
    end $$;`);
    assert.equal(await count('clinical_records'),before);
    assert.equal(await count('prescriptions'),eyes);
  }));
  await t.test('clinical RPC rejects client and reception', async () => {
    for (const user of [client,reception]) await denied(() => as('authenticated', user, () => db.query('select public.create_clinical_exam($1,$2)',[clinicalPayload,[{ eye:'OD',sphere:0 }]])));
  });
  await t.test('clinical RPC preserves RLS author checks', () => denied(() => as('authenticated', opto2, () => db.query('select public.create_clinical_exam($1,$2)',[clinicalPayload,[{ eye:'OD',sphere:0 }]]))));
  await t.test('trigger helpers have no public execution grants', async () => {
    const helpers = await rows("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.prorettype='trigger'::regtype and has_function_privilege('authenticated',p.oid,'EXECUTE')");
    assert.deepEqual(helpers, []);
  });
});
