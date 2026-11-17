import React from "react";
import type { CatalogItem } from "./mockCatalogData";

export function ProductVisual({
  item,
  size = "card",
}: {
  item: CatalogItem;
  size?: "card" | "modal";
}) {
  const heightClass = size === "modal" ? "h-52" : "h-44";

  if (item.kind === "lens") {
    const { lens } = item;
    return (
      <div
        className={`relative flex ${heightClass} w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sky-50 via-slate-50 to-teal-50/70 p-4`}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky-200/30 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-teal-200/30 blur-2xl" />

        <svg
          viewBox="0 0 260 120"
          className="h-28 w-full max-w-[230px] drop-shadow-sm"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`lensGrad-${lens.id}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#bae6fd" stopOpacity="0.55" />
              <stop offset="100%" stopColor={item.accentHex} stopOpacity="0.28" />
            </radialGradient>
          </defs>
          {/* Lente óptica izquierda (vista frontal con reflejos antirreflejantes) */}
          <circle
            cx="85"
            cy="60"
            r="42"
            fill={`url(#lensGrad-${lens.id})`}
            stroke={item.accentHex}
            strokeWidth="2.2"
          />
          <circle
            cx="85"
            cy="60"
            r="34"
            fill="none"
            stroke="#0284c7"
            strokeDasharray="3 3"
            strokeWidth="1"
            opacity="0.55"
          />
          <path
            d="M 62 38 Q 80 28 102 40"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Lente óptica derecha */}
          <circle
            cx="175"
            cy="60"
            r="42"
            fill={`url(#lensGrad-${lens.id})`}
            stroke={item.accentHex}
            strokeWidth="2.2"
          />
          {lens.lens_type === "progresivo" && (
            <path
              d="M 160 35 C 170 55, 170 70, 162 92 M 190 35 C 180 55, 180 70, 188 92"
              fill="none"
              stroke="#0f766e"
              strokeWidth="1.4"
              strokeDasharray="2 2"
              opacity="0.7"
            />
          )}
          <path
            d="M 152 38 Q 170 28 192 40"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>

        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-medium text-slate-600">
          <span className="rounded-md bg-white/90 px-2 py-0.5 shadow-sm ring-1 ring-slate-200/80">
            Índice {lens.refractive_index.toFixed(2)}
          </span>
          <span className="rounded-md bg-sky-900/90 px-2 py-0.5 text-white shadow-sm">
            Ø {lens.diameter_mm} mm
          </span>
        </div>
      </div>
    );
  }

  const { frame } = item;
  const strokeColor = item.accentHex;
  const fillTint = item.lensTintHex ?? "rgba(224, 242, 254, 0.35)";

  return (
    <div
      className={`relative flex ${heightClass} w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-slate-100/90 p-4`}
    >
      <div className="pointer-events-none absolute inset-x-8 bottom-5 h-3 rounded-full bg-slate-900/5 blur-md" />

      <svg
        viewBox="0 0 280 110"
        className="h-24 w-full max-w-[240px] transition-transform duration-300 group-hover:scale-105"
        aria-hidden="true"
      >
        {/* Varillas laterales estilizadas */}
        <path
          d="M 18 46 L 40 42 M 262 46 L 240 42"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Puente central */}
        <path
          d="M 122 44 Q 140 34 158 44"
          fill="none"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {frame.shape === "aviador" && (
          <>
            <path
              d="M 122 36 L 158 36"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <path
              d="M 42 40 Q 82 32 122 42 Q 124 82 88 88 Q 46 86 42 40 Z"
              fill={fillTint}
              stroke={strokeColor}
              strokeWidth="3.8"
            />
            <path
              d="M 158 42 Q 198 32 238 40 Q 234 86 192 88 Q 156 82 158 42 Z"
              fill={fillTint}
              stroke={strokeColor}
              strokeWidth="3.8"
            />
          </>
        )}

        {frame.shape === "redondo" && (
          <>
            <ellipse
              cx="82"
              cy="56"
              rx="38"
              ry="32"
              fill={fillTint}
              stroke={strokeColor}
              strokeWidth="4.5"
            />
            <ellipse
              cx="198"
              cy="56"
              rx="38"
              ry="32"
              fill={fillTint}
              stroke={strokeColor}
              strokeWidth="4.5"
            />
          </>
        )}

        {frame.shape === "cat-eye" && (
          <>
            <path
              d="M 38 34 Q 82 28 122 44 Q 118 82 82 84 Q 44 82 38 34 Z"
              fill={fillTint}
              stroke={strokeColor}
              strokeWidth="4.5"
            />
            <path
              d="M 158 44 Q 198 28 242 34 Q 236 82 198 84 Q 162 82 158 44 Z"
              fill={fillTint}
              stroke={strokeColor}
              strokeWidth="4.5"
            />
          </>
        )}

        {(frame.shape === "rectangular" ||
          frame.shape === "cuadrado" ||
          frame.shape === "ovalado") && (
          <>
            <rect
              x="42"
              y="32"
              width="80"
              height={frame.shape === "rectangular" ? "44" : "50"}
              rx={frame.shape === "ovalado" ? "22" : "10"}
              fill={fillTint}
              stroke={strokeColor}
              strokeWidth="4.5"
            />
            <rect
              x="158"
              y="32"
              width="80"
              height={frame.shape === "rectangular" ? "44" : "50"}
              rx={frame.shape === "ovalado" ? "22" : "10"}
              fill={fillTint}
              stroke={strokeColor}
              strokeWidth="4.5"
            />
          </>
        )}

        {/* Brillo diagonal sobre las micas */}
        <path
          d="M 60 42 L 76 66 M 176 42 L 192 66"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>

      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-medium text-slate-600">
        <span className="rounded-md bg-white/90 px-2 py-0.5 capitalize shadow-sm ring-1 ring-slate-200/80">
          Forma: {frame.shape}
        </span>
        <span className="rounded-md bg-slate-900/85 px-2 py-0.5 font-mono text-white shadow-sm">
          {frame.lens_width_mm}-{frame.bridge_width_mm}-{frame.temple_length_mm} mm
        </span>
      </div>
    </div>
  );
}
