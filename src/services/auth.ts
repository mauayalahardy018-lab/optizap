import type { AuthError, User } from "@supabase/supabase-js";
import type { AuthLoginInput, AuthLoginResult, AuthLogoutResult, AuthRegisterInput, AuthRegisterResult } from "../types/database";
import { SupabaseConfigurationError } from "../lib/supabase/config";
import { choice, invalid, parse, ServiceError, text, type Client, type Rule } from "./core";

const email: Rule = (value,key) => {
  const result = text(254)(value,key) as string;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) invalid("El correo electrónico es inválido.");
  return result;
};
const password = (min: number): Rule => value => {
  // Never trim or otherwise alter passwords.
  if (typeof value !== "string" || value.length < min || value.length > 128) invalid(`La contraseña debe tener entre ${min} y 128 caracteres.`);
  return value;
};
const summary = (user: User) => ({ id: user.id, email: user.email ?? null });
function authError(error: AuthError | null): void {
  if (!error) return;
  if (error.status === 429) throw new ServiceError("RATE_LIMITED","Demasiados intentos. Espera un momento antes de volver a intentar.",429);
  if (error.code === "invalid_credentials") throw new ServiceError("INVALID_CREDENTIALS","Correo o contraseña incorrectos.",401);
  if (error.code === "email_not_confirmed") throw new ServiceError("EMAIL_NOT_CONFIRMED","Confirma tu correo antes de iniciar sesión.",403);
  if (["weak_password","email_address_invalid","validation_failed"].includes(error.code ?? "")) invalid("Revisa el correo y los requisitos de la contraseña.");
  throw new ServiceError("UNAVAILABLE","No fue posible completar la autenticación. Intenta nuevamente.",503);
}
export function getSiteOrigin(value = process.env.SITE_URL): string {
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    if (!["http:","https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw new SupabaseConfigurationError("SITE_URL debe ser el origen HTTP/HTTPS de Optizap."); }
}
/** Resolve to a fixed trusted origin; never reflect a host/header into redirects. */
export function confirmationRedirect(next: unknown, siteOrigin: string): string {
  const path = next === undefined ? "/" : text(2000)(next,"next") as string;
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\r\n]/.test(path)) invalid("El destino de redirección no está permitido.");
  const target = new URL(path,siteOrigin);
  if (target.origin !== siteOrigin) invalid("El destino de redirección no está permitido.");
  return target.toString();
}

export function createAuthService(db: Client, options: { siteUrl?: string } = {}) {
  return {
    async login(input: unknown): Promise<AuthLoginResult> {
      const payload = parse<AuthLoginInput>(input,{ email, password: password(1) },["email","password"]);
      const result = await db.auth.signInWithPassword(payload);
      authError(result.error);
      if (!result.data.user || !result.data.session) throw new ServiceError("UNAVAILABLE","No fue posible iniciar la sesión.",503);
      return { user: summary(result.data.user) };
    },
    async register(input: unknown): Promise<AuthRegisterResult> {
      const payload = parse<AuthRegisterInput>(input,{ email, password: password(8), full_name: text(200) },["email","password","full_name"]);
      const result = await db.auth.signUp({
        email: payload.email, password: payload.password,
        options: {
          data: { full_name: payload.full_name },
          emailRedirectTo: `${getSiteOrigin(options.siteUrl)}/api/auth/callback`,
        },
      });
      // Do not disclose account existence; Auth can also return an obfuscated user.
      if (["user_already_exists","email_exists"].includes(result.error?.code ?? "")) return { user: null, requires_email_confirmation: true };
      authError(result.error);
      return {
        user: result.data.session && result.data.user ? summary(result.data.user) : null,
        requires_email_confirmation: !result.data.session,
      };
    },
    async logout(input: unknown = {}): Promise<AuthLogoutResult> {
      parse(input,{});
      const result = await db.auth.signOut({ scope: "local" });
      if (result.error?.name !== "AuthSessionMissingError") authError(result.error);
      return { signed_out: true };
    },
    async confirmEmail(input: unknown): Promise<string> {
      const payload = parse<{ token_hash: string; type: "email" | "signup"; next?: string }>(input,{
        token_hash: text(2048), type: choice(["email","signup"]), next: text(2000),
      },["token_hash","type"]);
      const redirect = confirmationRedirect(payload.next,getSiteOrigin(options.siteUrl));
      const result = await db.auth.verifyOtp({ token_hash: payload.token_hash, type: payload.type });
      if (result.error || !result.data.session) {
        if (result.error?.status === 429) authError(result.error);
        throw new ServiceError("INVALID_CONFIRMATION","El enlace de confirmación es inválido o ha vencido.",400);
      }
      return redirect;
    },
    async exchangeCode(input: unknown): Promise<string> {
      const payload = parse<{ code: string; next?: string }>(input,{ code: text(4096), next: text(2000) },["code"]);
      const redirect = confirmationRedirect(payload.next,getSiteOrigin(options.siteUrl));
      const result = await db.auth.exchangeCodeForSession(payload.code);
      if (result.error || !result.data.session) {
        if (result.error?.status === 429) authError(result.error);
        throw new ServiceError("INVALID_CONFIRMATION","El enlace no se puede completar. Ábrelo en el navegador del registro o vuelve a iniciar sesión.",400);
      }
      return redirect;
    },
  };
}
