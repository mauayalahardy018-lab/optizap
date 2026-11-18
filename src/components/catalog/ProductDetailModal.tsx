"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  MapPin,
  Ruler,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import type { CatalogItem } from "./mockCatalogData";
import { formatFrameMeasurements, formatPriceMXN } from "./mockCatalogData";
import { ProductVisual } from "./ProductVisual";
import { useRole } from "@/components/providers/RoleProvider";

interface ProductDetailModalProps {
  item: CatalogItem | null;
  onClose: () => void;
}

export function ProductDetailModal({ item, onClose }: ProductDetailModalProps) {
  const { users, scheduleAppointment, currentUser } = useRole();
  const [selectedDate, setSelectedDate] = useState("2026-11-20");
  const [selectedTime, setSelectedTime] = useState("12:00");
  const [selectedBranch, setSelectedBranch] = useState(
    "Boutique Polanco (Av. Masaryk 420)"
  );
  const [bookedAppointmentId, setBookedAppointmentId] = useState<string | null>(
    null
  );

  if (!item) return null;

  const isFrame = item.kind === "frame";
  const sku = isFrame ? item.frame.sku : item.lens.sku;
  const name = isFrame ? item.frame.name : item.lens.name;
  const price = isFrame ? item.frame.price : item.lens.price;
  const stock = isFrame ? item.frame.stock : item.lens.stock;

  const optometrists = users.filter((u) => u.role === "optometrista");
  const defaultOptometrist = optometrists[0];

  const handleBookTrial = (e: React.FormEvent) => {
    e.preventDefault();
    const startsAt = `${selectedDate}T${selectedTime}:00-06:00`;
    const [hourStr, minStr] = selectedTime.split(":");
    const endHour = String(Number(hourStr)).padStart(2, "0");
    const endMin = Number(minStr) === 0 ? "45" : "59";
    const endsAt = `${selectedDate}T${endHour}:${endMin}:00-06:00`;

    const created = scheduleAppointment({
      optometrist_id:
        defaultOptometrist?.id ?? "u1000000-0000-4000-8000-000000000002",
      starts_at: startsAt,
      ends_at: endsAt,
      reason: `Prueba en sucursal (${selectedBranch}): ${item.brand.name} ${name} [SKU: ${sku}]`,
    });

    setBookedAppointmentId(created.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-product-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Encabezado */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-600/20">
              {item.brand.name}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {item.categoryLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className=" space-y-6 p-6">
          {/* Visual e información principal */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ProductVisual item={item} size="modal" />

            <div className="flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
                  <Tag className="h-3.5 w-3.5 text-sky-600" />
                  <span>SKU Oficial: {sku}</span>
                </div>
                <h2
                  id="modal-product-title"
                  className="mt-1 text-2xl font-bold text-slate-900"
                >
                  {name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {item.brand.description}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/80">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Precio {isFrame ? "Armazón" : "por Mica Individual"}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">
                    {stock} disponibles en clínica
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {formatPriceMXN(price)}
                  </span>
                  <span className="text-xs font-medium text-slate-500">MXN</span>
                </div>
                {!isFrame && (
                  <p className="mt-1 text-xs text-slate-500">
                    Par estimado (OD + OI):{" "}
                    <strong className="text-slate-700">
                      {formatPriceMXN(price * 2)} MXN
                    </strong>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Ficha técnica detallada */}
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-900">
              <Ruler className="h-4 w-4 text-sky-600" />
              Especificaciones Técnicas y Medidas Milimétricas
            </h3>

            {isFrame ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-[11px] text-slate-500">
                    Medidas (mm)
                  </span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-slate-900">
                    {formatFrameMeasurements(item.frame)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Mica-Puente-Varilla
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-[11px] text-slate-500">
                    Material
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-slate-900">
                    {item.materialDisplay}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize">
                    Tipo BD: {item.frame.material}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-[11px] text-slate-500">
                    Altura de Mica
                  </span>
                  <span className="mt-0.5 block font-mono text-sm font-semibold text-slate-900">
                    {item.frame.lens_height_mm ?? "40.0"} mm
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize">
                    Género: {item.frame.gender}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-[11px] text-slate-500">
                    Color Oficial
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-slate-900">
                    {item.frame.color}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-[11px] text-slate-500">
                    Diseño Óptico
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold capitalize text-slate-900">
                    {item.lens.lens_type}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-[11px] text-slate-500">
                    Material / Índice
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-slate-900">
                    {item.materialDisplay}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-[11px] text-slate-500">
                    Diámetro (mm)
                  </span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-slate-900">
                    Ø {item.lens.diameter_mm} mm
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="block text-[11px] text-slate-500">
                    Tratamientos
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-900">
                    {item.lens.coatings.join(", ")}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {item.highlights.map((hl) => (
                <span
                  key={hl}
                  className="inline-flex items-center gap-1 rounded-md bg-sky-50/80 px-2.5 py-1 text-xs font-medium text-sky-800"
                >
                  <Sparkles className="h-3 w-3 text-sky-600" />
                  {hl}
                </span>
              ))}
            </div>
          </div>

          {/* Formulario de Agendar prueba en sucursal */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-sky-400" />
                <h3 className="text-base font-semibold">
                  Agendar prueba en sucursal
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Reserva sin costo
              </span>
            </div>

            {bookedAppointmentId ? (
              <div className="mt-4 rounded-xl bg-emerald-500/15 p-4 ring-1 ring-emerald-400/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-emerald-200">
                      ¡Prueba en sucursal agendada para {currentUser.full_name}!
                    </p>
                    <p className="text-xs text-slate-300">
                      Hemos apartado el modelo{" "}
                      <strong>
                        {item.brand.name} {name} ({sku})
                      </strong>{" "}
                      en <strong>{selectedBranch}</strong> para el{" "}
                      <strong>{selectedDate}</strong> a las{" "}
                      <strong>{selectedTime} hrs</strong>.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link
                        href="/citas"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
                      >
                        Ver en mis Citas
                      </Link>
                      <button
                        type="button"
                        onClick={() => setBookedAppointmentId(null)}
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                      >
                        Agendar otro horario
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBookTrial} className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-slate-300">
                      Sucursal Optizap
                    </label>
                    <div className="relative mt-1">
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                      >
                        <option value="Boutique Polanco (Av. Masaryk 420)">
                          Polanco (Masaryk 420)
                        </option>
                        <option value="Clínica Roma Norte (Álvaro Obregón 185)">
                          Roma Norte (Á. Obregón 185)
                        </option>
                        <option value="Centro Médico Santa Fe">
                          Centro Médico Santa Fe
                        </option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300">
                      Fecha preferida
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      min="2026-11-18"
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300">
                      Horario (CDMX)
                    </label>
                    <select
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                    >
                      <option value="10:00">10:00 hrs</option>
                      <option value="11:00">11:00 hrs</option>
                      <option value="12:00">12:00 hrs</option>
                      <option value="16:00">16:00 hrs</option>
                      <option value="17:00">17:00 hrs</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col items-stretch justify-between gap-3 pt-2 sm:flex-row sm:items-center">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-sky-400" />
                    Incluye examen de refracción y ajuste anatómico con{" "}
                    {defaultOptometrist?.full_name ?? "Optometrista titular"}
                  </span>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
                  >
                    <Calendar className="h-4 w-4" />
                    Agendar prueba en sucursal
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
