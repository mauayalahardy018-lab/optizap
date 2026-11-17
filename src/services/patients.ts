import type { ClinicalExam, ClinicalExamInput, ClinicalHistory, EyePrescriptionInput, Json, PatientInput } from "../types/database";
import { choice, date, decimal, fail, found, instant, invalid, nullable, number, page, pagination, parse, requireProfile, searchTerm, text, uuid, type Client } from "./core";

const clinicalRoles = ["admin","optometrista"] as const;
const patientRules = { full_name: text(200), profile_id: nullable(uuid), birth_date: nullable(date), phone: nullable(text(40)), email: nullable(text(254)) };
const examRules = {
  patient_id: uuid, optometrist_id: uuid, examined_at: instant,
  chief_complaint: nullable(text(5000)), medical_history: nullable(text(10000)),
  allergies: nullable(text(5000)), diagnosis: nullable(text(10000)), notes: nullable(text(10000)),
};
const eyeRules = {
  eye: choice(["OD","OI"]), sphere: decimal(-30,30), cylinder: decimal(-12,12), axis: nullable(number(0,180,true)),
  addition: decimal(0,4), pupillary_distance_mm: nullable(decimal(20,45)), visual_acuity: nullable(text(100)),
};
export function createPatientService(db: Client) {
  return {
    async listPatients(input: Record<string, unknown> = {}) {
      await requireProfile(db,["admin","optometrista","vendedor"]);
      const range = pagination(input);
      const filters = parse<{ search?: string }>(Object.fromEntries(Object.entries(input).filter(([k]) => !["limit","offset"].includes(k))),{ search: v => searchTerm(v) });
      let query = db.from("patients").select("*",{ count: "exact" });
      if (filters.search) query = query.ilike("full_name",`%${filters.search}%`);
      const result = await query.order("full_name").order("id").range(range.offset,range.offset+range.limit-1);
      fail(result.error); return page(result.data,result.count,range);
    },
    async registerPatient(input: unknown) {
      await requireProfile(db,["admin","optometrista","vendedor"]);
      const payload = parse<PatientInput>(input,patientRules,["full_name"]);
      if (payload.birth_date && (payload.birth_date < "1900-01-01" || payload.birth_date > new Date().toISOString().slice(0,10))) invalid("La fecha de nacimiento está fuera del rango permitido.");
      if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) invalid("El correo electrónico es inválido.");
      const result = await db.from("patients").insert(payload).select("*").single();
      fail(result.error); return found(result.data);
    },
    async getHistory(patientId: string, input: Record<string, unknown> = {}) {
      uuid(patientId,"patient_id"); await requireProfile(db,["admin","optometrista","cliente"]);
      // RLS restricts client accounts to the linked patient before returning data.
      parse(input,{ limit: v => v, offset: v => v });
      const range = pagination(input);
      const patientResult = await db.from("patients").select("*").eq("id",patientId).maybeSingle();
      fail(patientResult.error); const patient = found(patientResult.data);
      const result = await db.from("clinical_records").select("*, prescriptions(*)",{ count: "exact" }).eq("patient_id",patientId)
        .order("examined_at",{ ascending: false }).order("id").range(range.offset,range.offset+range.limit-1);
      fail(result.error);
      return { patient, records: result.data ?? [], total: result.count ?? 0, ...range } satisfies ClinicalHistory;
    },
    async getMyHistory(input: Record<string, unknown> = {}) {
      const profile = await requireProfile(db,["cliente"]);
      const patientResult = await db.from("patients").select("id").eq("profile_id",profile.id).maybeSingle();
      fail(patientResult.error);
      return this.getHistory(found(patientResult.data).id,input);
    },
    async createClinicalExam(input: unknown): Promise<ClinicalExam> {
      await requireProfile(db,clinicalRoles);
      const payload = parse<ClinicalExamInput>(input,{
        record: v => parse(v,examRules,["patient_id","optometrist_id"]),
        prescriptions: v => {
          if (!Array.isArray(v) || v.length < 1 || v.length > 2) invalid("Registra uno o dos ojos.");
          const eyes = v.map(item => parse<EyePrescriptionInput>(item,eyeRules,["eye","sphere"]));
          if (new Set(eyes.map(e => e.eye)).size !== eyes.length) invalid("Cada ojo solo puede registrarse una vez por consulta.");
          for (const eye of eyes) if (eye.cylinder && eye.axis == null) invalid("El eje es obligatorio cuando el cilindro es distinto de cero.");
          return eyes;
        },
      },["record","prescriptions"]);
      const result = await db.rpc("create_clinical_exam",{ p_record: payload.record as Json, p_prescriptions: payload.prescriptions as Json });
      fail(result.error); return found(result.data) as unknown as ClinicalExam;
    },
  };
}
