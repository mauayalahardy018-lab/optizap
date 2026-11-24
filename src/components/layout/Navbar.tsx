"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Eye,
  FileText,
  Glasses,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
} from "lucide-react";
import { useRole } from "@/components/providers/RoleProvider";
import type { UserRole } from "@/types/database";

const ROLE_OPTIONS: {
  role: UserRole;
  label: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    role: "admin",
    label: "Admin",
    badgeClass: "bg-indigo-600 text-white shadow-sm",
    icon: ShieldCheck,
  },
  {
    role: "optometrista",
    label: "Optometrista",
    badgeClass: "bg-teal-600 text-white shadow-sm",
    icon: Stethoscope,
  },
  {
    role: "cliente",
    label: "Cliente",
    badgeClass: "bg-sky-600 text-white shadow-sm",
    icon: User,
  },
];

export function Navbar() {
  const pathname = usePathname();
  const { currentUser, activeRole, setActiveRole } = useRole();

  const navItems = [
    {
      href: "/",
      label: "Inicio",
      icon: Eye,
      exact: true,
    },
    {
      href: "/catalogo",
      label: "Catálogo",
      icon: Glasses,
      exact: false,
    },
    {
      href: "/inventario",
      label: "Inventario",
      icon: Package,
      exact: false,
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: "/citas",
      label: "Citas",
      icon: Calendar,
      exact: false,
    },
    {
      href: "/historial",
      label: "Historial Clínico",
      icon: FileText,
      exact: false,
    },
    {
      href: "/dashboard/usuarios",
      label: "Usuarios y Roles",
      icon: Users,
      exact: false,
      adminHighlight: true,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      {/* Barra superior informativa clínica y simulador de sesión */}
      <div className="border-b border-slate-100 bg-slate-900 text-slate-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-white">
              Sesión activa: {currentUser.full_name}
            </span>
            <span className="hidden text-slate-400 sm:inline">
              ({currentUser.email})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Simular Rol:
            </span>
            <div
              role="group"
              aria-label="Selector de rol de sesión"
              className="inline-flex items-center rounded-lg bg-slate-800 p-0.5 ring-1 ring-slate-700"
            >
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = activeRole === option.role;
                return (
                  <button
                    key={option.role}
                    type="button"
                    onClick={() => setActiveRole(option.role)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? option.badgeClass
                        : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Navegación principal */}
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-teal-700 text-white shadow-md shadow-sky-600/20 transition-transform group-hover:scale-105">
              <Glasses className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  Optizap
                </span>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 ring-1 ring-sky-600/20">
                  Clínica & Boutique
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Salud Visual de Alta Precisión • CDMX
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                  isActive
                    ? "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {item.adminHighlight && (
                  <span
                    className={`ml-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      activeRole === "admin"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    Admin
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
