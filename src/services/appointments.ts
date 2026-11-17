import type { AppointmentInput, RescheduleInput } from "../types/database";
import { checkInterval, date, fail, found, instant, invalid, nullable, number, page, pagination, parse, requireProfile, text, uuid, type Client } from "./core";

export function createAppointmentService(db: Client) {
  return {
    async listOptometrists() {
      await requireProfile(db);
      const result = await db.rpc("list_optometrists",{});
      fail(result.error); return result.data ?? [];
    },
    async getAvailableSlots(input: unknown) {
      await requireProfile(db);
      const payload = parse<{ date: string; optometrist_id: string; duration_minutes?: number }>(input,
        { date, optometrist_id: uuid, duration_minutes: number(15,240,true) },["date","optometrist_id"]);
      const duration = payload.duration_minutes ?? 30;
      if (duration % 15) invalid("La duración debe ser múltiplo de 15 minutos.");
      const result = await db.rpc("get_available_slots",{ p_date: payload.date, p_optometrist_id: payload.optometrist_id, p_duration_minutes: duration });
      fail(result.error); return result.data ?? [];
    },
    async listAppointments(input: Record<string, unknown> = {}) {
      await requireProfile(db);
      const range = pagination(input);
      const filters = parse<{ patient_id?: string; optometrist_id?: string; from?: string; to?: string }>(
        Object.fromEntries(Object.entries(input).filter(([k]) => !["limit","offset"].includes(k))),
        { patient_id: uuid, optometrist_id: uuid, from: instant, to: instant });
      if (filters.from && filters.to && filters.from >= filters.to) invalid("El rango de fechas es inválido.");
      let query = db.from("appointments").select("*",{ count: "exact" });
      if (filters.patient_id) query = query.eq("patient_id",filters.patient_id);
      if (filters.optometrist_id) query = query.eq("optometrist_id",filters.optometrist_id);
      if (filters.from) query = query.gte("starts_at",filters.from);
      if (filters.to) query = query.lt("starts_at",filters.to);
      const result = await query.order("starts_at").order("id").range(range.offset,range.offset+range.limit-1);
      fail(result.error); return page(result.data,result.count,range);
    },
    async createAppointment(input: unknown) {
      const profile = await requireProfile(db);
      const payload = parse<AppointmentInput>(input,{ patient_id: uuid, optometrist_id: uuid, starts_at: instant, ends_at: instant, reason: nullable(text(1000)) },["patient_id","optometrist_id","starts_at","ends_at"]);
      checkInterval(payload.starts_at,payload.ends_at);
      // EXCLUDE constraints, rather than a preflight read, arbitrate races.
      const result = await db.from("appointments").insert({ ...payload, created_by: profile.id }).select("*").single();
      fail(result.error); return found(result.data);
    },
    async rescheduleAppointment(id: string, input: unknown) {
      uuid(id,"id"); await requireProfile(db,["admin","vendedor","optometrista"]);
      const payload = parse<RescheduleInput>(input,{ starts_at: instant, ends_at: instant, optometrist_id: uuid },["starts_at","ends_at"]);
      checkInterval(payload.starts_at,payload.ends_at);
      const result = await db.from("appointments").update(payload).eq("id",id).in("status",["scheduled","confirmed"]).select("*").maybeSingle();
      fail(result.error); return found(result.data);
    },
    async cancelAppointment(id: string) {
      uuid(id,"id"); await requireProfile(db);
      const result = await db.from("appointments").update({ status: "cancelled" }).eq("id",id).in("status",["scheduled","confirmed"]).select("*").maybeSingle();
      fail(result.error); return found(result.data);
    },
  };
}
