import { randomUUID } from "crypto";
import { apiError, apiOk } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { getBridge } from "@/lib/bridge";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { isMockMode } from "@/lib/env";
import { requireClient, requireCompany } from "@/lib/session";
import { simulateDepositSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    if (!isMockMode()) throw new AppError("La simulación de depósitos solo está disponible en modo demostración.", 403);
    const session = await requireClient();
    const company = await requireCompany(session.companyId);
    const account = await prisma.virtualAccount.findFirst({ where: { companyId: company.id } });
    if (!company.bridgeCustomerId || !account?.bridgeVirtualAccountId) {
      throw new AppError("Esta empresa todavía no tiene cuenta virtual.", 409);
    }
    const data = simulateDepositSchema.parse(await request.json());
    await getBridge().simulateDeposit(
      company.bridgeCustomerId,
      account.bridgeVirtualAccountId,
      { amount: data.amount },
      randomUUID(),
    );
    const reference = `DEP-${Date.now().toString().slice(-6)}`;
    await prisma.ledgerEntry.create({
      data: {
        companyId: company.id,
        postedAt: new Date(),
        reference,
        description: "Depósito USD simulado en cuenta virtual y acreditado en USDC",
        debit: "0.00",
        credit: data.amount,
        kind: "deposit",
      },
    });
    await audit({
      actorId: session.sub,
      companyId: company.id,
      action: "deposit.simulated",
      entityType: "ledger",
      entityId: reference,
      ip: clientIp(request),
      metadata: { amount: data.amount },
    });
    return apiOk({ ok: true, reference });
  } catch (error) {
    return apiError(error);
  }
}
