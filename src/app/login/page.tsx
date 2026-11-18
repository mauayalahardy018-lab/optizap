"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Glasses,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useRole } from "@/components/providers/RoleProvider";
import { FrontendApiError } from "@/components/providers/apiClient";

function getSafeNextPath(rawNext: string | null): string {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) {
    return "/";
  }
  return rawNext;
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const confirmedParam = searchParams.get("confirmed");

  const {
    currentUser,
    activeRole,
    isDemoMode,
    isSupabaseConfigured,
    signInWithPassword,
    signOut,
  } = useRole();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorCode(null);

    if (password.length < 1 || password.length > 128) {
      setErrorMessage("La contraseña debe tener entre 1 y 128 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      if (err instanceof FrontendApiError) {
        setErrorCode(err.code);
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "No fue posible iniciar sesión. Intenta nuevamente."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isDemoMode) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Sesión Activa</h1>
            <p className="text-xs text-slate-500">
              Ya iniciaste sesión con Supabase Auth SSR
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">
            {currentUser.full_name}
          </p>
          <p className="text-xs text-slate-500">{currentUser.email}</p>
          <p className="mt-2 inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase text-emerald-800">
            Rol: {activeRole}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            <span>Ir al Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-teal-700 text-white shadow-sm">
          <Glasses className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Iniciar Sesión
          </h1>
          <p className="text-xs text-slate-500">
            Accede a tu cuenta de Optizap mediante sesión SSR
          </p>
        </div>
      </div>

      {confirmedParam === "true" && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p>
            Correo confirmado correctamente. Ya puedes iniciar sesión con tu
            contraseña.
          </p>
        </div>
      )}

      {!isSupabaseConfigured && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Modo Demo activo (sin Supabase)</p>
            <p className="mt-0.5">
              No se detectaron credenciales de Supabase en el entorno. Puedes
              usar el selector rápido de roles en la barra superior para probar
              las vistas.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold">{errorMessage}</p>
            {errorCode === "EMAIL_NOT_CONFIRMED" && (
              <p className="mt-1 text-rose-700">
                Revisa tu bandeja de entrada o carpeta de spam para confirmar tu
                cuenta.
              </p>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-slate-700"
          >
            Correo electrónico
          </label>
          <div className="relative mt-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@optizap.mx"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 transition focus:border-sky-500 focus:bg-white focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold text-slate-700"
          >
            Contraseña
          </label>
          <div className="relative mt-1">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={1}
              maxLength={128}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-900 transition focus:border-sky-500 focus:bg-white focus:outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
        >
          <LogIn className="h-4 w-4" />
          <span>{isSubmitting ? "Verificando..." : "Iniciar Sesión"}</span>
        </button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-600">
        ¿Aún no tienes cuenta?{" "}
        <Link
          href="/registro"
          className="font-semibold text-sky-600 hover:text-sky-700"
        >
          Crear cuenta en Optizap
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Cargando formulario de inicio de sesión...
          </div>
        }
      >
        <LoginFormContent />
      </Suspense>
    </main>
  );
}
