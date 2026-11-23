import { prisma } from "../db";
import { audit } from "../audit";
import { AppError } from "../errors";
import { periodBounds } from "../format";
import { compileStatement, verificationCode, type StatementLine } from "../statements/build";

export async function generateStatement(input: {
  companyId: string;
  year: number;
  month: number;
  actorId?: string | null;
  statementNumber?: string;
  verification?: string;
}) {
  const { start, end } = periodBounds(input.year, input.month);
  const existing = await prisma.statement.findFirst({
    where: { companyId: input.companyId, periodStart: start },
  });
  if (existing) return existing;

  const entries = await prisma.ledgerEntry.findMany({ where: { companyId: input.companyId } });
  const compiled = compileStatement(entries, start, end);
  const sequence = (await prisma.statement.count()) + 1;
  const statement = await prisma.statement.create({
    data: {
      companyId: input.companyId,
      statementNumber: input.statementNumber ?? `EXT-${input.year}-${String(sequence).padStart(5, "0")}`,
      periodStart: start,
      periodEnd: end,
      openingBalance: compiled.openingBalance,
      closingBalance: compiled.closingBalance,
      totalDebits: compiled.totalDebits,
      totalCredits: compiled.totalCredits,
      verificationCode: input.verification ?? verificationCode(),
      linesJson: JSON.stringify(compiled.lines),
    },
  });
  if (input.actorId) {
    await audit({
      actorId: input.actorId,
      companyId: input.companyId,
      action: "statement.generate",
      entityType: "statement",
      entityId: statement.id,
      metadata: { number: statement.statementNumber },
    });
  }
  return statement;
}

export function readLines(linesJson: string): StatementLine[] {
  return JSON.parse(linesJson) as StatementLine[];
}

export async function statementForCompany(id: string, companyId: string) {
  const statement = await prisma.statement.findFirst({ where: { id, companyId } });
  if (!statement) throw new AppError("No encontramos el extracto.", 404);
  return statement;
}
