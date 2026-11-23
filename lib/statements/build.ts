import { add, sub } from "../money";

export type StatementSource = {
  postedAt: Date | string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
};

export type StatementLine = {
  postedAt: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
};

export type CompiledStatement = {
  openingBalance: string;
  closingBalance: string;
  totalDebits: string;
  totalCredits: string;
  lines: StatementLine[];
};

export function compileStatement(
  entries: StatementSource[],
  periodStart: Date,
  periodEnd: Date,
): CompiledStatement {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime(),
  );
  const start = periodStart.getTime();
  const end = periodEnd.getTime();
  let opening = "0.00";
  for (const entry of sorted) {
    if (new Date(entry.postedAt).getTime() < start) {
      opening = add(sub(opening, entry.debit), entry.credit);
    }
  }
  let running = opening;
  let totalDebits = "0.00";
  let totalCredits = "0.00";
  const lines: StatementLine[] = [];
  for (const entry of sorted) {
    const time = new Date(entry.postedAt).getTime();
    if (time < start || time > end) continue;
    totalDebits = add(totalDebits, entry.debit);
    totalCredits = add(totalCredits, entry.credit);
    running = add(sub(running, entry.debit), entry.credit);
    lines.push({
      postedAt: new Date(entry.postedAt).toISOString(),
      reference: entry.reference,
      description: entry.description,
      debit: entry.debit,
      credit: entry.credit,
      balance: running,
    });
  }
  return { openingBalance: opening, closingBalance: running, totalDebits, totalCredits, lines };
}

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function verificationCode(random: () => number = Math.random): string {
  let body = "";
  for (let i = 0; i < 8; i += 1) body += alphabet[Math.floor(random() * alphabet.length)];
  return `SW-${body.slice(0, 4)}-${body.slice(4)}`;
}
