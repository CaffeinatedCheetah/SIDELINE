import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function parseJson<T>(request: Request, schema: ZodType<T>) {
  try {
    const value: unknown = await request.json();
    return schema.safeParse(value);
  } catch {
    return schema.safeParse(undefined);
  }
}

export function cursorPage(searchParams: URLSearchParams) {
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit")) || 20),
  );
  const cursor = searchParams.get("cursor") || undefined;
  return { limit, cursor };
}
