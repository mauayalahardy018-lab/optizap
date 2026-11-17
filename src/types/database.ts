export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "optometrista" | "vendedor" | "cliente";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  country?: string | null;
  category?: "lujo" | "deportivo" | "moda" | "accesible" | "infantil";
  is_active: boolean;
  frames_count?: number;
  created_at: string;
}

export interface Frame {
  id: string;
  brand_id: string;
  brand?: Brand;
  sku: string;
  name: string;
  material: "acetato" | "metal" | "titanio" | "tr90" | "mixto";
  shape: "rectangular" | "redondo" | "aviador" | "cat-eye" | "cuadrado" | "ovalado";
  gender: "unisex" | "hombre" | "mujer" | "infantil";
  color: string;
  price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, "created_at"> & { created_at?: string };
        Update: Partial<UserProfile>;
      };
      brands: {
        Row: Brand;
        Insert: Omit<Brand, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Brand>;
      };
      frames: {
        Row: Frame;
        Insert: Omit<Frame, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Frame>;
      };
    };
  };
}
