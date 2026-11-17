import { createRequestClient } from "@/lib/supabase/server";
import { handleApi } from "@/services/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = (request: Request) => handleApi(request,createRequestClient);
export const POST = (request: Request) => handleApi(request,createRequestClient);
export const PATCH = (request: Request) => handleApi(request,createRequestClient);
export const DELETE = (request: Request) => handleApi(request,createRequestClient);
