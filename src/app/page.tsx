export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-xl space-y-4">
        <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
          Optizap v0.1.0
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Bienvenido a Optizap
        </h1>
        <p className="text-base text-slate-600">
          Plataforma de gestión óptica y catálogo de armazones inicializada con Next.js, TypeScript y Tailwind CSS.
        </p>
      </div>
    </main>
  );
}
