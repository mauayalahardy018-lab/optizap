"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type FrameSummary = { id: string; sku: string; name: string; stock: number };
type MovementSummary = { id: string; frame_id: string; delta: number; stock_after: number; created_at: string };

export default function InventarioPage() {
  const [db] = useState(() => createBrowserSupabaseClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameSummary[]>([]);
  const [movements, setMovements] = useState<MovementSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: userData, error: userError } = await db.auth.getUser();
      if (userError || !userData.user) {
        setAuthenticated(false); setRole(null); setFrames([]); setMovements([]);
        return;
      }
      setAuthenticated(true);
      const { data: profile, error: profileError } = await db.from("profiles")
        .select("role").eq("id", userData.user.id).single();
      if (profileError) throw profileError;
      const actualRole = profile.role;
      setRole(actualRole);
      if (actualRole !== "admin" && actualRole !== "vendedor") return;
      const [products, events] = await Promise.all([
        db.from("frames").select("id,sku,name,stock").eq("is_active", true).order("sku").limit(100),
        db.from("stock_movements").select("id,frame_id,delta,stock_after,created_at")
          .order("created_at", { ascending: false }).limit(20),
      ]);
      if (products.error) throw products.error;
      if (events.error) throw events.error;
      setFrames(products.data ?? []);
      setMovements(events.data ?? []);
    } catch {
      setError("No fue posible consultar el inventario. Revisa la conexión y los permisos.");
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void refresh();
    const { data } = db.auth.onAuthStateChange(() => { void refresh(); });
    return () => data.subscription.unsubscribe();
  }, [db, refresh]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const result = await db.auth.signInWithPassword({ email: email.trim(), password });
    setPassword("");
    if (result.error) setError("No se pudo iniciar sesión. Revisa tus datos.");
    else void refresh();
  }

  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Inventario compartido</h1>
        <p className="text-slate-600">El teléfono registra movimientos; esta vista consulta el mismo stock en Supabase.</p>
      </div>
      {authenticated && <div className="flex gap-2">
        <button type="button" onClick={() => void refresh()} className="rounded-lg bg-sky-700 px-4 py-2 text-white">Actualizar</button>
        <button type="button" onClick={() => void db.auth.signOut()} className="rounded-lg border px-4 py-2">Salir</button>
      </div>}
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {loading ? <p>Cargando…</p> : !authenticated
      ? <form onSubmit={login} className="max-w-md space-y-3 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">Acceso del personal</h2>
          <input className="w-full rounded-lg border p-3" type="email" required autoComplete="username"
            placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full rounded-lg border p-3" type="password" required autoComplete="current-password"
            placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="rounded-lg bg-sky-700 px-4 py-2 text-white">Entrar</button>
        </form>
      : role !== "admin" && role !== "vendedor"
        ? <p className="rounded-xl bg-white p-5">Tu rol no permite consultar el inventario del personal.</p>
        : <>
          <section className="overflow-x-auto rounded-xl bg-white p-5 shadow">
            <h2 className="mb-3 text-xl font-semibold">Armazones</h2>
            <table className="w-full text-left"><thead><tr><th className="p-2">SKU</th><th className="p-2">Nombre</th><th className="p-2">Existencia</th></tr></thead>
              <tbody>{frames.map(frame => <tr key={frame.id} className="border-t"><td className="p-2">{frame.sku}</td><td className="p-2">{frame.name}</td><td className="p-2">{frame.stock}</td></tr>)}</tbody>
            </table>
            {frames.length === 0 && <p className="py-3 text-slate-500">No hay armazones activos.</p>}
          </section>
          <section className="rounded-xl bg-white p-5 shadow">
            <h2 className="mb-3 text-xl font-semibold">Últimos movimientos</h2>
            {movements.length === 0 && <p className="text-slate-500">Aún no hay movimientos.</p>}
            <ul className="space-y-2">{movements.map(item => <li key={item.id} className="border-b pb-2">
              <strong>{frames.find(frame => frame.id === item.frame_id)?.sku ?? "Armazón"}</strong>
              {" · "}{item.delta > 0 ? "+" : ""}{item.delta} unidades
              {" · saldo "}{item.stock_after}
            </li>)}</ul>
          </section>
        </>}
  </main>;
}
