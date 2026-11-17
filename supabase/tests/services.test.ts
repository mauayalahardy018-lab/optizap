import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthSessionMissingError, createClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "../../src/types/database";
import { createCatalogService } from "../../src/services/catalog";
import { createAppointmentService } from "../../src/services/appointments";
import { createPatientService } from "../../src/services/patients";
import { createUserService } from "../../src/services/users";
import { checkInterval, currentProfile, date, fail, instant, ServiceError } from "../../src/services/core";
import { handleApi } from "../../src/services/http";

const id = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const frame = { brand_id: id, sku: "RB-TEST", name: "Modelo Test", material: "acetato", shape: "redondo", color: "Negro", lens_width_mm: 52, bridge_width_mm: 18, temple_length_mm: 140, price: 2500, stock: 5 };
const booking = { patient_id: id, optometrist_id: otherId, starts_at: "2099-01-01T10:00:00-06:00", ends_at: "2099-01-01T10:30:00-06:00" };
const clinical = { record: { patient_id: id, optometrist_id: otherId }, prescriptions: [{ eye: "OD", sphere: -1 },{ eye: "OI", sphere: -2, cylinder: -0.5, axis: 90 }] };
type Call = { url: URL; method: string; body: Record<string, unknown> | null };

// Real supabase-js query builders and HTTP encoding; only the transport and Auth
// verification are stubbed. SQL/RLS/RPC semantics are tested in schema.test.mjs.
function fixture(role: UserRole | null = "admin", responder?: (call: Call) => Response) {
  const calls: Call[] = [];
  const profile = { id, role, email: "test@example.test", full_name: "Test", avatar_url: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
  const db = createClient<Database>("https://example.supabase.co","public-test-key",{
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input,init) => {
      const req = new Request(input,init);
      const raw = await req.text();
      const call = { url: new URL(req.url), method: req.method, body: raw ? JSON.parse(raw) as Record<string, unknown> : null };
      calls.push(call);
      if (call.url.pathname.endsWith("/profiles") && call.url.searchParams.get("id") === `eq.${id}` && call.method === "GET") return Response.json([profile]);
      return responder?.(call) ?? Response.json([], { headers: { "Content-Range": "0-0/0" } });
    } },
  });
  db.auth.getUser = async () => role === null
    ? { data: { user: null }, error: new AuthSessionMissingError() }
    : { data: { user: { id, app_metadata: {}, user_metadata: { role: "admin" }, aud: "authenticated", created_at: "2026-01-01T00:00:00Z" } }, error: null };
  return { db, calls, profile };
}
const rejects = (fn: () => Promise<unknown>, code: string) => assert.rejects(fn, (e: unknown) => e instanceof ServiceError && e.code === code);

