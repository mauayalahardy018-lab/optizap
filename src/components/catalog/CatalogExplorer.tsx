"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Database,
  Eye,
  Filter,
  Loader2,
  Ruler,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import type { Brand, FrameMaterial, LensMaterial } from "@/types/database";
import {
  MOCK_BRANDS,
  MOCK_CATALOG_ITEMS,
  catalogProductToItem,
  formatFrameMeasurements,
  formatPriceMXN,
  type CatalogItem,
  type CatalogProductCategory,
} from "./mockCatalogData";
import {
  fetchBrandsApi,
  fetchCatalogProductsApi,
} from "@/components/providers/apiClient";
import { ProductVisual } from "./ProductVisual";
import { ProductDetailModal } from "./ProductDetailModal";

const CATEGORY_TABS: {
  key: "all" | CatalogProductCategory;
  label: string;
}[] = [
    { key: "all", label: "Todo el Catálogo" },
    { key: "armazones_oftalmicos", label: "Armazones oftálmicos" },
    { key: "lentes_sol", label: "Lentes de sol" },
    { key: "micas_tratamientos", label: "Micas/Tratamientos" },
  ];

const FRAME_MATERIALS = new Set<string>([
  "acetato",
  "metal",
  "titanio",
  "tr90",
  "mixto",
]);
const LENS_MATERIALS = new Set<string>([
  "cr39",
  "policarbonato",
  "trivex",
  "alto_indice",
  "mineral",
]);

