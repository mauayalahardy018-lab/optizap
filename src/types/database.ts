// Keep in sync with supabase/migrations and API_CONTRACT.md.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
/** vendedor is the existing contract's reception/sales role. */
export type UserRole = "admin" | "optometrista" | "vendedor" | "cliente";
export type BrandCategory = "lujo" | "deportivo" | "moda" | "accesible" | "infantil";
export type FrameMaterial = "acetato" | "metal" | "titanio" | "tr90" | "mixto";
export type FrameShape = "rectangular" | "redondo" | "aviador" | "cat-eye" | "cuadrado" | "ovalado";
export type FrameGender = "unisex" | "hombre" | "mujer" | "infantil";
export type LensType = "monofocal" | "bifocal" | "progresivo";
export type LensMaterial = "cr39" | "policarbonato" | "trivex" | "alto_indice" | "mineral";
export type EyeSide = "OD" | "OI";
export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

type Timestamps = { created_at: string; updated_at: string };
export type UserProfile = Timestamps & {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
};
type BrandRow = Timestamps & {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  country: string | null;
  category: BrandCategory | null;
  is_active: boolean;
};
/** frames_count is a query projection, never a database column. */
export type Brand = BrandRow & { frames_count?: number };
type FrameRow = Timestamps & {
  id: string;
  brand_id: string;
  sku: string;
  name: string;
  material: FrameMaterial;
  shape: FrameShape;
  gender: FrameGender;
  color: string;
  lens_width_mm: number;
  bridge_width_mm: number;
  temple_length_mm: number;
  lens_height_mm: number | null;
  /** MXN per frame; PostgreSQL numeric(12,2). */
  price: number;
  currency: "MXN";
  stock: number;
  image_url: string | null;
  is_active: boolean;
};
/** brand is an optional joined projection, never a database column. */
export type Frame = FrameRow & { brand?: Brand };
export type Lens = Timestamps & {
  id: string;
  brand_id: string;
  sku: string;
  name: string;
  lens_type: LensType;
  material: LensMaterial;
  refractive_index: number;
  diameter_mm: number;
  coatings: string[];
  /** MXN per individual lens (not per pair). */
  price: number;
  currency: "MXN";
  stock: number;
  image_url: string | null;
  is_active: boolean;
};
export type Patient = Timestamps & {
  id: string;
  profile_id: string | null;
  full_name: string;
  /** YYYY-MM-DD; not a timestamp. */
  birth_date: string | null;
  phone: string | null;
  email: string | null;
};
export type ClinicalRecord = Timestamps & {
  id: string;
  patient_id: string;
  optometrist_id: string;
  examined_at: string;
  chief_complaint: string | null;
  medical_history: string | null;
  allergies: string | null;
  diagnosis: string | null;
  notes: string | null;
};
export type Prescription = Timestamps & {
  id: string;
  clinical_record_id: string;
  eye: EyeSide;
  sphere: number;
  cylinder: number;
  axis: number | null;
  addition: number;
  /** Monocular pupillary distance, in mm. */
  pupillary_distance_mm: number | null;
  visual_acuity: string | null;
};
export type Appointment = Timestamps & {
  id: string;
  patient_id: string;
  optometrist_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  reason: string | null;
  created_by: string | null;
};

type ForeignKey<Name extends string, Column extends string, Target extends string, One extends boolean = false> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: One;
  referencedRelation: Target;
  referencedColumns: ["id"];
};
type Table<Row, Required extends keyof Row, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

/** Supabase client schema. RLS and column grants still determine allowed writes. */
export type Database = {
  public: {
    Tables: {
      profiles: Table<UserProfile, "id" | "email">;
      brands: Table<BrandRow, "name" | "slug">;
      frames: Table<FrameRow, "brand_id" | "sku" | "name" | "material" | "shape" | "color" | "lens_width_mm" | "bridge_width_mm" | "temple_length_mm" | "price", [
        ForeignKey<"frames_brand_id_fkey", "brand_id", "brands">
      ]>;
      lenses: Table<Lens, "brand_id" | "sku" | "name" | "lens_type" | "material" | "refractive_index" | "diameter_mm" | "price", [
        ForeignKey<"lenses_brand_id_fkey", "brand_id", "brands">
      ]>;
      patients: Table<Patient, "full_name", [ForeignKey<"patients_profile_id_fkey", "profile_id", "profiles", true>]>;
      clinical_records: Table<ClinicalRecord, "patient_id" | "optometrist_id", [
        ForeignKey<"clinical_records_patient_id_fkey", "patient_id", "patients">,
        ForeignKey<"clinical_records_optometrist_id_fkey", "optometrist_id", "profiles">
      ]>;
      prescriptions: Table<Prescription, "clinical_record_id" | "eye" | "sphere", [
        ForeignKey<"prescriptions_clinical_record_id_fkey", "clinical_record_id", "clinical_records">
      ]>;
      appointments: Table<Appointment, "patient_id" | "optometrist_id" | "starts_at" | "ends_at", [
        ForeignKey<"appointments_patient_id_fkey", "patient_id", "patients">,
        ForeignKey<"appointments_optometrist_id_fkey", "optometrist_id", "profiles">,
        ForeignKey<"appointments_created_by_fkey", "created_by", "profiles">
      ]>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
      brand_category: BrandCategory;
      frame_material: FrameMaterial;
      frame_shape: FrameShape;
      frame_gender: FrameGender;
      lens_type: LensType;
      lens_material: LensMaterial;
      eye_side: EyeSide;
      appointment_status: AppointmentStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
export type TableName = keyof Database["public"]["Tables"];
export type Tables<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends TableName> = Database["public"]["Tables"][T]["Update"];
