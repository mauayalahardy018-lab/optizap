import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optizap | Plataforma Integral para Ópticas",
  description: "Gestión clínica, inventario, catálogo de marcas y punto de venta para ópticas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
