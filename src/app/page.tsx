"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Calendar,
  FileText,
  Glasses,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { CatalogExplorer } from "@/components/catalog/CatalogExplorer";
import { useRole } from "@/components/providers/RoleProvider";

export default function HomePage() {
  const { currentUser, activeRole } = useRole();

  return (
    <main className="space-y-12 pb-16">
      {/* Hero estilo clínica óptica premium */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-12 h-80 w-80 rounded-full bg-teal-500/15 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-sky-200 ring-1 ring-white/15">
                <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                <span>Clínica de Optometría Avanzada & Boutique Autorizada</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:leading-[1.12]">
                Precisión clínica para tu vista,{" "}
                <span className="bg-gradient-to-r from-sky-400 to-teal-300 bg-clip-text text-transparent">
                  diseño icónico
                </span>{" "}
                para tu rostro.
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-slate-300">
                Explora armazones oftálmicos, lentes de sol y micas digitales de{" "}
                <strong className="font-semibold text-white">
                  Ray-Ban, Oakley, Persol, Tom Ford, Essilor y ZEISS
                </strong>
                . Consulta medidas milimétricas exactas y agenda tu prueba en
                sucursal con nuestros optometristas certificados.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href="#catalogo-optizap"
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
                >
                  <Glasses className="h-4 w-4" />
                  Explorar Catálogo Oficial
                </a>
                <Link
                  href="/citas"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15"
                >
                  <Calendar className="h-4 w-4 text-sky-300" />
                  Agendar Examen o Prueba
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium text-sky-300 transition hover:text-white"
                >
                  <span>Ir al Panel ({activeRole})</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Tarjeta de sesión clínica interactiva según rol activo */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                      Vista activa simulada
                    </span>
                    <h2 className="mt-0.5 text-lg font-bold text-white">
                      {currentUser.full_name}
                    </h2>
                    <p className="text-xs text-slate-300">{currentUser.email}</p>
                  </div>
                  <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-300 ring-1 ring-sky-400/30">
                    {activeRole}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Link
                    href="/dashboard"
                    className="flex items-start gap-3 rounded-xl bg-white/5 p-3 transition hover:bg-white/10"
                  >
                    <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                    <div>
                      <span className="block text-xs font-semibold text-white">
                        Dashboard Clínico
                      </span>
                      <span className="text-[11px] text-slate-300">
                        KPIs y resumen para {activeRole}
                      </span>
                    </div>
                  </Link>

                  <Link
                    href="/citas"
                    className="flex items-start gap-3 rounded-xl bg-white/5 p-3 transition hover:bg-white/10"
                  >
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
                    <div>
                      <span className="block text-xs font-semibold text-white">
                        Agenda de Citas
                      </span>
                      <span className="text-[11px] text-slate-300">
                        Pruebas de armazón y consultas
                      </span>
                    </div>
                  </Link>

                  <Link
                    href="/historial"
                    className="flex items-start gap-3 rounded-xl bg-white/5 p-3 transition hover:bg-white/10"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <div>
                      <span className="block text-xs font-semibold text-white">
                        Expediente Clínico
                      </span>
                      <span className="text-[11px] text-slate-300">
                        Recetas OD/OI y diagnósticos
                      </span>
                    </div>
                  </Link>

                  <Link
                    href="/dashboard/usuarios"
                    className="flex items-start gap-3 rounded-xl bg-white/5 p-3 transition hover:bg-white/10"
                  >
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                    <div>
                      <span className="block text-xs font-semibold text-white">
                        Gestión de Roles
                      </span>
                      <span className="text-[11px] text-slate-300">
                        {activeRole === "admin"
                          ? "Acceso Admin habilitado"
                          : "Vista protegida (solo Admin)"}
                      </span>
                    </div>
                  </Link>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950/50 px-3.5 py-2.5 text-[11px] text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5 text-teal-400" />
                    Usa el selector superior para alternar entre Admin, Optometrista y Cliente
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sello de garantías ópticas */}
          <div className="mt-10 grid grid-cols-1 gap-4 border-t border-white/10 pt-8 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Autenticidad Garantizada
                </h3>
                <p className="text-xs text-slate-400">
                  Códigos SKU oficiales y certificados de fábrica Luxottica, Essilor y ZEISS.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Adaptación Milimétrica
                </h3>
                <p className="text-xs text-slate-400">
                  Medición digital de distancia pupilar monocular (OD/OI) y altura focal.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Prueba en Sucursal Sin Costo
                </h3>
                <p className="text-xs text-slate-400">
                  Aparta hasta 3 armazones desde el catálogo y pruébalos en clínica.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catálogo completo embebido en la página principal */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <CatalogExplorer showHeader={true} />
      </div>
    </main>
  );
}
