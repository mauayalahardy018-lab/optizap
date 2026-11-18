"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Users,
  X,
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
  const {
    currentUser,
    activeRole,
    isDemoMode,
    setActiveRole,
    signInWithPassword,
    signOut,
  } = useRole();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);
    try {
      await signInWithPassword(email, password);
      setShowLoginModal(false);
      setEmail("");
      setPassword("");
    } catch (err) {
      setLoginError(
        err instanceof Error
          ? err.message
          : "No fue posible iniciar sesión con Supabase Auth."
      );
    } finally {
      setIsSubmitting(false);
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
                  isDemoMode ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
              <span className="font-medium text-white">
                {isDemoMode ? "Modo Demo / Dev:" : "Sesión Supabase Auth:"}{" "}
                {currentUser.full_name}
              </span>
              <span className="hidden text-slate-400 sm:inline">
                ({currentUser.email})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isDemoMode ? (
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
                  <button
                    type="button"
                    onClick={() => setShowLoginModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-300 ring-1 ring-sky-400/30 transition hover:bg-sky-500/30"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>Login Real</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold uppercase text-emerald-300 ring-1 ring-emerald-400/30">
                    Rol Auth: {activeRole}
                  </span>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
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

      {/* Modal de inicio de sesión con Supabase Auth (@supabase/ssr) */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Iniciar Sesión en Optizap
                </h2>
                <p className="text-xs text-slate-500">
                  Autenticación SSR mediante cookies de Supabase Auth
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loginError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@optizap.mx"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Continuar en Modo Demo
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Verificando..." : "Iniciar Sesión"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
