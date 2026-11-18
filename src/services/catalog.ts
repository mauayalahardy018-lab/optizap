import type { CatalogFilters, FrameInput, LensInput, ProductKind } from "../types/database";
import { boolean, choice, decimal, fail, found, invalid, nullable, number, page, pagination, parse, requireProfile, searchTerm, text, uuid, type Client, type Rule } from "./core";

const category = choice(["lujo", "deportivo", "moda", "accesible", "infantil"]);
const price = decimal(0,9999999999.99);
const common = {
  brand_id: uuid, sku: text(100), name: text(200), price, currency: choice(["MXN"]),
  stock: number(0,2147483647,true), image_url: nullable(text(2000)), is_active: boolean,
};
const rules = {
  frames: { ...common, segment: nullable(choice(["oftalmico","solar"])), material: choice(["acetato","metal","titanio","tr90","mixto"]),
    shape: choice(["rectangular","redondo","aviador","cat-eye","cuadrado","ovalado"]),
    gender: choice(["unisex","hombre","mujer","infantil"]), color: text(100),
    lens_width_mm: decimal(20,90), bridge_width_mm: decimal(5,40), temple_length_mm: decimal(80,180), lens_height_mm: nullable(decimal(10,90)) },
  lenses: { ...common, lens_type: choice(["monofocal","bifocal","progresivo"]),
    material: choice(["cr39","policarbonato","trivex","alto_indice","mineral"]),
    refractive_index: decimal(1.49,1.90), diameter_mm: decimal(40,100),
    coatings: ((v, k) => { if (!Array.isArray(v) || v.length > 20) invalid(`${k}: lista inválida.`); return v.map(item => text(100)(item,k)); }) as Rule },
};
const required = {
  frames: ["brand_id","sku","name","material","shape","color","lens_width_mm","bridge_width_mm","temple_length_mm","price"],
  lenses: ["brand_id","sku","name","lens_type","material","refractive_index","diameter_mm","price"],
};
export function productKind(value: unknown): ProductKind { return choice(["frames","lenses"])(value,"kind") as ProductKind; }

export function createCatalogService(db: Client) {
  return {
    async getBrands() {
      const result = await db.from("brands").select("*").eq("is_active",true).order("name");
      fail(result.error); return result.data ?? [];
    },
    async getBrandBySlug(slug: string) {
      text(100)(slug,"slug");
      const result = await db.from("brands").select("*").eq("slug",slug).eq("is_active",true).maybeSingle();
      fail(result.error); return found(result.data);
    },
    async listProducts(kind: ProductKind, input: Record<string, unknown> = {}) {
      productKind(kind);
      const range = pagination(input);
      const filters = parse<CatalogFilters>(Object.fromEntries(Object.entries(input).filter(([k]) => !["limit","offset"].includes(k))), {
        brand_id: uuid, category, search: v => searchTerm(v), min_price: price, max_price: price,
        include_inactive: boolean,
        segment: choice(["oftalmico","solar"]), material: rules[kind].material,
        sort: choice(["featured","price_asc","price_desc"]),
      });
      if (filters.segment && kind !== "frames") invalid("segment solo se aplica a armazones.");
      if (filters.min_price !== undefined && filters.max_price !== undefined && filters.min_price > filters.max_price) invalid("El precio mínimo no puede superar al máximo.");
      if (filters.include_inactive) await requireProfile(db,["admin"]);
      let query = db.from(kind).select("*, brand:brands!inner(*)", { count: "exact" });
      if (!filters.include_inactive) query = query.eq("is_active",true).eq("brand.is_active",true);
      if (filters.brand_id) query = query.eq("brand_id",filters.brand_id);
      if (filters.segment) query = query.filter("segment","eq",filters.segment);
      if (filters.material) query = query.eq("material",filters.material);
      if (filters.category) query = query.eq("brand.category",filters.category);
      if (filters.search) query = query.or(`sku.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
      if (filters.min_price !== undefined) query = query.gte("price",filters.min_price);
      if (filters.max_price !== undefined) query = query.lte("price",filters.max_price);
      query = filters.sort === "price_asc" || filters.sort === "price_desc"
        ? query.order("price",{ ascending: filters.sort === "price_asc" }).order("id")
        : query.order("name").order("id");
      const result = await query.range(range.offset,range.offset+range.limit-1);
      fail(result.error); return page(result.data,result.count,range);
    },
    async getProduct(kind: ProductKind, lookup: { id: string } | { sku: string }) {
      productKind(kind);
      const field = "id" in lookup ? "id" : "sku";
      const value = field === "id" ? uuid((lookup as { id: string }).id,"id") : text(100)((lookup as { sku: string }).sku,"sku");
      const result = await db.from(kind).select("*, brand:brands!inner(*)").eq(field,value as string).maybeSingle();
      fail(result.error); return found(result.data);
    },
    async createProduct(kind: ProductKind, input: unknown) {
      productKind(kind); await requireProfile(db,["admin"]);
      const result = kind === "frames"
        ? await db.from("frames").insert(parse<FrameInput>(input,rules.frames,required.frames)).select("*").single()
        : await db.from("lenses").insert(parse<LensInput>(input,rules.lenses,required.lenses)).select("*").single();
      fail(result.error); return found(result.data);
    },
    async updateProduct(kind: ProductKind, id: string, input: unknown) {
      productKind(kind); uuid(id,"id"); await requireProfile(db,["admin"]);
      const payload = parse<Partial<FrameInput | LensInput>>(input,rules[kind]);
      if (!Object.keys(payload).length) invalid("Envía al menos un campo para actualizar.");
      const result = await db.from(kind).update(payload).eq("id",id).select("*").maybeSingle();
      fail(result.error); return found(result.data);
    },
    async deactivateProduct(kind: ProductKind, id: string) {
      return this.updateProduct(kind,id,{ is_active: false });
    },
  };
}
