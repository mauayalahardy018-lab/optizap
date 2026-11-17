import React from "react";
import { CatalogExplorer } from "@/components/catalog/CatalogExplorer";

export default function CatalogoPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <CatalogExplorer showHeader={true} />
    </main>
  );
}