export function CatalogExplorer({
  showHeader = true,
}: {
  showHeader?: boolean;
}) {
  const [brands, setBrands] = useState<Brand[]>(MOCK_BRANDS);
  const [apiItems, setApiItems] = useState<CatalogItem[] | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<"supabase" | "demo">("demo");

  const [selectedBrandSlug, setSelectedBrandSlug] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | CatalogProductCategory
  >("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<
    "featured" | "price_asc" | "price_desc"
  >("featured");
  const [activeModalItem, setActiveModalItem] = useState<CatalogItem | null>(
    null
  );

  // 1. Cargar marcas reales desde GET /api/brands
  useEffect(() => {
    let cancelled = false;
    fetchBrandsApi()
      .then((realBrands) => {
        if (!cancelled && realBrands.length > 0) {
          setBrands(realBrands);
        }
      })
      .catch(() => {
        // Fallback silencioso a MOCK_BRANDS si el backend aún no tiene .env configurado
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Consultar productos reales desde /api/catalog/frames y /api/catalog/lenses
  useEffect(() => {
    let cancelled = false;

    const fetchFromBackend = async () => {
      setIsLoadingCatalog(true);
      try {
        const selectedBrand =
          selectedBrandSlug === "all"
            ? undefined
            : brands.find((b) => b.slug === selectedBrandSlug);
        const brandId = selectedBrand?.id;

        const isFrameMaterial = FRAME_MATERIALS.has(selectedMaterial);
        const isLensMaterial = LENS_MATERIALS.has(selectedMaterial);

        const shouldQueryFrames =
          (selectedCategory === "all" ||
            selectedCategory === "armazones_oftalmicos" ||
            selectedCategory === "lentes_sol") &&
          !isLensMaterial;

        const shouldQueryLenses =
          (selectedCategory === "all" ||
            selectedCategory === "micas_tratamientos") &&
          !isFrameMaterial;

        const segmentFilter =
          selectedCategory === "armazones_oftalmicos"
            ? "oftalmico"
            : selectedCategory === "lentes_sol"
              ? "solar"
              : undefined;

        const [framesPage, lensesPage] = await Promise.all([
          shouldQueryFrames
            ? fetchCatalogProductsApi("frames", {
              brand_id: brandId,
              segment: segmentFilter,
              material: isFrameMaterial
                ? (selectedMaterial as FrameMaterial)
                : undefined,
              sort: sortOrder,
              search: searchQuery.trim() || undefined,
              limit: 50,
            })
            : Promise.resolve(null),
          shouldQueryLenses
            ? fetchCatalogProductsApi("lenses", {
              brand_id: brandId,
              material: isLensMaterial
                ? (selectedMaterial as LensMaterial)
                : undefined,
              sort: sortOrder,
              search: searchQuery.trim() || undefined,
              limit: 50,
            })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const mappedFrames = (framesPage?.items ?? []).map((p) =>
          catalogProductToItem(p, "frames")
        );
        const mappedLenses = (lensesPage?.items ?? []).map((p) =>
          catalogProductToItem(p, "lenses")
        );
        const combined = [...mappedFrames, ...mappedLenses];

        if (combined.length > 0) {
          setApiItems(combined);
          setDataSource("supabase");
        } else {
          // Si la base de datos aún no tiene productos sembrados (solo las 6 marcas de la migración),
          // mostramos el catálogo demo local cuando no hay resultados en una consulta general,
          // o el array vacío si ya está en modo supabase activo
          setApiItems(null);
          setDataSource("demo");
        }
      } catch {
        if (!cancelled) {
          setApiItems(null);
          setDataSource("demo");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCatalog(false);
        }
      }
    };

    void fetchFromBackend();

    return () => {
      cancelled = true;
    };
  }, [
    brands,
    selectedBrandSlug,
    selectedCategory,
    selectedMaterial,
    searchQuery,
    sortOrder,
  ]);

  const filteredItems = useMemo(() => {
    if (apiItems !== null) {
      if (sortOrder === "price_asc") {
        return [...apiItems].sort((a, b) => {
          const pa = a.kind === "frame" ? a.frame.price : a.lens.price;
          const pb = b.kind === "frame" ? b.frame.price : b.lens.price;
          return pa - pb;
        });
      }
      if (sortOrder === "price_desc") {
        return [...apiItems].sort((a, b) => {
          const pa = a.kind === "frame" ? a.frame.price : a.lens.price;
          const pb = b.kind === "frame" ? b.frame.price : b.lens.price;
          return pb - pa;
        });
      }
      return apiItems;
    }

    const q = searchQuery.trim().toLowerCase();

    const filtered = MOCK_CATALOG_ITEMS.filter((item) => {
      if (selectedBrandSlug !== "all" && item.brand.slug !== selectedBrandSlug) {
        return false;
      }

      if (selectedCategory !== "all" && item.categoryKey !== selectedCategory) {
        return false;
      }

      if (selectedMaterial !== "all") {
        const rawMaterial =
          item.kind === "frame" ? item.frame.material : item.lens.material;
        if (rawMaterial !== selectedMaterial) {
          return false;
        }
      }

      if (q.length > 0) {
        const sku = (
          item.kind === "frame" ? item.frame.sku : item.lens.sku
        ).toLowerCase();
        const name = (
          item.kind === "frame" ? item.frame.name : item.lens.name
        ).toLowerCase();
        const brandName = item.brand.name.toLowerCase();
        const matDisplay = item.materialDisplay.toLowerCase();

        if (
          !sku.includes(q) &&
          !name.includes(q) &&
          !brandName.includes(q) &&
          !matDisplay.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });

    if (sortOrder === "price_asc") {
      return [...filtered].sort((a, b) => {
        const pa = a.kind === "frame" ? a.frame.price : a.lens.price;
        const pb = b.kind === "frame" ? b.frame.price : b.lens.price;
        return pa - pb;
      });
    }

    if (sortOrder === "price_desc") {
      return [...filtered].sort((a, b) => {
        const pa = a.kind === "frame" ? a.frame.price : a.lens.price;
        const pb = b.kind === "frame" ? b.frame.price : b.lens.price;
        return pb - pa;
      });
    }

    return filtered;
  }, [
    apiItems,
    selectedBrandSlug,
    selectedCategory,
    selectedMaterial,
    searchQuery,
    sortOrder,
  ]);

  const resetFilters = () => {
    setSelectedBrandSlug("all");
    setSelectedCategory("all");
    setSelectedMaterial("all");
    setSearchQuery("");
    setSortOrder("featured");
  };

  return (
    <section id="catalogo-optizap" className="space-y-8">
      {showHeader && (
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-600/20">
                <Sparkles className="h-3.5 w-3.5" />
                Catálogo Oficial Autorizado
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${dataSource === "supabase"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                    : "bg-slate-100 text-slate-600"
                  }`}
              >
                <Database className="h-3 w-3" />
                {dataSource === "supabase"
                  ? "Conectado a /api/catalog"
                  : "Catálogo Demo / Fallback"}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Marcas Internacionales, Armazones y Micas Oftálmicas
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Explora monturas graduables, lentes solares polarizados y micas de
              alta precisión con medidas milimétricas exactas y disponibilidad en
              clínica.
            </p>
          </div>
          <div className="flex items-center gap-2 text-right text-xs text-slate-500">
            {isLoadingCatalog && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
            )}
            <span>
              Mostrando{" "}
              <strong className="font-semibold text-slate-900">
                {filteredItems.length}
              </strong>{" "}
              productos clínicos
            </span>
          </div>
        </div>
      )}

      {/* Selector visual de las 6 marcas oficiales */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Filtrar por Marca Oficial
          </h2>
          {selectedBrandSlug !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedBrandSlug("all")}
              className="text-xs font-medium text-sky-700 hover:underline"
            >
              Ver todas las marcas
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          <button
            type="button"
            onClick={() => setSelectedBrandSlug("all")}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${selectedBrandSlug === "all"
                ? "border-sky-600 bg-sky-50/70 shadow-sm ring-1 ring-sky-600"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">
              Todas
            </span>
            <span className="mt-1 text-sm font-bold text-slate-900">
              {brands.length} Marcas
            </span>
            <span className="mt-0.5 text-[11px] text-slate-500">
              Catálogo oficial
            </span>
          </button>

          {brands.map((brand) => {
            const isSelected = selectedBrandSlug === brand.slug;
            const count = MOCK_CATALOG_ITEMS.filter(
              (i) => i.brand.slug === brand.slug
            ).length;

            return (
              <button
                key={brand.id}
                type="button"
                onClick={() =>
                  setSelectedBrandSlug(isSelected ? "all" : brand.slug)
                }
                className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${isSelected
                    ? "border-sky-600 bg-sky-50/70 shadow-sm ring-1 ring-sky-600"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {brand.country?.split("/")[0]}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-slate-600">
                    {brand.category}
                  </span>
                </div>
                <span className="mt-1.5 text-sm font-bold text-slate-900">
                  {brand.name}
                </span>
                <span className="mt-0.5 text-[11px] text-slate-500">
                  {brand.frames_count ?? count} referencias
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de filtros por categoría, buscador por SKU/Modelo y material */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Pestañas de categoría */}
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {CATEGORY_TABS.map((tab) => {
              const active = selectedCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm ${active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Buscador por SKU o modelo y selectores */}
          <div className="flex flex-1 flex-col gap-2.5 sm:flex-row lg:max-w-xl lg:justify-end">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por SKU (ej. RB5154, TF5401) o modelo..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none sm:text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <select
                  aria-label="Filtrar por material"
                  value={selectedMaterial}
                  onChange={(e) => setSelectedMaterial(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-6 py-2 text-xs font-medium text-slate-700 focus:border-sky-500 focus:bg-white focus:outline-none"
                >
                  <option value="all">Material: Todos</option>
                  <option value="acetato">Acetato</option>
                  <option value="titanio">Titanio</option>
                  <option value="tr90">O Matter / TR90</option>
                  <option value="metal">Metal</option>
                  <option value="mixto">Mixto (Acetato/Metal)</option>
                  <option value="alto_indice">Mica Alto Índice</option>
                  <option value="trivex">Mica Trivex</option>
                </select>
              </div>

              <div className="relative">
                <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <select
                  aria-label="Ordenar por precio"
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(
                      e.target.value as "featured" | "price_asc" | "price_desc"
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-6 py-2 text-xs font-medium text-slate-700 focus:border-sky-500 focus:bg-white focus:outline-none"
                >
                  <option value="featured">Destacados</option>
                  <option value="price_asc">Precio: Menor a Mayor</option>
                  <option value="price_desc">Precio: Mayor a Menor</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de tarjetas de productos */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Search className="h-8 w-8 text-slate-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            No encontramos productos con esos filtros
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            Prueba buscando otro código SKU (por ejemplo{" "}
            <code className="font-mono text-slate-700">RB5154-2000</code>,{" "}
            <code className="font-mono text-slate-700">OX5132</code> o{" "}
            <code className="font-mono text-slate-700">ESS-VX</code>) o
            restablece los filtros activos.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isFrame = item.kind === "frame";
            const id = isFrame ? item.frame.id : item.lens.id;
            const sku = isFrame ? item.frame.sku : item.lens.sku;
            const name = isFrame ? item.frame.name : item.lens.name;
            const price = isFrame ? item.frame.price : item.lens.price;
            const measurements = isFrame
              ? `${formatFrameMeasurements(item.frame)} mm`
              : `Ø ${item.lens.diameter_mm} mm • Índ. ${item.lens.refractive_index.toFixed(2)}`;

            return (
              <article
                key={id}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
              >
                <div>
                  {/* Cabecera de la tarjeta: Marca y Categoría */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                      {item.brand.name}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${item.categoryKey === "armazones_oftalmicos"
                          ? "bg-sky-50 text-sky-700 ring-1 ring-sky-600/15"
                          : item.categoryKey === "lentes_sol"
                            ? "bg-amber-50 text-amber-800 ring-1 ring-amber-600/15"
                            : "bg-teal-50 text-teal-800 ring-1 ring-teal-600/15"
                        }`}
                    >
                      {item.categoryLabel}
                    </span>
                  </div>

                  {/* Ilustración óptica */}
                  <div
                    onClick={() => setActiveModalItem(item)}
                    className="cursor-pointer"
                  >
                    <ProductVisual item={item} size="card" />
                  </div>

                  {/* Datos clave obligatorios: Modelo, SKU oficial, Material, Medidas (mm) */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-mono font-medium text-slate-600">
                        <Tag className="h-3 w-3 text-sky-600" />
                        SKU: {sku}
                      </span>
                      <span className="text-[11px] font-medium text-emerald-700">
                        En stock ({isFrame ? item.frame.stock : item.lens.stock})
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-sky-700">
                      {name}
                    </h3>

                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs ring-1 ring-slate-200/60">
                      <div>
                        <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Material
                        </span>
                        <span className="font-semibold text-slate-800">
                          {item.materialDisplay}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Medidas (mm)
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-900">
                          <Ruler className="h-3 w-3 text-sky-600" />
                          {measurements}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pie de tarjeta: Precio en MXN formateado y botón de detalle / agendar prueba */}
                <div className="mt-4 border-t border-slate-100 pt-3.5">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        {isFrame ? "Precio Contado" : "Precio por Mica"}
                      </span>
                      <span className="text-xl font-bold text-slate-900">
                        {formatPriceMXN(price)}
                      </span>
                      <span className="ml-1 text-xs font-medium text-slate-500">
                        MXN
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveModalItem(item)}
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Detalle
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveModalItem(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        Agendar prueba
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de detalle y agendamiento en sucursal */}
      <ProductDetailModal
        item={activeModalItem}
        onClose={() => setActiveModalItem(null)}
      />
    </section>
  );
}
