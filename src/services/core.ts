import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiErrorCode, Database, Page, UserProfile, UserRole } from "../types/database";

export type Client = SupabaseClient<Database>;
export class ServiceError extends Error {
  constructor(public code: ApiErrorCode, message: string, public status: number) { super(message); }
}
export function invalid(message: string): never { throw new ServiceError("VALIDATION_ERROR", message, 400); }
export function fail(error: { code?: string } | null): void {
  if (!error) return;
  switch (error.code) {
    case "23P01": throw new ServiceError("SLOT_UNAVAILABLE", "El horario ya está ocupado para el paciente o el optometrista. Elige otro horario.", 409);
    case "23505": throw new ServiceError("CONFLICT", "Ya existe un registro con esos datos únicos.", 409);
    case "42501": throw new ServiceError("FORBIDDEN", "No tienes permiso para realizar esta operación.", 403);
    case "23503": case "23514": case "23502": case "22P02": case "22007": case "22008": case "22003":
      invalid("Los datos no cumplen las restricciones del registro.");
    default: throw new ServiceError("UNAVAILABLE", "No fue posible consultar o guardar los datos. Intenta nuevamente.", 503);
  }
}
export function found<T>(value: T | null): T {
  if (value === null) throw new ServiceError("NOT_FOUND", "Registro no encontrado o no disponible para tu cuenta.", 404);
  return value;
}
export async function currentProfile(db: Client): Promise<UserProfile | null> {
  const { data, error } = await db.auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 || error.status === 400) return null;
    throw new ServiceError("UNAVAILABLE", "No fue posible verificar la sesión.", 503);
  }
  if (!data.user || data.user.is_anonymous) return null;
  const result = await db.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  fail(result.error);
  return result.data;
}
export async function requireProfile(db: Client, roles?: readonly UserRole[]): Promise<UserProfile> {
  const profile = await currentProfile(db);
  if (!profile) throw new ServiceError("UNAUTHENTICATED", "Inicia sesión para continuar.", 401);
  if (roles && !roles.includes(profile.role)) throw new ServiceError("FORBIDDEN", "No tienes permiso para realizar esta operación.", 403);
  return profile;
}
export type Rule = (value: unknown, key: string) => unknown;
export const text = (max = 200): Rule => (v, k) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max) invalid(`${k}: texto inválido.`);
  return v.trim();
};
export const nullable = (rule: Rule): Rule => (v, k) => v === null ? null : rule(v, k);
export const number = (min: number, max: number, integer = false): Rule => (v, k) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) invalid(`${k}: número fuera del rango permitido.`);
  return v;
};
export const decimal = (min: number, max: number): Rule => (v, k) => {
  number(min,max)(v,k);
  if (Math.abs(Number(v)*100-Math.round(Number(v)*100)) > 0.0001) invalid(`${k}: máximo dos decimales.`);
  return v;
};
export const choice = (values: readonly string[]): Rule => (v, k) => {
  if (typeof v !== "string" || !values.includes(v)) invalid(`${k}: valor no permitido.`);
  return v;
};
export const boolean: Rule = (v, k) => { if (typeof v !== "boolean") invalid(`${k}: se requiere un booleano.`); return v; };
export const uuid: Rule = (v, k) => {
  if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) invalid(`${k}: UUID inválido.`);
  return v;
};
export const date: Rule = (v, k) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v) invalid(`${k}: fecha inválida.`);
  return v;
};
export const instant: Rule = (v, k) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) invalid(`${k}: fecha y hora con zona requeridas.`);
  date(v.slice(0,10), k);
  return new Date(v).toISOString();
};
export function parse<T>(input: unknown, rules: Record<string, Rule>, required: readonly string[] = []): T {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("Se requiere un objeto JSON.");
  const value = input as Record<string, unknown>;
  for (const key of required) if (!(key in value) || value[key] === undefined) invalid(`Falta el campo ${key}.`);
  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (!Object.hasOwn(rules, key)) invalid(`Campo no permitido: ${key}.`);
    if (val === undefined) invalid(`${key}: valor requerido.`);
    output[key] = rules[key](val, key);
  }
  return output as T;
}
export function pagination(input: Record<string, unknown>) {
  const limit = input.limit === undefined ? 25 : input.limit as number;
  const offset = input.offset === undefined ? 0 : input.offset as number;
  number(1,100,true)(limit,"limit"); number(0,100000,true)(offset,"offset");
  return { limit, offset };
}
export function page<T>(data: T[] | null, total: number | null, range: { limit: number; offset: number }): Page<T> {
  return { items: data ?? [], total: total ?? 0, ...range };
}
/** OR syntax accepts filter expressions: restrict the term before interpolating. */
export function searchTerm(value: unknown): string {
  const term = text(80)(value,"search") as string;
  if (!/^[\p{L}\p{N} _/-]+$/u.test(term)) invalid("La búsqueda admite letras, números, espacios, guiones y diagonales.");
  return term.replace(/_/g, "\\_");
}
export function checkInterval(start: string, end: string, now = Date.now()) {
  const a = Date.parse(start), b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= now || b <= a || b-a > 4*60*60*1000) invalid("La cita debe ser futura, con duración mayor a cero y máxima de cuatro horas.");
}
