import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BridgeError } from "./bridge/errors";
import { AppError } from "./errors";

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Revise los datos ingresados.", fields }, { status: 400 });
  }
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, fields: error.fields ?? null }, { status: error.status });
  }
  if (error instanceof BridgeError) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 502;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error(error);
  return NextResponse.json(
    { error: "Ocurrió un error inesperado. Intente nuevamente." },
    { status: 500 },
  );
}

export function apiOk(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}
