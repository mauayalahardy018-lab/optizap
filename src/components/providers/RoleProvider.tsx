"use client";

import React, { createContext, useContext, useState } from "react";
import type {
  Appointment,
  AppointmentStatus,
  ClinicalRecord,
  Patient,
  Prescription,
  UserProfile,
  UserRole,
} from "@/types/database";
import {
  INITIAL_APPOINTMENTS,
  INITIAL_CLINICAL_RECORDS,
  INITIAL_PRESCRIPTIONS,
  INITIAL_USER_PROFILES,
  MOCK_PATIENTS,
} from "@/components/catalog/mockCatalogData";

interface NewAppointmentInput {
  patient_id?: string;
  optometrist_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
}

interface NewConsultationInput {
  patient_id: string;
  chief_complaint: string;
  medical_history: string;
  allergies: string;
  diagnosis: string;
  notes: string;
  od: {
    sphere: number;
    cylinder: number;
    axis: number | null;
    addition: number;
    pupillary_distance_mm: number;
    visual_acuity: string;
  };
  oi: {
    sphere: number;
    cylinder: number;
    axis: number | null;
    addition: number;
    pupillary_distance_mm: number;
    visual_acuity: string;
  };
}

interface RoleContextValue {
  currentUser: UserProfile;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  users: UserProfile[];
  updateUserRole: (userId: string, newRole: UserRole) => void;
  patients: Patient[];
  appointments: Appointment[];
  scheduleAppointment: (input: NewAppointmentInput) => Appointment;
  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus) => void;
  clinicalRecords: ClinicalRecord[];
  prescriptions: Prescription[];
  addClinicalConsultation: (input: NewConsultationInput) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const ROLE_DEFAULT_USER_IDS: Record<UserRole, string> = {
  admin: "u1000000-0000-4000-8000-000000000001",
  optometrista: "u1000000-0000-4000-8000-000000000002",
  cliente: "u1000000-0000-4000-8000-000000000003",
  vendedor: "u1000000-0000-4000-8000-000000000005",
};

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USER_PROFILES);
  const [activeRole, setActiveRoleState] = useState<UserRole>("admin");
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>(
    INITIAL_CLINICAL_RECORDS
  );
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(
    INITIAL_PRESCRIPTIONS
  );

  const currentUser =
    users.find((u) => u.id === ROLE_DEFAULT_USER_IDS[activeRole]) ??
    users.find((u) => u.role === activeRole) ??
    users[0];

  const setActiveRole = (role: UserRole) => {
    setActiveRoleState(role);
  };

  const updateUserRole = (userId: string, newRole: UserRole) => {
    const now = new Date().toISOString();
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, role: newRole, updated_at: now } : u
      )
    );
  };

  const scheduleAppointment = (input: NewAppointmentInput): Appointment => {
    const now = new Date().toISOString();
    const defaultPatientId =
      MOCK_PATIENTS.find((p) => p.profile_id === currentUser.id)?.id ??
      MOCK_PATIENTS[0].id;

    const newAppointment: Appointment = {
      id: `a1000000-0000-4000-8000-${Date.now().toString().slice(-12).padStart(12, "0")}`,
      patient_id: input.patient_id ?? defaultPatientId,
      optometrist_id: input.optometrist_id,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status: "scheduled",
      reason: input.reason,
      created_by: currentUser.id,
      created_at: now,
      updated_at: now,
    };

    setAppointments((prev) => [newAppointment, ...prev]);
    return newAppointment;
  };

  const updateAppointmentStatus = (
    appointmentId: string,
    status: AppointmentStatus
  ) => {
    const now = new Date().toISOString();
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === appointmentId ? { ...apt, status, updated_at: now } : apt
      )
    );
  };

  const addClinicalConsultation = (input: NewConsultationInput) => {
    const now = new Date().toISOString();
    const recordId = `c1000000-0000-4000-8000-${Date.now().toString().slice(-12).padStart(12, "0")}`;
    const optometristId =
      currentUser.role === "optometrista"
        ? currentUser.id
        : "u1000000-0000-4000-8000-000000000002";

    const newRecord: ClinicalRecord = {
      id: recordId,
      patient_id: input.patient_id,
      optometrist_id: optometristId,
      examined_at: now,
      chief_complaint: input.chief_complaint || null,
      medical_history: input.medical_history || null,
      allergies: input.allergies || null,
      diagnosis: input.diagnosis || null,
      notes: input.notes || null,
      created_at: now,
      updated_at: now,
    };

    const rxOD: Prescription = {
      id: `rx-od-${Date.now()}`,
      clinical_record_id: recordId,
      eye: "OD",
      sphere: input.od.sphere,
      cylinder: input.od.cylinder,
      axis: input.od.cylinder === 0 ? null : input.od.axis,
      addition: input.od.addition,
      pupillary_distance_mm: input.od.pupillary_distance_mm,
      visual_acuity: input.od.visual_acuity,
      created_at: now,
      updated_at: now,
    };

    const rxOI: Prescription = {
      id: `rx-oi-${Date.now() + 1}`,
      clinical_record_id: recordId,
      eye: "OI",
      sphere: input.oi.sphere,
      cylinder: input.oi.cylinder,
      axis: input.oi.cylinder === 0 ? null : input.oi.axis,
      addition: input.oi.addition,
      pupillary_distance_mm: input.oi.pupillary_distance_mm,
      visual_acuity: input.oi.visual_acuity,
      created_at: now,
      updated_at: now,
    };

    setClinicalRecords((prev) => [newRecord, ...prev]);
    setPrescriptions((prev) => [rxOD, rxOI, ...prev]);
  };

  return (
    <RoleContext.Provider
      value={{
        currentUser,
        activeRole: currentUser.role,
        setActiveRole,
        users,
        updateUserRole,
        patients: MOCK_PATIENTS,
        appointments,
        scheduleAppointment,
        updateAppointmentStatus,
        clinicalRecords,
        prescriptions,
        addClinicalConsultation,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole debe usarse dentro de RoleProvider");
  }
  return ctx;
}
