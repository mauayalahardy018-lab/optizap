"use client";

import React, { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Glasses,
  Plus,
  Stethoscope,
  User,
  XCircle,
} from "lucide-react";
import { useRole } from "@/components/providers/RoleProvider";
import { MOCK_CATALOG_ITEMS } from "@/components/catalog/mockCatalogData";
import type { AppointmentStatus } from "@/types/database";

const STATUS_BADGES: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Programada",
    className: "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20",
  },
  confirmed: {
    label: "Confirmada",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  },
  completed: {
    label: "Completada",
    className: "bg-slate-100 text-slate-700 ring-1 ring-slate-400/20",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
  },
  no_show: {
    label: "No asistió",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20",
  },
};

export default function CitasPage() {
  const {
    activeRole,
    currentUser,
    users,
    patients,
    appointments,
    scheduleAppointment,
    updateAppointmentStatus,
  } = useRole();

  const optometrists = users.filter((u) => u.role === "optometrista");

  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [optometristId, setOptometristId] = useState(
    optometrists[0]?.id ?? "u1000000-0000-4000-8000-000000000002"
  );
  const [date, setDate] = useState("2026-11-21");
  const [time, setTime] = useState("11:00");
  const [selectedSku, setSelectedSku] = useState("RB5154-2000");
  const [customReason, setCustomReason] = useState(
    "Examen de la vista computarizado y prueba de armazón en sucursal"
  );
  const [createdBanner, setCreatedBanner] = useState(false);

  const visibleAppointments =
    activeRole === "cliente"
      ? appointments.filter(
          (a) => a.patient_id === "p1000000-0000-4000-8000-000000000001"
        )
      : activeRole === "optometrista"
        ? appointments.filter((a) => a.optometrist_id === currentUser.id)
        : appointments;

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const startsAt = `${date}T${time}:00-06:00`;
    const [h] = time.split(":");
    const endsAt = `${date}T${h}:45:00-06:00`;

    const skuItem = MOCK_CATALOG_ITEMS.find((i) =>
      i.kind === "frame" ? i.frame.sku === selectedSku : i.lens.sku === selectedSku
    );
    const productLabel = skuItem
      ? `${skuItem.brand.name} ${
          skuItem.kind === "frame" ? skuItem.frame.name : skuItem.lens.name
        } (SKU: ${selectedSku})`
      : selectedSku;

    scheduleAppointment({
      patient_id:
        activeRole === "cliente"
          ? "p1000000-0000-4000-8000-000000000001"
          : patientId,
      optometrist_id: optometristId,
      starts_at: startsAt,
      ends_at: endsAt,
      reason: `${customReason} • Modelo apartado: ${productLabel}`,
    });

    setCreatedBanner(true);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Cabecera */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-600/20">
            <Calendar className="h-3.5 w-3.5" />
            Agenda Clínica y Boutique (Tabla: appointments)
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Agendamiento de Citas y Pruebas en Sucursal
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {activeRole === "cliente"
              ? "Agenda tu examen visual o aparta armazones del catálogo para probarlos en sucursal."
              : "Administra las citas programadas, confirma asistencia y evita traslapes de horario (restricción GiST)."}
          </p>
        </div>

        <div className="rounded-xl bg-slate-100 px-3.5 py-2 text-xs text-slate-600">
          Rol activo:{" "}
          <strong className="uppercase text-slate-900">{activeRole}</strong> •{" "}
          {visibleAppointments.length} citas visibles
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Formulario para agendar nueva cita */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Plus className="h-5 w-5 text-sky-600" />
              Nueva Cita / Prueba de Armazón
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Duración estándar de 45 minutos en huso horario{" "}
              <code>America/Mexico_City</code>.
            </p>

            {createdBanner && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Cita registrada exitosamente con estado{" "}
                  <code>scheduled</code>.
                </span>
              </div>
            )}

            <form onSubmit={handleCreateAppointment} className="mt-5 space-y-4">
              {activeRole !== "cliente" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Paciente
                  </label>
                  <select
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none sm:text-sm"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Optometrista Asignado
                </label>
                <select
                  value={optometristId}
                  onChange={(e) => setOptometristId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none sm:text-sm"
                >
                  {optometrists.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.full_name} ({opt.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={date}
                    min="2026-11-18"
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Hora de Inicio
                  </label>
                  <select
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none sm:text-sm"
                  >
                    <option value="10:00">10:00 - 10:45</option>
                    <option value="11:00">11:00 - 11:45</option>
                    <option value="12:00">12:00 - 12:45</option>
                    <option value="13:00">13:00 - 13:45</option>
                    <option value="16:00">16:00 - 16:45</option>
                    <option value="17:00">17:00 - 17:45</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Armazón o Mica para Prueba en Sucursal (SKU Oficial)
                </label>
                <select
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none sm:text-sm"
                >
                  {MOCK_CATALOG_ITEMS.map((item) => {
                    const sku =
                      item.kind === "frame" ? item.frame.sku : item.lens.sku;
                    const name =
                      item.kind === "frame" ? item.frame.name : item.lens.name;
                    return (
                      <option key={sku} value={sku}>
                        [{sku}] {item.brand.name} - {name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Motivo de la Cita
                </label>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none sm:text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                <Calendar className="h-4 w-4" />
                Confirmar Agendamiento
              </button>
            </form>
          </div>
        </div>

        {/* Listado de citas programadas */}
        <div className="space-y-4 lg:col-span-7">
          {visibleAppointments.map((apt) => {
            const patient = patients.find((p) => p.id === apt.patient_id);
            const optometrist = users.find((u) => u.id === apt.optometrist_id);
            const badge = STATUS_BADGES[apt.status];
            const start = new Date(apt.starts_at);
            const end = new Date(apt.ends_at);

            return (
              <div
                key={apt.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      ID: {apt.id.slice(0, 8)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Clock className="h-3.5 w-3.5 text-sky-600" />
                    <span>
                      {start.toLocaleDateString("es-MX", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      •{" "}
                      {start.toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {end.toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      Paciente:{" "}
                      <strong className="text-slate-900">
                        {patient?.full_name ?? "Paciente"}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-teal-600" />
                      Optometrista:{" "}
                      <strong className="text-slate-900">
                        {optometrist?.full_name ?? "Optometrista"}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    <Glasses className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                    <span>{apt.reason}</span>
                  </div>
                </div>

                {/* Controles de estado según rol */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2">
                  <span className="text-[11px] text-slate-400">
                    {activeRole === "cliente"
                      ? "Permiso RLS Cliente: puede cancelar citas propias futuras."
                      : "Permiso RLS Personal/Admin: actualizar estado de cita."}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {activeRole !== "cliente" && apt.status === "scheduled" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateAppointmentStatus(apt.id, "confirmed")
                        }
                        className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        Confirmar Cita
                      </button>
                    )}

                    {activeRole !== "cliente" &&
                      (apt.status === "scheduled" ||
                        apt.status === "confirmed") && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAppointmentStatus(apt.id, "completed")
                          }
                          className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                        >
                          Marcar Completada
                        </button>
                      )}

                    {apt.status !== "cancelled" &&
                      apt.status !== "completed" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAppointmentStatus(apt.id, "cancelled")
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancelar Cita
                        </button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
