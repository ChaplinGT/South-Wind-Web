import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { createConversion } from "@/lib/services/conversions";
import { requireClient } from "@/lib/session";
import { conversionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireClient();
    const data = conversionSchema.parse(await request.json());
    const conversion = await createConversion({
      companyId: session.companyId,
      actorId: session.sub,
      direction: data.direction,
      amount: data.amount,
      bolivianAccountId: data.bolivianAccountId,
      note: data.note,
      ip: clientIp(request),
    });
    return apiOk({ ok: true, id: conversion.id }, 201);
  } catch (error) {
    return apiError(error);
  }
}
