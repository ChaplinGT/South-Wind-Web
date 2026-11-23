import { prisma } from "../db";
import { add, sub } from "../money";

export async function companyBalance(companyId: string): Promise<string> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { companyId },
    select: { debit: true, credit: true },
  });
  return entries.reduce((balance, entry) => add(sub(balance, entry.debit), entry.credit), "0.00");
}

const failureStates = new Set(["canceled", "cancelled", "undeliverable", "returned", "refunded"]);

export function isFailureState(state: string): boolean {
  return failureStates.has(state);
}
