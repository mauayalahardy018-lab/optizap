"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Eye,
  FileText,
  Glasses,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Users,
} from "lucide-react";
import { useRole } from "@/components/providers/RoleProvider";
import {
  MOCK_BRANDS,
  MOCK_CATALOG_ITEMS,
  formatPriceMXN,
} from "@/components/catalog/mockCatalogData";

export default function DashboardPage() {
  const {
    currentUser,
    activeRole,
    users,
    appointments,
    clinicalRecords,
    prescriptions,
    patients,
  } = useRole();

  const totalInventoryUnits = MOCK_CATALOG_ITEMS.reduce(
    (acc, item) =>
      acc + (item.kind === "frame" ? item.frame.stock : item.lens.stock),
    0
  );

  const visibleAppointments =
    activeRole === "cliente"
      ? appointments.filter((a) => a.patient_id === "p1000000-0000-4000-8000-000000000001")
      : activeRole === "optometrista"
        ? appointments.filter((a) => a.optometrist_id === currentUser.id)
        : appointments;

  const visibleRecords =
    activeRole === "cliente"
      ? clinicalRecords.filter(
          (r) => r.patient_id === "p1000000-0000-4000-8000-000000000001"
        )
      : clinicalRecords;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Cabecera contextual según rol */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 text-white shadow-md sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-300">
            {activeRole === "admin" && <ShieldCheck className="h-3.5 w-3.5" />}
            {activeRole === "optometrista" && (
              <Stethoscope className="h-3.5 w-3.5" />
            )}
            {activeRole === "cliente" && <Eye className="h-3.5 w-3.5" />}
            <span className="uppercase tracking-wider">
              Panel {activeRole}
            </span>
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Hola, {currentUser.full_name}
          </h1>
          <p className="text-xs text-slate-300 sm:text-sm">
            {activeRole === "admin" &&
              "Supervisión global de sucursales, inventario óptico, agenda clínica y permisos de usuarios."}
            {activeRole === "optometrista" &&
              "Panel clínico de consultas optométricas, refracción OD/OI y seguimiento de pacientes asignados."}
            {activeRole === "cliente" &&
              "Consulta tu expediente visual, graduación actualizada y próximas citas de prueba en sucursal."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {activeRole === "admin" && (
            <Link
              href="/dashboard/usuarios"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-400 sm:text-sm"
            >
              <Users className="h-4 w-4" />
              Gestionar Usuarios y Roles
            </Link>
          )}
          <Link
            href="/citas"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-400 sm:text-sm"
          >
            <Calendar className="h-4 w-4" />
            {activeRole === "cliente" ? "Agendar Cita" : "Ver Agenda Clínica"}
          </Link>
        </div>
      </div>

      {/* Tarjetas de métricas KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {activeRole === "cliente" ? "Mis Citas" : "Citas Programadas"}
            </span>
            <Calendar className="h-5 w-5 text-sky-600" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {visibleAppointments.length}
          </p>
          <Link
            href="/citas"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
          >
            Administrar horarios <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {activeRole === "cliente"
                ? "Consultas en Expediente"
                : "Consultas Clínicas"}
            </span>
            <FileText className="h-5 w-5 text-teal-600" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {visibleRecords.length}
          </p>
          <Link
            href="/historial"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
          >
            Ver graduaciones OD/OI <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Catálogo Oficial
            </span>
            <Glasses className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {MOCK_BRANDS.length} Marcas
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {MOCK_CATALOG_ITEMS.length} modelos ({totalInventoryUnits} uds. en
            stock)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {activeRole === "admin" ? "Usuarios y Roles" : "Pacientes Activos"}
            </span>
            <Users className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {activeRole === "admin" ? users.length : patients.length}
          </p>
          <Link
            href="/dashboard/usuarios"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
          >
            {activeRole === "admin"
              ? "Cambiar roles de usuario"
              : "Vista protegida Admin"}{" "}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Bloques principales del Dashboard */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Próximas citas y pruebas en sucursal */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Próximas Citas y Pruebas de Armazón
              </h2>
              <p className="text-xs text-slate-500">
                Filtrado automáticamente según permisos RLS del rol{" "}
                <code className="font-mono font-semibold">{activeRole}</code>
              </p>
            </div>
            <Link
              href="/citas"
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              Ver todas
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {visibleAppointments.map((apt) => {
              const patient = patients.find((p) => p.id === apt.patient_id);
              const optometrist = users.find((u) => u.id === apt.optometrist_id);
              const dateObj = new Date(apt.starts_at);
              const formattedDate = dateObj.toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
              const formattedTime = dateObj.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={apt.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {patient?.full_name ?? "Paciente"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          apt.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-800"
                            : apt.status === "scheduled"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {apt.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{apt.reason}</p>
                    <p className="text-[11px] text-slate-400">
                      Atiende: {optometrist?.full_name ?? "Optometrista"}
                    </p>
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    <div className="font-mono text-xs font-bold text-slate-900">
                      {formattedDate}
                    </div>
                    <div className="text-xs text-sky-700 font-semibold">
                      {formattedTime} hrs
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumen rápido de Receta / Usuarios según rol */}
        <div className="space-y-6 lg:col-span-5">
          {activeRole === "admin" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Control Rápido de Roles
                  </h2>
                  <p className="text-xs text-slate-500">
                    Usuarios registrados en <code>public.profiles</code>
                  </p>
                </div>
                <Link
                  href="/dashboard/usuarios"
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Abrir tabla completa
                </Link>
              </div>

              <div className="mt-4 space-y-2.5">
                {users.slice(0, 4).map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {u.full_name}
                      </div>
                      <div className="text-slate-500">{u.email}</div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 font-semibold capitalize text-slate-700 shadow-sm ring-1 ring-slate-200">
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Última Graduación Registrada (OD / OI)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Valores en dioptrías y distancia pupilar monocular
                  </p>
                </div>
                <Link
                  href="/historial"
                  className="text-xs font-semibold text-teal-700 hover:underline"
                >
                  Expediente completo
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {prescriptions.slice(0, 2).map((rx) => (
                  <div
                    key={rx.id}
                    className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-sky-600 px-2 py-0.5 text-xs font-bold text-white">
                        {rx.eye}
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">
                        AV {rx.visual_acuity}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 font-mono text-xs text-slate-700">
                      <div>Esfera: {rx.sphere > 0 ? `+${rx.sphere}` : rx.sphere}</div>
                      <div>Cilindro: {rx.cylinder}</div>
                      <div>Eje: {rx.axis ?? 0}°</div>
                      <div>DIP: {rx.pupillary_distance_mm} mm</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Marcas top en inventario */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                Productos Destacados en Clínica
              </h3>
              <Link
                href="/catalogo"
                className="text-xs font-semibold text-sky-700 hover:underline"
              >
                Catálogo
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {MOCK_CATALOG_ITEMS.slice(0, 3).map((item) => {
                const name =
                  item.kind === "frame" ? item.frame.name : item.lens.name;
                const sku =
                  item.kind === "frame" ? item.frame.sku : item.lens.sku;
                const price =
                  item.kind === "frame" ? item.frame.price : item.lens.price;
                return (
                  <div
                    key={sku}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">
                        {item.brand.name} {name}
                      </span>
                      <span className="ml-2 font-mono text-[11px] text-slate-400">
                        {sku}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900">
                      {formatPriceMXN(price)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
