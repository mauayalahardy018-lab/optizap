import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/components/providers/RoleProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Optizap | Clínica Óptica Premium & Boutique de Marcas",
  description:
    "Plataforma integral para clínica óptica: catálogo oficial Ray-Ban, Oakley, Persol, Tom Ford, Essilor y ZEISS, agendamiento y expediente clínico.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
        <RoleProvider>
          <Navbar />
          <div className="flex-1">{children}</div>
          <Footer />
        </RoleProvider>
      </body>
    </html>
  );
}
