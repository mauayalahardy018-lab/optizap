import { createBrowserClient } from "@supabase/ssr";
import type {
  ApiErrorCode,
  ApiResponse,
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  AvailableSlot,
  Brand,
  CatalogFilters,
  CatalogProduct,
  ClinicalExam,
  ClinicalExamInput,
  ClinicalHistory,
  Database,
  OptometristSummary,
  Page,
  Patient,
  PatientInput,
  ProductKind,
  RescheduleInput,
  UserProfile,
  UserRole,
} from "@/types/database";

export class FrontendApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status = 400) {
    super(message);
    this.name = "FrontendApiError";
    this.code = code;
    this.status = status;
  }
}

export function getBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("tu-proyecto.supabase.co")) {
    return null;
  }

  return createBrowserClient<Database>(url, key);
}

async function requestJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !payload || "error" in payload) {
    const code: ApiErrorCode =
      payload && "error" in payload ? payload.error.code : "INTERNAL_ERROR";
    const message =
      payload && "error" in payload
        ? payload.error.message
        : `Error HTTP ${res.status}`;
    throw new FrontendApiError(code, message, res.status);
  }

  return payload.data;
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// 1. Perfil y Usuarios
export async function fetchCurrentUserProfile(): Promise<UserProfile> {
  return requestJson<UserProfile>("/api/me/profile");
}

export async function fetchUsersApi(params?: {
  limit?: number;
  offset?: number;
}): Promise<Page<UserProfile>> {
  return requestJson<Page<UserProfile>>(`/api/users${buildQuery(params)}`);
}

export async function updateUserRoleApi(
  userId: string,
  role: UserRole
): Promise<UserProfile> {
  return requestJson<UserProfile>(`/api/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

// 2. Catálogo y Marcas
export async function fetchBrandsApi(): Promise<Brand[]> {
  return requestJson<Brand[]>("/api/brands");
}

export async function fetchBrandBySlugApi(slug: string): Promise<Brand> {
  return requestJson<Brand>(`/api/brands/${encodeURIComponent(slug)}`);
}

export async function fetchCatalogProductsApi(
  kind: ProductKind,
  filters?: CatalogFilters
): Promise<Page<CatalogProduct>> {
  const cleanSearch = filters?.search
    ? filters.search.replace(/[^A-Za-z0-9 _/-]/g, "").trim().slice(0, 80)
    : undefined;

  const query = buildQuery({
    brand_id: filters?.brand_id,
    category: filters?.category,
    segment: kind === "frames" ? filters?.segment : undefined,
    material: filters?.material,
    sort: filters?.sort,
    search: cleanSearch || undefined,
    min_price: filters?.min_price,
    max_price: filters?.max_price,
    include_inactive: filters?.include_inactive,
    limit: filters?.limit ?? 50,
    offset: filters?.offset ?? 0,
  });

  return requestJson<Page<CatalogProduct>>(`/api/catalog/${kind}${query}`);
}

export async function fetchProductBySkuApi(
  kind: ProductKind,
  sku: string
): Promise<CatalogProduct> {
  return requestJson<CatalogProduct>(
    `/api/catalog/${kind}/sku/${encodeURIComponent(sku)}`
  );
}

// 3. Citas y Disponibilidad
export async function fetchOptometristsApi(): Promise<OptometristSummary[]> {
  return requestJson<OptometristSummary[]>("/api/optometrists");
}

export async function fetchAvailableSlotsApi(params: {
  date: string;
  optometrist_id: string;
  duration_minutes?: number;
}): Promise<AvailableSlot[]> {
  return requestJson<AvailableSlot[]>(
    `/api/appointments/availability${buildQuery(params)}`
  );
}

export async function fetchAppointmentsApi(params?: {
  patient_id?: string;
  optometrist_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<Page<Appointment>> {
  return requestJson<Page<Appointment>>(
    `/api/appointments${buildQuery(params)}`
  );
}

export async function createAppointmentApi(
  input: AppointmentInput
): Promise<Appointment> {
  return requestJson<Appointment>("/api/appointments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function rescheduleAppointmentApi(
  id: string,
  input: RescheduleInput
): Promise<Appointment> {
  return requestJson<Appointment>(`/api/appointments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAppointmentStatusApi(
  id: string,
  status: Exclude<AppointmentStatus, "scheduled">
): Promise<Appointment> {
  return requestJson<Appointment>(
    `/api/appointments/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
}

export async function cancelAppointmentApi(id: string): Promise<Appointment> {
  return requestJson<Appointment>(
    `/api/appointments/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );
}

// 4. Pacientes y Expediente Clínico
export async function fetchPatientsApi(params?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Page<Patient>> {
  return requestJson<Page<Patient>>(`/api/patients${buildQuery(params)}`);
}

export async function registerPatientApi(
  input: PatientInput
): Promise<Patient> {
  return requestJson<Patient>("/api/patients", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchPatientHistoryApi(
  patientId: string,
  params?: { limit?: number; offset?: number }
): Promise<ClinicalHistory> {
  return requestJson<ClinicalHistory>(
    `/api/patients/${encodeURIComponent(patientId)}/history${buildQuery(params)}`
  );
}

export async function fetchMyHistoryApi(params?: {
  limit?: number;
  offset?: number;
}): Promise<ClinicalHistory> {
  return requestJson<ClinicalHistory>(`/api/me/history${buildQuery(params)}`);
}

export async function createClinicalExamApi(
  input: ClinicalExamInput
): Promise<ClinicalExam> {
  return requestJson<ClinicalExam>("/api/clinical-exams", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
