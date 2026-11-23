import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { appUrl, isMockMode } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { readLines } from "@/lib/services/statements";
import { renderStatementPdf } from "@/lib/statements/pdf";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await context.params;
    const statement = await prisma.statement.findUnique({ where: { id }, include: { company: true } });
    if (!statement) throw new AppError("No encontramos el extracto.", 404);
    if (session.role !== "admin" && session.companyId !== statement.companyId) {
      throw new AppError("No tiene permiso para ver este extracto.", 403);
    }
    const pdf = await renderStatementPdf({
      mock: isMockMode(),
      statementNumber: statement.statementNumber,
      verificationCode: statement.verificationCode,
      verificationUrl: `${appUrl()}/verificar/${statement.verificationCode}`,
      generatedAt: statement.generatedAt,
      periodLabel: `${formatDate(statement.periodStart)} — ${formatDate(statement.periodEnd)}`,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      company: {
        legalName: statement.company.legalName,
        nit: statement.company.nit || "—",
        address: statement.company.address,
        city: statement.company.city,
      },
      openingBalance: statement.openingBalance,
      closingBalance: statement.closingBalance,
      totalDebits: statement.totalDebits,
      totalCredits: statement.totalCredits,
      lines: readLines(statement.linesJson),
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${statement.statementNumber}.pdf"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
