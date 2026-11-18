import React from "react";
import Link from "next/link";
import { Glasses, MapPin, Phone, ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white">
                <Glasses className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold text-slate-900">Optizap</span>
            </div>
            <p className="max-w-md text-sm text-slate-500">
              Clínica de optometría avanzada y boutique autorizada de alta gama.
              Distribuidores certificados de Ray-Ban, Oakley, Persol, Tom Ford,
              Essilor y ZEISS en México.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-sky-600" />
                Av. Presidente Masaryk 420, Polanco, CDMX
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-sky-600" />
                +52 (55) 5280 9400
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Navegación Clínica
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/catalogo" className="hover:text-sky-700">
                  Catálogo de Marcas y Micas
                </Link>
              </li>
              <li>
                <Link href="/citas" className="hover:text-sky-700">
                  Agendar Prueba o Examen
                </Link>
              </li>
              <li>
                <Link href="/historial" className="hover:text-sky-700">
                  Expediente y Graduaciones
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-sky-700">
                  Panel de Control por Rol
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Arquitectura & Seguridad
            </h3>
            <div className="mt-3 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 ring-1 ring-slate-200/70">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-teal-600" />
                <span>Contrato Supabase RLS</span>
              </div>
              <p className="mt-1.5 leading-relaxed text-slate-500">
                Tipado estricto con <code>/src/types/database.ts</code> y control de
                acceso por rol (<code>admin</code>, <code>optometrista</code>,{" "}
                <code>cliente</code>).
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>© 2026 Optizap S.A. de C.V. Todos los derechos reservados.</p>
          <p>Precios expresados en Pesos Mexicanos (MXN) • IVA incluido</p>
        </div>
      </div>
    </footer>
  );
}
