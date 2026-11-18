import type { ApiResponse } from "../types/database";
import { createCatalogService, productKind } from "./catalog";
import { createAppointmentService } from "./appointments";
import { createPatientService } from "./patients";
import { createUserService } from "./users";
import { createAuthService } from "./auth";
import { AUTH_CACHE_HEADERS, SupabaseConfigurationError } from "../lib/supabase/config";
import { invalid, ServiceError, type Client } from "./core";

function params(url: URL): Record<string, unknown> {
  const output: Record<string, unknown> = Object.create(null);
  for (const [key, value] of url.searchParams) {
    if (Object.hasOwn(output,key)) invalid(`Parámetro repetido: ${key}.`);
    if (["limit","offset","min_price","max_price","duration_minutes"].includes(key)) {
      if (!value.trim()) invalid(`${key}: número requerido.`);
      output[key] = Number(value);
    } else if (key === "include_inactive") {
      if (!["true","false"].includes(value)) invalid("include_inactive: booleano inválido.");
      output[key] = value === "true";
    } else output[key] = value;
  }
  return output;
}
function response(body: ApiResponse<unknown>, status = 200) {
  return Response.json(body,{ status, headers: { ...AUTH_CACHE_HEADERS, "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
}
async function body(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") invalid("Envía el cuerpo como application/json.");
  const raw = await request.text();
  if (raw.length > 65536) invalid("El cuerpo de la solicitud es demasiado grande.");
  try { return JSON.parse(raw); } catch { invalid("El cuerpo JSON es inválido."); }
}

/** Factory is injected for tests; production creates a fresh SSR client per request. */
export async function handleApi(request: Request, clientFactory: () => Promise<Client>): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (!["GET","POST","PATCH","DELETE"].includes(request.method)) return new Response(null,{ status: 405, headers: { Allow: "GET, POST, PATCH, DELETE" } });
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new ServiceError("FORBIDDEN","El origen de la solicitud no está permitido.",403);
      if (url.search) invalid("Las escrituras no aceptan parámetros de consulta.");
    }
    const path = url.pathname.replace(/^\/api\//,"").split("/");
    const db = await clientFactory();
    const catalog = createCatalogService(db), appointments = createAppointmentService(db), patients = createPatientService(db), users = createUserService(db);
    const method = request.method;
    const query = params(url);
    let data: unknown;
    let status = 200;
    if (path[0] === "auth" && path.length === 2) {
      const auth = createAuthService(db);
      if (path[1] === "login" && method === "POST") data = await auth.login(await body(request));
      else if (path[1] === "register" && method === "POST") {
        const result = await auth.register(await body(request));
        data = result; status = result.requires_email_confirmation ? 202 : 201;
      } else if (path[1] === "logout" && method === "POST") data = await auth.logout(request.body === null ? {} : await body(request));
      else if ((path[1] === "confirm" || path[1] === "callback") && method === "GET") {
        const location = path[1] === "confirm" ? await auth.confirmEmail(query) : await auth.exchangeCode(query);
        return new Response(null,{ status: 303, headers: { ...AUTH_CACHE_HEADERS, Location: location, "Referrer-Policy": "no-referrer", Vary: "Cookie" } });
      } else throw new ServiceError("NOT_FOUND","Ruta no encontrada.",404);
    } else if (path[0] === "brands" && path.length <= 2 && method === "GET") {
      if (Object.keys(query).length) invalid("Marcas no acepta parámetros de consulta.");
      data = path[1] ? await catalog.getBrandBySlug(decodeURIComponent(path[1])) : await catalog.getBrands();
    } else if (path[0] === "catalog" && path.length >= 2 && path.length <= 4) {
      const kind = productKind(path[1]);
      if (path.length === 2 && method === "GET") data = await catalog.listProducts(kind,query);
      else if (path.length === 2 && method === "POST") { data = await catalog.createProduct(kind,await body(request)); status = 201; }
      else if (path.length === 4 && path[2] === "sku" && method === "GET") data = await catalog.getProduct(kind,{ sku: decodeURIComponent(path[3]) });
      else if (path.length === 3 && method === "GET") data = await catalog.getProduct(kind,{ id: path[2] });
      else if (path.length === 3 && method === "PATCH") data = await catalog.updateProduct(kind,path[2],await body(request));
      else if (path.length === 3 && method === "DELETE") data = await catalog.deactivateProduct(kind,path[2]);
      else throw new ServiceError("NOT_FOUND","Ruta no encontrada.",404);
    } else if (path.join("/") === "optometrists" && method === "GET") {
      if (Object.keys(query).length) invalid("El directorio no acepta parámetros de consulta.");
      data = await appointments.listOptometrists();
    } else if (path[0] === "appointments") {
      if (path.length === 2 && path[1] === "availability" && method === "GET") data = await appointments.getAvailableSlots(query);
      else if (path.length === 1 && method === "GET") data = await appointments.listAppointments(query);
      else if (path.length === 1 && method === "POST") { data = await appointments.createAppointment(await body(request)); status = 201; }
      else if (path.length === 2 && method === "PATCH") data = await appointments.rescheduleAppointment(path[1],await body(request));
      else if (path.length === 2 && method === "DELETE") data = await appointments.cancelAppointment(path[1]);
      else if (path.length === 3 && path[2] === "status" && method === "PATCH") data = await appointments.updateAppointmentStatus(path[1],await body(request));
      else throw new ServiceError("NOT_FOUND","Ruta no encontrada.",404);
    } else if (path.join("/") === "me/history" && method === "GET") data = await patients.getMyHistory(query);
    else if (path.join("/") === "me/profile" && method === "GET") {
      if (Object.keys(query).length) invalid("El perfil no acepta parámetros de consulta.");
      data = await users.getCurrentUserProfile();
    } else if (path[0] === "patients") {
      if (path.length === 1 && method === "GET") data = await patients.listPatients(query);
      else if (path.length === 1 && method === "POST") { data = await patients.registerPatient(await body(request)); status = 201; }
      else if (path.length === 3 && path[2] === "history" && method === "GET") data = await patients.getHistory(path[1],query);
      else throw new ServiceError("NOT_FOUND","Ruta no encontrada.",404);
    } else if (path.join("/") === "clinical-exams" && method === "POST") {
      data = await patients.createClinicalExam(await body(request)); status = 201;
    } else if (path[0] === "users") {
      if (path.length === 1 && method === "GET") data = await users.listProfiles(query);
      else if (path.length === 3 && path[2] === "role" && method === "PATCH") data = await users.updateRole(path[1],await body(request));
      else throw new ServiceError("NOT_FOUND","Ruta no encontrada.",404);
    } else throw new ServiceError("NOT_FOUND","Ruta no encontrada.",404);
    return response({ data },status);
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) return response({ error: { code: "UNAVAILABLE", message: "El servicio no está disponible. Intenta nuevamente más tarde." } },503);
    if (error instanceof ServiceError) return response({ error: { code: error.code, message: error.message } },error.status);
    return response({ error: { code: "INTERNAL_ERROR", message: "Ocurrió un error inesperado. Intenta nuevamente." } },500);
  }
}