test("catalog combines brand, category, SKU/model search, prices and pagination", async () => {
  const { db,calls } = fixture(null,() => Response.json([{ id, ...frame }],{ headers: { "Content-Range":"10-10/11" } }));
  const result = await createCatalogService(db).listProducts("frames",{ brand_id:id, category:"lujo",search:"Ray-Ban 52",min_price:100,max_price:5000,limit:10,offset:10 });
  assert.equal(result.total,11); assert.equal(result.limit,10);
  const params = calls[0].url.searchParams;
  assert.equal(params.get("brand_id"),`eq.${id}`);
  assert.equal(params.get("brand.category"),"eq.lujo");
  assert.equal(params.get("brand.is_active"),"eq.true");
  assert.equal(params.get("or"),"(sku.ilike.%Ray-Ban 52%,name.ilike.%Ray-Ban 52%)");
  assert.deepEqual(params.getAll("price"),["gte.100","lte.5000"]);
  assert.equal(params.get("offset"),"10"); assert.equal(params.get("limit"),"10");
});
test("catalog preserves literal underscores and rejects PostgREST filter injection", async () => {
  const { db,calls } = fixture(null);
  await createCatalogService(db).listProducts("frames",{search:"RB_123"});
  assert.match(calls[0].url.searchParams.get("or")!,/RB\\_123/);
  await rejects(() => createCatalogService(db).listProducts("frames",{search:"x),is_active.eq.false"}),"VALIDATION_ERROR");
});
test("catalog details use exact SKU and UUID filters", async () => {
  const { db,calls } = fixture(null,() => Response.json([{ id,...frame }]));
  await createCatalogService(db).getProduct("frames",{ sku:"RB-TEST" });
  await createCatalogService(db).getProduct("frames",{ id });
  assert.equal(calls[0].url.searchParams.get("sku"),"eq.RB-TEST");
  assert.equal(calls[1].url.searchParams.get("id"),`eq.${id}`);
});
test("catalog unseen detail returns NOT_FOUND", async () => {
  const { db } = fixture(null);
  await rejects(() => createCatalogService(db).getProduct("lenses",{id}),"NOT_FOUND");
});
test("catalog limits and unknown filters are validated", async () => {
  const { db } = fixture(null);
  for (const filters of [{limit:0},{limit:101},{limit:true},{offset:-1},{min_price:50,max_price:10},{foo:"value"}]) await rejects(() => createCatalogService(db).listProducts("frames",filters),"VALIDATION_ERROR");
});
test("inactive catalog requires admin", async () => {
  for (const role of ["cliente","vendedor","optometrista"] as const) {
    const { db } = fixture(role);
    await rejects(() => createCatalogService(db).listProducts("frames",{include_inactive:true}),"FORBIDDEN");
  }
});
test("admin creates frames with validated fields", async () => {
  const { db,calls } = fixture("admin",call => Response.json({ id,...call.body }));
  const row = await createCatalogService(db).createProduct("frames",frame);
  assert.equal(row.id,id);
  assert.deepEqual(calls.find(c => c.method === "POST")?.body,frame);
});
test("admin creates lenses and edits price and stock", async () => {
  const { db,calls } = fixture("admin",call => Response.json({ id,...call.body }));
  const api = createCatalogService(db);
  await api.createProduct("lenses",{brand_id:id,sku:"ZEISS-1",name:"Mica",material:"cr39",lens_type:"monofocal",refractive_index:1.5,diameter_mm:70,price:700});
  await api.updateProduct("lenses",id,{price:800,stock:10});
  assert.deepEqual(calls.at(-1)?.body,{price:800,stock:10});
  assert.equal(calls.at(-1)?.url.searchParams.get("id"),`eq.${id}`);
});
test("catalog deletion is a soft deactivation", async () => {
  const { db,calls } = fixture("admin",call => Response.json({ id,...call.body }));
  await createCatalogService(db).deactivateProduct("frames",id);
  assert.equal(calls.at(-1)?.method,"PATCH");
  assert.deepEqual(calls.at(-1)?.body,{is_active:false});
});
for (const role of ["cliente","vendedor","optometrista"] as const) {
  test(`${role} cannot create, update or deactivate products`,async () => {
    const { db,calls } = fixture(role); const api = createCatalogService(db);
    await rejects(() => api.createProduct("frames",frame),"FORBIDDEN");
    await rejects(() => api.updateProduct("frames",id,{stock:0}),"FORBIDDEN");
    await rejects(() => api.deactivateProduct("lenses",id),"FORBIDDEN");
    assert.ok(calls.every(c => c.method === "GET"));
  });
}
test("catalog rejects mass assignment, NaN, invalid dimensions and fractional money",async () => {
  const { db } = fixture(); const api = createCatalogService(db);
  for (const input of [{id,...frame},{...frame,stock:-1},{...frame,price:NaN},{...frame,price:1.001},{...frame,lens_width_mm:0}]) await rejects(() => api.createProduct("frames",input),"VALIDATION_ERROR");
  await rejects(() => api.updateProduct("frames",id,{}),"VALIDATION_ERROR");
});
test("appointment creation sets verified caller as creator and normalizes offsets", async () => {
  const { db,calls } = fixture("cliente",call => Response.json({id,...call.body}));
  await createAppointmentService(db).createAppointment(booking);
  assert.equal(calls.at(-1)?.body?.created_by,id);
  assert.equal(calls.at(-1)?.body?.starts_at,"2099-01-01T16:00:00.000Z");
});
test("appointment creation rejects spoofed creator and status", async () => {
  const { db } = fixture("cliente"); const api = createAppointmentService(db);
  await rejects(() => api.createAppointment({...booking,created_by:otherId}),"VALIDATION_ERROR");
  await rejects(() => api.createAppointment({...booking,status:"completed"}),"VALIDATION_ERROR");
});
test("appointments reject past, unzoned, reversed and overlong intervals",async () => {
  const { db } = fixture("vendedor"); const api = createAppointmentService(db);
  for (const item of [ {...booking,starts_at:"2000-01-01T10:00:00Z"}, {...booking,starts_at:"2099-01-01T10:00:00"}, {...booking,ends_at:booking.starts_at}, {...booking,ends_at:"2099-01-01T18:00:00-06:00"} ]) await rejects(() => api.createAppointment(item),"VALIDATION_ERROR");
});
test("database exclusion violation becomes a clear conflict",async () => {
  const { db } = fixture("vendedor",() => Response.json({code:"23P01",message:"private patient data"},{status:409}));
  await assert.rejects(() => createAppointmentService(db).createAppointment(booking),(e: unknown) => e instanceof ServiceError && e.status===409 && e.code==="SLOT_UNAVAILABLE" && !e.message.includes("private"));
  await rejects(() => createAppointmentService(db).rescheduleAppointment(id,{ starts_at:booking.starts_at,ends_at:booking.ends_at }),"SLOT_UNAVAILABLE");
});
test("reception can reschedule active appointments without changing creator", async () => {
  const { db,calls } = fixture("vendedor",call => Response.json({id,...call.body}));
  await createAppointmentService(db).rescheduleAppointment(id,{starts_at:booking.starts_at,ends_at:booking.ends_at});
  assert.equal(calls.at(-1)?.method,"PATCH");
  assert.equal(calls.at(-1)?.url.searchParams.get("status"),"in.(scheduled,confirmed)");
  assert.ok(!Object.hasOwn(calls.at(-1)!.body!,"created_by"));
});
test("clients cannot reschedule",async () => {
  const { db } = fixture("cliente");
  await rejects(() => createAppointmentService(db).rescheduleAppointment(id,booking),"FORBIDDEN");
});
test("cancellation updates only status",async () => {
  const { db,calls } = fixture("cliente",call => Response.json({id,...call.body}));
  await createAppointmentService(db).cancelAppointment(id);
  assert.deepEqual(calls.at(-1)?.body,{status:"cancelled"});
});
test("an invisible cancellation cannot be reported as successful",async () => {
  const { db } = fixture("cliente",() => Response.json(null));
  await rejects(() => createAppointmentService(db).cancelAppointment(id),"NOT_FOUND");
});
test("availability uses minimal RPC, not an RLS-filtered appointment scan",async () => {
  const { db,calls } = fixture("cliente",() => Response.json([]));
  await createAppointmentService(db).getAvailableSlots({date:"2099-01-01",optometrist_id:otherId});
  assert.equal(calls.at(-1)?.url.pathname,"/rest/v1/rpc/get_available_slots");
  assert.deepEqual(calls.at(-1)?.body,{p_date:"2099-01-01",p_optometrist_id:otherId,p_duration_minutes:30});
  assert.ok(!calls.some(c => c.url.pathname.endsWith("/appointments")));
});
test("availability validates date and duration",async () => {
  const { db } = fixture(); const api = createAppointmentService(db);
  for (const input of [{date:"2026-02-30",optometrist_id:id},{date:"2099-01-01",optometrist_id:id,duration_minutes:17}]) await rejects(() => api.getAvailableSlots(input),"VALIDATION_ERROR");
});
test("clinical staff register patients and reject future birth dates",async () => {
  for (const role of ["admin","optometrista","vendedor"] as const) {
    const { db,calls } = fixture(role,call => Response.json({id,...call.body}));
    await createPatientService(db).registerPatient({full_name:"Paciente",birth_date:"2000-02-29"});
    assert.equal(calls.at(-1)?.url.pathname,"/rest/v1/patients");
    await rejects(() => createPatientService(db).registerPatient({full_name:"Paciente",birth_date:"2099-01-01"}),"VALIDATION_ERROR");
  }
});
test("clients cannot register patients or list all patients",async () => {
  const { db } = fixture("cliente"); const api = createPatientService(db);
  await rejects(() => api.registerPatient({full_name:"Client"}),"FORBIDDEN");
  await rejects(() => api.listPatients(),"FORBIDDEN");
});
test("clinical service sends record and both eyes through one atomic RPC",async () => {
  const { db,calls } = fixture("optometrista",() => Response.json({record:{id},prescriptions:[{eye:"OD"},{eye:"OI"}]}));
  const exam = await createPatientService(db).createClinicalExam(clinical);
  assert.equal(exam.prescriptions.length,2);
  const writes = calls.filter(c => c.method === "POST");
  assert.equal(writes.length,1); assert.equal(writes[0].url.pathname,"/rest/v1/rpc/create_clinical_exam");
  assert.deepEqual(writes[0].body,{p_record:clinical.record,p_prescriptions:clinical.prescriptions});
});
test("clinical input rejects duplicate eyes, invalid sphere and missing axis",async () => {
  const { db } = fixture("optometrista"); const api = createPatientService(db);
  for (const prescriptions of [[],[{eye:"OD",sphere:0},{eye:"OD",sphere:1}],[{eye:"OI",sphere:99}],[{eye:"OD",sphere:0.001}],[{eye:"OI",sphere:0,cylinder:-1}],[{eye:"OD",sphere:0,axis:181}]]) await rejects(() => api.createClinicalExam({...clinical,prescriptions}),"VALIDATION_ERROR");
});
for (const role of ["cliente","vendedor"] as const) {
  test(`${role} cannot write clinical records`,async () => {
    const { db } = fixture(role);
    await rejects(() => createPatientService(db).createClinicalExam(clinical),"FORBIDDEN");
  });
}
test("reception cannot read clinical history through services",async () => {
  const { db } = fixture("vendedor");
  await rejects(() => createPatientService(db).getHistory(id),"FORBIDDEN");
});
test("patient history is paginated and includes eye prescriptions",async () => {
  const { db,calls } = fixture("optometrista",call => call.url.pathname.endsWith("/patients") ? Response.json([{id,full_name:"Patient"}]) : Response.json([{id,prescriptions:[]}],{headers:{"Content-Range":"0-0/1"}}));
  const result = await createPatientService(db).getHistory(id,{limit:10});
  assert.equal(result.records.length,1); assert.equal(result.total,1);
  assert.equal(calls.at(-1)?.url.searchParams.get("patient_id"),`eq.${id}`);
  assert.equal(calls.at(-1)?.url.searchParams.get("select"),"*,prescriptions(*)");
});
test("own history resolves patient by verified profile and only reads",async () => {
  const { db,calls } = fixture("cliente",call => call.url.pathname.endsWith("/patients") ? Response.json([{id:otherId,full_name:"Own"}]) : Response.json([]));
  await createPatientService(db).getMyHistory();
  assert.ok(calls.some(c => c.url.searchParams.get("profile_id") === `eq.${id}`));
  assert.ok(calls.every(c => c.method === "GET"));
});
test("non-admins cannot list profiles or change roles",async () => {
  for (const role of ["cliente","vendedor","optometrista"] as const) {
    const { db,calls } = fixture(role); const api = createUserService(db);
    await rejects(() => api.listProfiles(),"FORBIDDEN");
    await rejects(() => api.updateRole(otherId,{role:"admin"}),"FORBIDDEN");
    assert.ok(calls.every(c => c.method === "GET"));
  }
});
test("admin role updates whitelist fields and filter target ID",async () => {
  const { db,calls } = fixture("admin",call => Response.json({id:otherId,...call.body}));
  const api = createUserService(db);
  await api.updateRole(otherId,{role:"vendedor"});
  assert.deepEqual(calls.at(-1)?.body,{role:"vendedor"});
  assert.equal(calls.at(-1)?.url.searchParams.get("id"),`eq.${otherId}`);
  await rejects(() => api.updateRole(otherId,{role:"recepcion"}),"VALIDATION_ERROR");
  await rejects(() => api.updateRole(otherId,{role:"admin",email:"forged"}),"VALIDATION_ERROR");
});
test("anonymous private operations return UNAUTHENTICATED",async () => {
  const { db } = fixture(null);
  await rejects(() => createUserService(db).listProfiles(),"UNAUTHENTICATED");
  await rejects(() => createAppointmentService(db).createAppointment(booking),"UNAUTHENTICATED");
});
test("editable auth metadata never overrides stored profile role",async () => {
  const { db } = fixture("cliente");
  assert.equal((await currentProfile(db))?.role,"cliente");
});
test("SQL errors have stable sanitized service codes",() => {
  for (const [code, expected] of [["23505","CONFLICT"],["23503","VALIDATION_ERROR"],["23514","VALIDATION_ERROR"],["42501","FORBIDDEN"],["unknown","UNAVAILABLE"]]) assert.throws(() => fail({code}),e => e instanceof ServiceError && e.code===expected);
});
test("dates reject invalid leap days and missing timezone",() => {
  assert.throws(() => date("2025-02-29","date"),ServiceError);
  assert.throws(() => instant("2099-01-01T10:00:00","date"),ServiceError);
  assert.throws(() => checkInterval(booking.starts_at,booking.starts_at),ServiceError);
});

