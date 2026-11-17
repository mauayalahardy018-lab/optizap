import type { UserRole } from "../types/database";
import { choice, fail, found, page, pagination, parse, requireProfile, uuid, type Client } from "./core";

export function createUserService(db: Client) {
  return {
    async getCurrentUserProfile() { return requireProfile(db); },
    async listProfiles(input: Record<string, unknown> = {}) {
      await requireProfile(db,["admin"]);
      parse(input,{ limit: v => v, offset: v => v });
      const range = pagination(input);
      const result = await db.from("profiles").select("*",{ count: "exact" }).order("created_at").order("id").range(range.offset,range.offset+range.limit-1);
      fail(result.error); return page(result.data,result.count,range);
    },
    async updateRole(id: string, input: unknown) {
      uuid(id,"id"); await requireProfile(db,["admin"]);
      const payload = parse<{ role: UserRole }>(input,{ role: choice(["admin","optometrista","vendedor","cliente"]) },["role"]);
      const result = await db.from("profiles").update(payload).eq("id",id).select("*").maybeSingle();
      fail(result.error); return found(result.data);
    },
  };
}
