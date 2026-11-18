"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type {
  Appointment,
  AppointmentStatus,
  ClinicalRecord,
  OptometristSummary,
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
import {
  FrontendApiError,
  createAppointmentApi,
  createClinicalExamApi,
  fetchAppointmentsApi,
  fetchCurrentUserProfile,
  fetchMyHistoryApi,
  fetchOptometristsApi,
  fetchPatientHistoryApi,
  fetchPatientsApi,
  fetchUsersApi,
  getBrowserSupabaseClient,
  updateAppointmentStatusApi,
  updateUserRoleApi,
} from "./apiClient";

export interface NewAppointmentInput {
  patient_id?: string;
  optometrist_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
}

export interface NewConsultationInput {
  patient_id: string;
  optometrist_id?: string;
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
  isDemoMode: boolean;
  isLoadingSession: boolean;
  setActiveRole: (role: UserRole) => void;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  users: UserProfile[];
  optometrists: OptometristSummary[];
  updateUserRole: (userId: string, newRole: UserRole) => Promise<UserProfile>;
  patients: Patient[];
  myPatient: Patient | null;
  appointments: Appointment[];
  scheduleAppointment: (input: NewAppointmentInput) => Promise<Appointment>;
  updateAppointmentStatus: (
    appointmentId: string,
    status: Exclude<AppointmentStatus, "scheduled">
  ) => Promise<Appointment>;
  clinicalRecords: ClinicalRecord[];
  prescriptions: Prescription[];
  loadPatientHistory: (patientId: string) => Promise<void>;
  addClinicalConsultation: (input: NewConsultationInput) => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const ROLE_DEFAULT_USER_IDS: Record<UserRole, string> = {
  admin: "10000000-0000-4000-8000-000000000001",
  optometrista: "10000000-0000-4000-8000-000000000002",
  cliente: "10000000-0000-4000-8000-000000000003",
  vendedor: "10000000-0000-4000-8000-000000000005",
};

function hasTimeOverlap(
  aStartIso: string,
  aEndIso: string,
  bStartIso: string,
  bEndIso: string
): boolean {
  const aStart = new Date(aStartIso).getTime();
  const aEnd = new Date(aEndIso).getTime();
  const bStart = new Date(bStartIso).getTime();
  const bEnd = new Date(bEndIso).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [sessionProfile, setSessionProfile] = useState<UserProfile | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [demoRole, setDemoRole] = useState<UserRole>("admin");

  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USER_PROFILES);
  const [optometrists, setOptometrists] = useState<OptometristSummary[]>(() =>
    INITIAL_USER_PROFILES.filter((u) => u.role === "optometrista").map((u) => ({
      id: u.id,
      full_name: u.full_name,
    }))
  );
  const [patients, setPatients] = useState<Patient[]>(MOCK_PATIENTS);
  const [myPatient, setMyPatient] = useState<Patient | null>(MOCK_PATIENTS[0]);
  const [appointments, setAppointments] = useState<Appointment[]>(
    INITIAL_APPOINTMENTS
  );
  const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>(
    INITIAL_CLINICAL_RECORDS
  );
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(
    INITIAL_PRESCRIPTIONS
  );

  const isDemoMode = sessionProfile === null;

  const currentUser: UserProfile =
    sessionProfile ??
    users.find((u) => u.id === ROLE_DEFAULT_USER_IDS[demoRole]) ??
    users.find((u) => u.role === demoRole) ??
    users[0];

  const activeRole: UserRole = currentUser.role;