function request(path: string, method = "GET", payload?: unknown, headers: Record<string,string> = {}) {
  return new Request(`https://optizap.test/api/${path}`,{method,headers:{...(payload===undefined?{}:{"Content-Type":"application/json"}),...headers},...(payload===undefined?{}:{body:JSON.stringify(payload)})});
}
test("HTTP list responses use the documented envelope and no-store",async () => {
  const { db } = fixture(null);
  const result = await handleApi(request("catalog/frames?limit=10&min_price=0"),async () => db);
  assert.equal(result.status,200); assert.match(result.headers.get("cache-control")!,/no-store/);
  assert.deepEqual(await result.json(),{data:{items:[],total:0,limit:10,offset:0}});
});
test("HTTP validates JSON and protects writes against cross-origin requests",async () => {
  let clients = 0; const { db,calls } = fixture();
  const factory = async () => { clients++; return db; };
  const cross = await handleApi(request("catalog/frames","POST",frame,{Origin:"https://evil.test"}),factory);
  assert.equal(cross.status,403); assert.equal(clients,0);
  const malformed = await handleApi(new Request("https://optizap.test/api/catalog/frames",{method:"POST",body:"{",headers:{"Content-Type":"application/json"}}),factory);
  assert.equal(malformed.status,400);
  const wrongType = await handleApi(new Request("https://optizap.test/api/catalog/frames",{method:"POST",body:"{}",headers:{"Content-Type":"text/plain"}}),factory);
  assert.equal(wrongType.status,400); assert.equal(calls.length,0);
});
test("HTTP catalog creation returns 201",async () => {
  const { db } = fixture("admin",call => Response.json({id,...call.body}));
  const result = await handleApi(request("catalog/frames","POST",frame),async () => db);
  assert.equal(result.status,201); assert.equal((await result.json()).data.id,id);
});
test("HTTP maps a booking race to 409 SLOT_UNAVAILABLE",async () => {
  const { db } = fixture("cliente",() => Response.json({code:"23P01",message:"secret"},{status:409}));
  const result = await handleApi(request("appointments","POST",booking),async () => db);
  assert.equal(result.status,409); assert.equal((await result.json()).error.code,"SLOT_UNAVAILABLE");
});
test("HTTP anonymous role edits return 401 and duplicates are rejected",async () => {
  const { db } = fixture(null);
  assert.equal((await handleApi(request(`users/${id}/role`,"PATCH",{role:"admin"}),async () => db)).status,401);
  assert.equal((await handleApi(request("catalog/frames?limit=1&limit=2"),async () => db)).status,400);
});
test("HTTP unknown routes and internal errors are sanitized",async () => {
  const { db } = fixture();
  assert.equal((await handleApi(request("not-a-route"),async () => db)).status,404);
  const result = await handleApi(request("users"),async () => { throw new Error("secret credentials"); });
  assert.equal(result.status,500); assert.ok(!(await result.text()).includes("secret"));
});
