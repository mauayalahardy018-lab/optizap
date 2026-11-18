"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Calendar,
  Eye,
  FileText,
  Glasses,
  LayoutDashboard,
  LogIn,
  LogOut,
  ShieldCheck,
  Stethoscope,
  User,
  UserPlus,
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
    role: "vendedor",
    label: "Recepción",
    badgeClass: "bg-amber-600 text-white shadow-sm",
    icon: Briefcase,
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
  const router = useRouter();
  const {
    currentUser,
    activeRole,
    isDemoMode,
    isSupabaseConfigured,
    setActiveRole,
    signOut,
  } = useRole();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

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
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        {/* Barra superior de sesión Supabase Auth / Modo Demo */}
        <div className="border-b border-slate-100 bg-slate-900 text-slate-200">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  !isDemoMode
                    ? "bg-emerald-400"
                    : isSupabaseConfigured
                    ? "bg-slate-400"
                    : "bg-amber-400"
                }`}
              />
              {!isDemoMode ? (
                <>
                  <span className="font-medium text-white">
                    Sesión Supabase Auth: {currentUser.full_name}
                  </span>
                  <span className="hidden text-slate-400 sm:inline">
                    ({currentUser.email})
                  </span>
                </>
              ) : isSupabaseConfigured ? (
                <span className="font-medium text-slate-200">
                  Sesión no iniciada • Inicia sesión o regístrate para acceder a
                  tu cuenta
                </span>
              ) : (
                <>
                  <span className="font-medium text-white">
                    Modo Demo (Sin Supabase): {currentUser.full_name}
                  </span>
                  <span className="hidden text-slate-400 sm:inline">
                    ({currentUser.email})
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isDemoMode ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold uppercase text-emerald-300 ring-1 ring-emerald-400/30">
                    Rol Auth: {activeRole}
                  </span>
                  <button
                    type="button"
                    disabled={isSigningOut}
                    onClick={() => void handleSignOut()}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{isSigningOut ? "Saliendo..." : "Cerrar sesión"}</span>
                  </button>
                </div>
              ) : (
                <>
                  {!isSupabaseConfigured && (
                    <>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        Rol Demo:
                      </span>
                      <div
                        role="group"
                        aria-label="Selector rápido de rol en modo demo"
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
                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
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
                    </>
                  )}
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-300 ring-1 ring-sky-400/30 transition hover:bg-sky-500/30"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>Iniciar Sesión</span>
                  </Link>
                  <Link
                    href="/registro"
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700 hover:text-white"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Registrarse</span>
                  </Link>
                </>
              )}
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
    </>
  );
}