  const syncDataForProfile = useCallback(async (profile: UserProfile) => {
    try {
      const [optList, aptPage] = await Promise.all([
        fetchOptometristsApi().catch(() => null),
        fetchAppointmentsApi({ limit: 50 }).catch(() => null),
      ]);

      if (optList && optList.length > 0) {
        setOptometrists(optList);
      }
      if (aptPage) {
        setAppointments(aptPage.items);
      }

      if (profile.role === "admin") {
        const usersPage = await fetchUsersApi({ limit: 100 }).catch(() => null);
        if (usersPage) {
          setUsers(usersPage.items);
        }
      }

      if (
        profile.role === "admin" ||
        profile.role === "optometrista" ||
        profile.role === "vendedor"
      ) {
        const patPage = await fetchPatientsApi({ limit: 100 }).catch(() => null);
        if (patPage && patPage.items.length > 0) {
          setPatients(patPage.items);
          if (profile.role === "admin" || profile.role === "optometrista") {
            const firstHistory = await fetchPatientHistoryApi(
              patPage.items[0].id
            ).catch(() => null);
            if (firstHistory) {
              setClinicalRecords(
                firstHistory.records.map(
                  ({ prescriptions: _rx, ...rec }) => rec
                )
              );
              setPrescriptions(
                firstHistory.records.flatMap((r) => r.prescriptions)
              );
            }
          }
        }
      } else if (profile.role === "cliente") {
        const myHist = await fetchMyHistoryApi({ limit: 50 }).catch(() => null);
        if (myHist) {
          setMyPatient(myHist.patient);
          setPatients([myHist.patient]);
          setClinicalRecords(
            myHist.records.map(({ prescriptions: _rx, ...rec }) => rec)
          );
          setPrescriptions(myHist.records.flatMap((r) => r.prescriptions));
        }
      }
    } catch {
      // Mantiene datos existentes si ocurre error de red inesperado
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setIsLoadingSession(true);
    try {
      const profile = await fetchCurrentUserProfile();
      setSessionProfile(profile);
      await syncDataForProfile(profile);
    } catch {
      setSessionProfile(null);
    } finally {
      setIsLoadingSession(false);
    }
  }, [syncDataForProfile]);

  useEffect(() => {
    void refreshSession();

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshSession]);

  const setActiveRole = (role: UserRole) => {
    if (!isDemoMode) return;
    setDemoRole(role);
  };

  const signInWithPassword = async (email: string, password: string) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      throw new FrontendApiError(
        "UNAVAILABLE",
        "Supabase Auth no está configurado en las variables de entorno (.env). Usa el selector de Modo Demo.",
        503
      );
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new FrontendApiError("UNAUTHENTICATED", error.message, 401);
    }
    await refreshSession();
  };

  const signOut = async () => {
    const supabase = getBrowserSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSessionProfile(null);
  };

  const loadPatientHistory = useCallback(
    async (patientId: string) => {
      if (activeRole === "vendedor") {
        return;
      }
      try {
        const history =
          activeRole === "cliente"
            ? await fetchMyHistoryApi({ limit: 50 })
            : await fetchPatientHistoryApi(patientId, { limit: 50 });

        setClinicalRecords((prev) => {
          const otherPatients = prev.filter((r) => r.patient_id !== patientId);
          const loadedRecords = history.records.map(
            ({ prescriptions: _rx, ...rec }) => rec
          );
          return [...loadedRecords, ...otherPatients];
        });
        setPrescriptions((prev) => {
          const loadedRecordIds = new Set(history.records.map((r) => r.id));
          const otherRx = prev.filter(
            (rx) => !loadedRecordIds.has(rx.clinical_record_id)
          );
          const loadedRx = history.records.flatMap((r) => r.prescriptions);
          return [...loadedRx, ...otherRx];
        });
      } catch (err) {
        if (
          err instanceof FrontendApiError &&
          (err.code === "UNAUTHENTICATED" || err.code === "UNAVAILABLE") &&
          isDemoMode
        ) {
          return;
        }
        throw err;
      }
    },
    [activeRole, isDemoMode]
  );

  const updateUserRole = async (
    userId: string,
    newRole: UserRole
  ): Promise<UserProfile> => {
    try {
      const updated = await updateUserRoleApi(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setOptometrists((prev) => {
        if (updated.role === "optometrista") {
          const exists = prev.some((o) => o.id === updated.id);
          return exists
            ? prev
            : [...prev, { id: updated.id, full_name: updated.full_name }];
        }
        return prev.filter((o) => o.id !== updated.id);
      });
      return updated;
    } catch (err) {
      if (
        err instanceof FrontendApiError &&
        (err.code === "UNAUTHENTICATED" || err.code === "UNAVAILABLE") &&
        isDemoMode
      ) {
        if (activeRole !== "admin") {
          throw new FrontendApiError(
            "FORBIDDEN",
            "No tienes permisos para realizar esta operación.",
            403
          );
        }
        const now = new Date().toISOString();
        let updatedProfile: UserProfile | undefined;
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === userId) {
              updatedProfile = { ...u, role: newRole, updated_at: now };
              return updatedProfile;
            }
            return u;
          })
        );
        if (!updatedProfile) {
          throw new FrontendApiError(
            "NOT_FOUND",
            "El recurso solicitado no existe o no está disponible.",
            404
          );
        }
        return updatedProfile;
      }
      throw err;
    }
  };

  const scheduleAppointment = async (
    input: NewAppointmentInput
  ): Promise<Appointment> => {
    const resolvedPatientId =
      input.patient_id ??
      (activeRole === "cliente"
        ? myPatient?.id ??
        patients.find((p) => p.profile_id === currentUser.id)?.id
        : patients[0]?.id) ??
      MOCK_PATIENTS[0].id;

    try {
      const created = await createAppointmentApi({
        patient_id: resolvedPatientId,
        optometrist_id: input.optometrist_id,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        reason: input.reason,
      });
      setAppointments((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      if (
        err instanceof FrontendApiError &&
        (err.code === "UNAUTHENTICATED" || err.code === "UNAVAILABLE") &&
        isDemoMode
      ) {
        // Verificar conflicto de traslape [starts_at, ends_at) igual que la restricción GiST 23P01 del backend
        const conflict = appointments.some(
          (apt) =>
            apt.status !== "cancelled" &&
            (apt.optometrist_id === input.optometrist_id ||
              apt.patient_id === resolvedPatientId) &&
            hasTimeOverlap(
              apt.starts_at,
              apt.ends_at,
              input.starts_at,
              input.ends_at
            )
        );

        if (conflict) {
          throw new FrontendApiError(
            "SLOT_UNAVAILABLE",
            "El horario ya está ocupado para el paciente o el optometrista. Elige otro horario.",
            409
          );
        }

        const now = new Date().toISOString();
        const hexSuffix = Date.now()
          .toString(16)
          .slice(-12)
          .padStart(12, "0");
        const newAppointment: Appointment = {
          id: `a1000000-0000-4000-8000-${hexSuffix}`,
          patient_id: resolvedPatientId,
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
      }
      throw err;
    }
  };

  const updateAppointmentStatus = async (
    appointmentId: string,
    status: Exclude<AppointmentStatus, "scheduled">
  ): Promise<Appointment> => {
    try {
      const updated = await updateAppointmentStatusApi(appointmentId, status);
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === appointmentId ? updated : apt))
      );
      return updated;
    } catch (err) {
      if (
        err instanceof FrontendApiError &&
        (err.code === "UNAUTHENTICATED" || err.code === "UNAVAILABLE") &&
        isDemoMode
      ) {
        if (activeRole === "cliente" && status !== "cancelled") {
          throw new FrontendApiError(
            "FORBIDDEN",
            "El cliente solo puede solicitar la cancelación de sus citas futuras.",
            403
          );
        }
        const now = new Date().toISOString();
        let updatedApt: Appointment | undefined;
        setAppointments((prev) =>
          prev.map((apt) => {
            if (apt.id === appointmentId) {
              updatedApt = { ...apt, status, updated_at: now };
              return updatedApt;
            }
            return apt;
          })
        );
        if (!updatedApt) {
          throw new FrontendApiError(
            "NOT_FOUND",
            "La cita no existe o ya no admite esa transición de estado.",
            404
          );
        }
        return updatedApt;
      }
      throw err;
    }
  };

  const addClinicalConsultation = async (
    input: NewConsultationInput
  ): Promise<void> => {
    const optometristId =
      input.optometrist_id ??
      (activeRole === "optometrista"
        ? currentUser.id
        : optometrists[0]?.id ?? "10000000-0000-4000-8000-000000000002");

    try {
      const exam = await createClinicalExamApi({
        record: {
          patient_id: input.patient_id,
          optometrist_id: optometristId,
          chief_complaint: input.chief_complaint || null,
          medical_history: input.medical_history || null,
          allergies: input.allergies || null,
          diagnosis: input.diagnosis || null,
          notes: input.notes || null,
        },
        prescriptions: [
          {
            eye: "OD",
            sphere: input.od.sphere,
            cylinder: input.od.cylinder,
            axis: input.od.cylinder === 0 ? null : input.od.axis,
            addition: input.od.addition,
            pupillary_distance_mm: input.od.pupillary_distance_mm,
            visual_acuity: input.od.visual_acuity,
          },
          {
            eye: "OI",
            sphere: input.oi.sphere,
            cylinder: input.oi.cylinder,
            axis: input.oi.cylinder === 0 ? null : input.oi.axis,
            addition: input.oi.addition,
            pupillary_distance_mm: input.oi.pupillary_distance_mm,
            visual_acuity: input.oi.visual_acuity,
          },
        ],
      });

      setClinicalRecords((prev) => [exam.record, ...prev]);
      setPrescriptions((prev) => [...exam.prescriptions, ...prev]);
    } catch (err) {
      if (
        err instanceof FrontendApiError &&
        (err.code === "UNAUTHENTICATED" || err.code === "UNAVAILABLE") &&
        isDemoMode
      ) {
        if (activeRole !== "optometrista" && activeRole !== "admin") {
          throw new FrontendApiError(
            "FORBIDDEN",
            "Solo Optometristas y Administradores pueden registrar consultas clínicas.",
            403
          );
        }
        const now = new Date().toISOString();
        const hexSuffix = Date.now()
          .toString(16)
          .slice(-12)
          .padStart(12, "0");
        const recordId = `c1000000-0000-4000-8000-${hexSuffix}`;

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
          id: `30000000-0000-4000-8000-${hexSuffix}`,
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

        const hexSuffixOi = (Date.now() + 1)
          .toString(16)
          .slice(-12)
          .padStart(12, "0");
        const rxOI: Prescription = {
          id: `30000000-0000-4000-8000-${hexSuffixOi}`,
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
        return;
      }
      throw err;
    }
  };

  return (
    <RoleContext.Provider
      value={{
        currentUser,
        activeRole,
        isDemoMode,
        isLoadingSession,
        setActiveRole,
        signInWithPassword,
        signOut,
        refreshSession,
        users,
        optometrists,
        updateUserRole,
        patients,
        myPatient,
        appointments,
        scheduleAppointment,
        updateAppointmentStatus,
        clinicalRecords,
        prescriptions,
        loadPatientHistory,
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
