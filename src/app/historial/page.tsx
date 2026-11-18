"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  Plus,
  Stethoscope,
  User,
} from "lucide-react";
import { useRole } from "@/components/providers/RoleProvider";

export default function HistorialClinicoPage() {
  const {
    activeRole,
    setActiveRole,
    currentUser,
    patients,
    myPatient,
    optometrists,
    clinicalRecords,
    prescriptions,
    loadPatientHistory,
    addClinicalConsultation,
  } = useRole();

  const [selectedPatientId, setSelectedPatientId] = useState(
    patients[0]?.id ?? "20000000-0000-4000-8000-000000000001"
  );
  const [showNewForm, setShowNewForm] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campos de nueva consulta clínica + receta OD/OI
  const [chiefComplaint, setChiefComplaint] = useState(
    "Revisión anual de graduación y prueba de lentes con filtro de luz azul."
  );
  const [diagnosis, setDiagnosis] = useState(
    "Miopía simple bilateral con astigmatismo leve."
  );
  const [allergies, setAllergies] = useState("Ninguna conocida");
  const [notes, setNotes] = useState(
    "Se sugiere armazón Tom Ford FT5401 (51-20-145) con micas ZEISS SmartLife 1.60."
  );
  const [odSphere, setOdSphere] = useState(-2.0);
  const [odCylinder, setOdCylinder] = useState(-0.5);
  const [odAxis, setOdAxis] = useState(180);
  const [odAddition, setOdAddition] = useState(0);
  const [odDip, setOdDip] = useState(31.5);
  const [odAcuity, setOdAcuity] = useState("20/20");

  const [oiSphere, setOiSphere] = useState(-1.75);
  const [oiCylinder, setOiCylinder] = useState(-0.5);
  const [oiAxis, setOiAxis] = useState(175);
  const [oiAddition, setOiAddition] = useState(0);
  const [oiDip, setOiDip] = useState(31.5);
  const [oiAcuity, setOiAcuity] = useState("20/20");

  const clientPatientId =
    myPatient?.id ??
    patients.find((p) => p.profile_id === currentUser.id)?.id ??
    "20000000-0000-4000-8000-000000000001";

  const activePatientId =
    activeRole === "cliente" ? clientPatientId : selectedPatientId;

  useEffect(() => {
    if (activeRole === "vendedor") return;
    void loadPatientHistory(activePatientId).catch(() => {
      // Mantiene datos actuales si la llamada falla en modo demo
    });
  }, [activePatientId, activeRole, loadPatientHistory]);

  // Recepción / Ventas (vendedor) no tiene lectura ni escritura clínica según API_CONTRACT.md
  if (activeRole === "vendedor") {
    return (
      <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-600/20">
                <AlertTriangle className="h-3.5 w-3.5" />
                Política RLS de Privacidad Clínica (Código 42501)
              </span>
              <h1 className="mt-1.5 text-2xl font-bold text-slate-900">
                Expediente Clínico Restringido para Recepción / Ventas
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Según la matriz de acceso en <code>API_CONTRACT.md</code>, el
                rol <code>vendedor</code> (Recepción/Ventas) gestiona la agenda
                de citas y el alta de pacientes, pero no tiene permisos de
                lectura ni escritura sobre diagnósticos ni graduaciones{" "}
                <code>OD/OI</code>.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => setActiveRole("optometrista")}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:text-sm"
            >
              <Stethoscope className="h-4 w-4" />
              Cambiar a rol Optometrista
            </button>
            <Link
              href="/citas"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Ir a Agenda de Citas
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const activePatient =
    patients.find((p) => p.id === activePatientId) ?? patients[0];

  const patientRecords = clinicalRecords.filter(
    (r) => r.patient_id === activePatientId
  );

  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(null);
    setErrorNotice(null);
    setIsSubmitting(true);

    try {
      await addClinicalConsultation({
        patient_id: activePatientId,
        chief_complaint: chiefComplaint,
        medical_history: "Seguimiento optométrico en clínica Optizap.",
        allergies,
        diagnosis,
        notes,
        od: {
          sphere: Number(odSphere),
          cylinder: Number(odCylinder),
          axis: Number(odCylinder) === 0 ? null : Number(odAxis),
          addition: Number(odAddition),
          pupillary_distance_mm: Number(odDip),
          visual_acuity: odAcuity,
        },
        oi: {
          sphere: Number(oiSphere),
          cylinder: Number(oiCylinder),
          axis: Number(oiCylinder) === 0 ? null : Number(oiAxis),
          addition: Number(oiAddition),
          pupillary_distance_mm: Number(oiDip),
          visual_acuity: oiAcuity,
        },
      });
      setShowNewForm(false);
      setSavedNotice(
        `Consulta clínica y graduación OD/OI guardadas mediante POST /api/clinical-exams para ${activePatient?.full_name}.`
      );
    } catch (err) {
      setErrorNotice(
        err instanceof Error
          ? err.message
          : "No fue posible guardar la consulta clínica."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-600/20">
            <FileText className="h-3.5 w-3.5" />
            {activeRole === "cliente"
              ? "Expediente Personal (GET /api/me/history)"
              : "Expediente Clínico (GET /api/patients/:id/history • POST /api/clinical-exams)"}
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Historial Clínico y Graduaciones OD / OI
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {activeRole === "cliente"
              ? "Consulta tus diagnósticos optométricos y tu receta graduada lista para laboratorio."
              : "Consulta y registra refracciones binoculares (Esfera, Cilindro, Eje, Adición, DIP monocular y Agudeza Visual)."}
          </p>
        </div>

        {(activeRole === "optometrista" || activeRole === "admin") && (
          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            {showNewForm ? "Cerrar Captura" : "Registrar Consulta y Receta"}
          </button>
        )}
      </div>

      {/* Selector de paciente (solo visible para Optometrista y Admin) */}
      {activeRole !== "cliente" && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-800">
            <User className="h-4 w-4 text-teal-600" />
            <span>Seleccionar Expediente de Paciente:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {patients.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPatientId(p.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  activePatientId === p.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {p.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {errorNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-900 sm:text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorNotice}</span>
        </div>
      )}

      {savedNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 sm:text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Formulario de captura clínica (Optometrista / Admin) */}
      {showNewForm &&
        (activeRole === "optometrista" || activeRole === "admin") && (
          <form
            onSubmit={handleSaveConsultation}
            className="space-y-6 rounded-2xl border border-teal-200 bg-white p-6 shadow-md"
          >
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                Nueva Consulta Clínica para {activePatient?.full_name}
              </h2>
              <p className="text-xs text-slate-500">
                RPC transaccional <code>create_clinical_exam</code>: Esfera
                [-30, 30], Cilindro [-12, 12], Eje [0, 180], Adición [0, 4], DIP
                monocular [20, 45] mm.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Motivo de Consulta (chief_complaint)
                </label>
                <input
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Diagnóstico Refractivo (diagnosis)
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Alergias / Sensibilidad en Montura
                </label>
                <input
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Recomendación Óptica (notes)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 sm:text-sm"
                />
              </div>
            </div>

            {/* Captura OD / OI */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-sky-50/60 p-4 ring-1 ring-sky-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-900">
                  Ojo Derecho (OD)
                </h3>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      Esfera
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="-30"
                      max="30"
                      value={odSphere}
                      onChange={(e) => setOdSphere(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      Cilindro
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="-12"
                      max="12"
                      value={odCylinder}
                      onChange={(e) => setOdCylinder(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      Eje (°)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={odAxis}
                      onChange={(e) => setOdAxis(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      Adición
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="4"
                      value={odAddition}
                      onChange={(e) => setOdAddition(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      DIP (mm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="20"
                      max="45"
                      value={odDip}
                      onChange={(e) => setOdDip(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      AV
                    </label>
                    <input
                      type="text"
                      value={odAcuity}
                      onChange={(e) => setOdAcuity(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-teal-50/60 p-4 ring-1 ring-teal-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900">
                  Ojo Izquierdo (OI)
                </h3>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      Esfera
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="-30"
                      max="30"
                      value={oiSphere}
                      onChange={(e) => setOiSphere(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      Cilindro
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="-12"
                      max="12"
                      value={oiCylinder}
                      onChange={(e) => setOiCylinder(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      Eje (°)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={oiAxis}
                      onChange={(e) => setOiAxis(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      Adición
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="4"
                      value={oiAddition}
                      onChange={(e) => setOiAddition(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      DIP (mm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="20"
                      max="45"
                      value={oiDip}
                      onChange={(e) => setOiDip(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      AV
                    </label>
                    <input
                      type="text"
                      value={oiAcuity}
                      onChange={(e) => setOiAcuity(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-teal-600 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {isSubmitting
                  ? "Guardando..."
                  : "Guardar Consulta y Graduación"}
              </button>
            </div>
          </form>
        )}

      {/* Ficha del Paciente */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Ficha de Paciente (public.patients)
            </span>
            <h2 className="mt-0.5 text-2xl font-bold text-slate-900">
              {activePatient?.full_name}
            </h2>
            <p className="text-xs text-slate-500">
              Fecha de nacimiento: <strong>{activePatient?.birth_date}</strong>{" "}
              • Teléfono: <strong>{activePatient?.phone}</strong> • Correo:{" "}
              <strong>{activePatient?.email}</strong>
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600 ring-1 ring-slate-200/80">
            Consultas registradas:{" "}
            <strong className="text-slate-900">{patientRecords.length}</strong>
          </div>
        </div>
      </div>

      {/* Lista de Consultas Clínicas con su tabla de Receta OD/OI */}
      <div className="space-y-6">
        {patientRecords.map((record) => {
          const optometrist = optometrists.find(
            (u) => u.id === record.optometrist_id
          );
          const recordRx = prescriptions.filter(
            (rx) => rx.clinical_record_id === record.id
          );

          return (
            <section
              key={record.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-teal-600" />
                  <span className="text-sm font-bold text-slate-900">
                    Consulta del{" "}
                    {new Date(record.examined_at).toLocaleDateString("es-MX", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Optometrista titular:{" "}
                  <strong className="text-slate-800">
                    {optometrist?.full_name ?? "Lic. Optometría"}
                  </strong>
                </span>
              </div>

              <div className="space-y-6 p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Motivo de Consulta & Antecedentes
                    </span>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {record.chief_complaint}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Antecedentes: {record.medical_history} • Alergias:{" "}
                      {record.allergies}
                    </p>
                  </div>

                  <div className="rounded-xl bg-teal-50/50 p-4 ring-1 ring-teal-500/15">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                      Diagnóstico y Recomendación de Laboratorio
                    </span>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {record.diagnosis}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {record.notes}
                    </p>
                  </div>
                </div>

                {/* Tabla de graduación OD / OI */}
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Eye className="h-4 w-4 text-sky-600" />
                    Receta Oftálmica Graduada (public.prescriptions)
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Ojo (eye)</th>
                          <th className="px-4 py-2.5">Esfera (SPH)</th>
                          <th className="px-4 py-2.5">Cilindro (CYL)</th>
                          <th className="px-4 py-2.5">Eje (AXIS)</th>
                          <th className="px-4 py-2.5">Adición (ADD)</th>
                          <th className="px-4 py-2.5">DIP Monocular (mm)</th>
                          <th className="px-4 py-2.5">Agudeza Visual</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {recordRx.map((rx) => (
                          <tr key={rx.id}>
                            <td className="px-4 py-3 font-sans font-bold text-slate-900">
                              <span
                                className={`inline-flex rounded px-2 py-0.5 text-xs text-white ${
                                  rx.eye === "OD"
                                    ? "bg-sky-600"
                                    : "bg-teal-600"
                                }`}
                              >
                                {rx.eye} (
                                {rx.eye === "OD" ? "Derecho" : "Izquierdo"})
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900">
                              {rx.sphere > 0
                                ? `+${rx.sphere.toFixed(2)}`
                                : rx.sphere.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {rx.cylinder.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {rx.axis !== null ? `${rx.axis}°` : "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {rx.addition > 0
                                ? `+${rx.addition.toFixed(2)}`
                                : "0.00"}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {rx.pupillary_distance_mm} mm
                            </td>
                            <td className="px-4 py-3 font-sans font-semibold text-emerald-700">
                              {rx.visual_acuity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
