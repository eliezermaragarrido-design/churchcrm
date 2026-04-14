import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("Validation failed", 422, error.flatten());
  }

  if (error instanceof Error && error.message === "Unauthorized") {
    return fail("Unauthorized", 401);
  }

  if (error instanceof Error) {
    return fail(error.message, 500);
  }

  return fail("Unexpected error", 500);
}
