"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Search,
  ShieldCheck,
  Stethoscope,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { useRole } from "@/components/providers/RoleProvider";
import type { UserRole } from "@/types/database";

const ROLE_LABELS: Record<
  UserRole,
  { label: string; badge: string; description: string }
> = {
  admin: {
    label: "Admin",
    badge: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20",
    description: "Control total de usuarios, catálogo, citas y expedientes.",
  },
  optometrista: {
    label: "Optometrista",
    badge: "bg-teal-50 text-teal-700 ring-1 ring-teal-600/20",
    description: "Atención clínica, consultas, recetas OD/OI y citas asignadas.",
  },
  cliente: {
    label: "Cliente",
    badge: "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20",
    description: "Lectura de expediente propio y agendamiento de pruebas/citas.",
  },
  vendedor: {
    label: "Recepción / Ventas",
    badge: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20",
    description: "Gestión de agenda en sucursal y alta de pacientes.",
  },
};

export default function UsuariosAdminPage() {
  const { activeRole, setActiveRole, users, updateUserRole, currentUser } =
    useRole();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedInfo, setLastUpdatedInfo] = useState<{
    name: string;
    newRole: UserRole;
    userId: string;
  } | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const handleRoleChange = async (
    userId: string,
    name: string,
    newRole: UserRole
  ) => {
    setErrorMessage(null);
    setLastUpdatedInfo(null);
    setUpdatingUserId(userId);
    try {
      const updated = await updateUserRole(userId, newRole);
      setLastUpdatedInfo({
        userId: updated.id,
        name: updated.full_name ?? name,
        newRole: updated.role,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "No fue posible actualizar el rol del usuario."
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (activeRole !== "admin") {
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
                Política RLS Supabase (Código 42501 / FORBIDDEN 403)
              </span>
              <h1 className="mt-1.5 text-2xl font-bold text-slate-900">
                Vista restringida a Administradores
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Actualmente estás con el rol{" "}
                <strong className="font-semibold text-slate-900">
                  {currentUser.full_name} ({activeRole})
                </strong>
                . Según la matriz de acceso en{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                  API_CONTRACT.md
                </code>
                , solo el rol <code className="font-mono font-bold">admin</code>{" "}
                puede consultar <code>GET /api/users</code> y ejecutar{" "}
                <code className="font-mono">PATCH /api/users/:id/role</code>.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => setActiveRole("admin")}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:text-sm"
            >
              <ShieldCheck className="h-4 w-4" />
              Cambiar a rol Admin para gestionar usuarios
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a mi Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-sky-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-600/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Administración de Perfiles (GET /api/users)
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Gestión de Roles y Usuarios Registrados
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Administra los permisos del personal clínico, recepción y pacientes
            registrados en <code>public.profiles</code>.
          </p>
        </div>

        <div className="rounded-xl bg-slate-900 px-4 py-3 text-xs text-slate-300">
          <div className="font-mono text-[11px] text-sky-400">
            PATCH /api/users/:id/role
          </div>
          <div className="mt-0.5 text-slate-400">
            Roles: <code>admin</code>, <code>optometrista</code>,{" "}
            <code>vendedor</code>, <code>cliente</code>
          </div>
        </div>
      </div>

      {/* Resumen por rol */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Usuarios
            </span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {users.length}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Perfiles activos en clínica
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Administradores
            </span>
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-950">
            {users.filter((u) => u.role === "admin").length}
          </p>
          <p className="mt-0.5 text-xs text-indigo-700/80">
            Acceso global y cambio de roles
          </p>
        </div>

        <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Optometristas
            </span>
            <Stethoscope className="h-4 w-4 text-teal-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-teal-950">
            {users.filter((u) => u.role === "optometrista").length}
          </p>
          <p className="mt-0.5 text-xs text-teal-700/80">
            Cédula profesional y consulta clínica
          </p>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">
              Clientes y Recepción
            </span>
            <User className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-sky-950">
            {
              users.filter(
                (u) => u.role === "cliente" || u.role === "vendedor"
              ).length
            }
          </p>
          <p className="mt-0.5 text-xs text-sky-700/80">
            Pacientes y personal de sucursal
          </p>
        </div>
      </div>

      {/* Error o confirmación de actualización de rol */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-900 sm:text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {lastUpdatedInfo && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 sm:text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>
              Rol actualizado para <strong>{lastUpdatedInfo.name}</strong> a{" "}
              <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono font-bold text-emerald-800">
                {lastUpdatedInfo.newRole}
              </code>{" "}
              <span className="hidden text-emerald-700 sm:inline">
                (PATCH /api/users/{lastUpdatedInfo.userId.slice(0, 8)}…/role)
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLastUpdatedInfo(null)}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Ocultar
          </button>
        </div>
      )}

      {/* Filtros de tabla */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuario por nombre, correo o UUID..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none sm:text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            ["all", "admin", "optometrista", "vendedor", "cliente"] as const
          ).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                roleFilter === r
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {r === "all"
                ? "Todos los roles"
                : r === "vendedor"
                  ? "Recepción (vendedor)"
                  : ROLE_LABELS[r].label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Usuarios y Asignación de Rol */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Usuario / Correo</th>
                <th className="px-6 py-3.5">UUID Perfil</th>
                <th className="px-6 py-3.5">Rol Actual</th>
                <th className="px-6 py-3.5">Permisos RLS</th>
                <th className="px-6 py-3.5">
                  Cambiar Rol (Admin, Optometrista, Recepción, Cliente)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredUsers.map((user) => {
                const roleMeta = ROLE_LABELS[user.role];
                const initials = (user.full_name ?? user.email)
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();

                return (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-600 text-xs font-bold text-white">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {user.full_name ?? "Sin nombre"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-1">
                        {user.id.slice(0, 8)}…{user.id.slice(-4)}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${roleMeta.badge}`}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        {roleMeta.label}
                      </span>
                    </td>

                    <td className="max-w-xs px-6 py-4 text-xs text-slate-500">
                      {roleMeta.description}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Cambiar rol de ${user.full_name ?? user.email}`}
                          value={user.role}
                          disabled={updatingUserId === user.id}
                          onChange={(e) =>
                            void handleRoleChange(
                              user.id,
                              user.full_name ?? user.email,
                              e.target.value as UserRole
                            )
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                        >
                          <option value="admin">Admin</option>
                          <option value="optometrista">Optometrista</option>
                          <option value="vendedor">
                            Recepción / Ventas (vendedor)
                          </option>
                          <option value="cliente">Cliente</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
