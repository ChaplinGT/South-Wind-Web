import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { legalEntity } from "../brand";
import { formatAmount, formatDate, formatDateTime } from "../format";
import type { StatementLine } from "./build";

export type StatementPdfInput = {
  mock: boolean;
  statementNumber: string;
  verificationCode: string;
  verificationUrl: string;
  generatedAt: Date;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  company: { legalName: string; nit: string; address: string; city: string };
  openingBalance: string;
  closingBalance: string;
  totalDebits: string;
  totalCredits: string;
  lines: StatementLine[];
};

export type ReceiptPdfInput = {
  mock: boolean;
  title: string;
  number: string;
  issuedAt: Date;
  company: { legalName: string; nit: string };
  rows: { label: string; value: string }[];
  amountLabel: string;
  amount: string;
  verificationUrl?: string;
};

const teal = "#25656F";
const deep = "#1A4C54";
const ink = "#143238";
const muted = "#5C7276";
const line = "#D5E2E3";
const paper = "#F4F8F8";

export async function renderStatementPdf(input: StatementPdfInput): Promise<Buffer> {
  const qr = await QRCode.toBuffer(input.verificationUrl, {
    margin: 0,
    width: 180,
    color: { dark: deep, light: "#FFFFFF" },
  });
  return toBuffer((doc) => drawStatement(doc, input, qr));
}

export async function renderReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
  const qr = input.verificationUrl
    ? await QRCode.toBuffer(input.verificationUrl, { margin: 0, width: 140, color: { dark: deep, light: "#FFFFFF" } })
    : null;
  return toBuffer((doc) => drawReceipt(doc, input, qr));
}

function toBuffer(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    draw(doc);
    doc.end();
  });
}

function drawStatement(doc: PDFKit.PDFDocument, input: StatementPdfInput, qr: Buffer) {
  const logo = path.join(process.cwd(), "public", "brand", "logo-horizontal.png");
  doc.rect(0, 0, doc.page.width, 86).fill(teal);
  if (fs.existsSync(logo)) doc.image(logo, 28, 16, { height: 54 });
  doc.fillColor("#FFFFFF").font("Times-Bold").fontSize(13).text("EXTRACTO DE CUENTA", 300, 28, {
    width: 260,
    align: "right",
  });
  doc.font("Helvetica").fontSize(9).text(legalEntity.name, 300, 48, { width: 260, align: "right" });
  doc.text("Cuenta en USDC", 300, 62, { width: 260, align: "right" });

  let y = 104;
  doc.fillColor(ink).font("Times-Bold").fontSize(12).text("Emisor", 36, y);
  doc.font("Times-Bold").text("Cliente", 320, y);
  y += 16;
  doc.font("Helvetica").fontSize(9).fillColor(ink);
  for (const lineText of [legalEntity.name, ...legalEntity.addressLines]) {
    doc.text(lineText, 36, y, { width: 250 });
    y += 12;
  }
  const clientLines = [
    input.company.legalName,
    `NIT ${input.company.nit}`,
    input.company.address,
    `${input.company.city}, Bolivia`,
  ];
  let cy = 120;
  for (const lineText of clientLines) {
    doc.text(lineText, 320, cy, { width: 240 });
    cy += 12;
  }

  y = Math.max(y, cy) + 8;
  doc.roundedRect(36, y, 523, 58, 4).fillAndStroke(paper, line);
  const facts = [
    ["Extracto N.º", input.statementNumber],
    ["Período", input.periodLabel],
    ["Emitido", formatDateTime(input.generatedAt)],
    ["Moneda", "USDC"],
  ];
  facts.forEach((fact, index) => {
    const x = 48 + (index % 4) * 128;
    doc.fillColor(muted).font("Helvetica").fontSize(8).text(fact[0], x, y + 12, { width: 120 });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(9).text(fact[1], x, y + 26, { width: 120 });
  });

  y += 72;
  const boxes = [
    ["Saldo inicial", formatAmount(input.openingBalance)],
    ["Abonos", formatAmount(input.totalCredits)],
    ["Cargos", formatAmount(input.totalDebits)],
    ["Saldo final", formatAmount(input.closingBalance)],
  ];
  boxes.forEach((box, index) => {
    const x = 36 + index * 133;
    doc.roundedRect(x, y, 126, 46, 4).fillAndStroke(index === 3 ? teal : "#FFFFFF", index === 3 ? teal : line);
    doc.fillColor(index === 3 ? "#E6F1F2" : muted).font("Helvetica").fontSize(8).text(box[0], x + 8, y + 8, { width: 110 });
    doc.fillColor(index === 3 ? "#FFFFFF" : ink).font("Helvetica-Bold").fontSize(10).text(box[1], x + 8, y + 24, { width: 110 });
  });

  y += 62;
  y = tableHeader(doc, y);
  if (input.lines.length === 0) {
    doc.fillColor(muted).font("Helvetica").fontSize(9).text("Sin movimientos en el período.", 36, y + 8);
    y += 28;
  }
  input.lines.forEach((entry, index) => {
    const height = Math.max(22, doc.heightOfString(entry.description, { width: 180 }) + 10);
    if (y + height > 700) {
      doc.addPage();
      y = tableHeader(doc, 48);
    }
    if (index % 2 === 0) doc.rect(36, y, 523, height).fill(paper);
    doc.fillColor(ink).font("Helvetica").fontSize(8);
    doc.text(formatDate(entry.postedAt), 40, y + 6, { width: 72 });
    doc.text(entry.reference, 112, y + 6, { width: 68 });
    doc.text(entry.description, 182, y + 6, { width: 180 });
    doc.text(entry.debit === "0.00" ? "—" : formatAmount(entry.debit).replace(" USDC", ""), 366, y + 6, { width: 60, align: "right" });
    doc.text(entry.credit === "0.00" ? "—" : formatAmount(entry.credit).replace(" USDC", ""), 428, y + 6, { width: 60, align: "right" });
    doc.font("Helvetica-Bold").text(formatAmount(entry.balance).replace(" USDC", ""), 490, y + 6, { width: 62, align: "right" });
    y += height;
  });

  if (y > 680) {
    doc.addPage();
    y = 48;
  }
  y += 16;
  doc.roundedRect(36, y, 523, 118, 4).stroke(line);
  doc.fillColor(ink).font("Times-Bold").fontSize(11).text("Verificación del extracto", 50, y + 12);
  doc.font("Helvetica").fontSize(8).fillColor(ink);
  doc.text(`Código ${input.verificationCode}`, 50, y + 32, { width: 340 });
  doc.text("Confirme la autenticidad de este documento en:", 50, y + 48, { width: 340 });
  doc.fillColor(teal).text(input.verificationUrl, 50, y + 62, { width: 340 });
  doc.fillColor(muted).fontSize(7.5).text(
    "Este extracto resume los movimientos registrados en la cuenta USDC del cliente dentro de la plataforma de South Wind Global Services LLC. South Wind no es un banco. Los rieles de pago en dólares y stablecoins operan a través de Bridge. La conversión entre USDC y bolivianos, cuando aparece, fue atendida fuera de la plataforma por un proveedor de servicios de activos virtuales.",
    50,
    y + 80,
    { width: 340 },
  );
  doc.image(qr, 430, y + 16, { width: 86 });

  if (input.mock) {
    doc.save();
    doc.rotate(-32, { origin: [300, 420] });
    doc.font("Times-Bold").fontSize(52).fillColor(teal).opacity(0.07).text("DEMOSTRACIÓN", 70, 400, {
      lineBreak: false,
    });
    doc.restore();
    doc.opacity(1).fillColor("#8C6A32").font("Helvetica").fontSize(8).text(
      "Entorno de demostración. Este documento no representa fondos reales ni tiene valor frente a terceros.",
      36,
      doc.page.height - 32,
      { width: 523, align: "center", height: 12, lineBreak: false },
    );
  }
}

function tableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.rect(36, y, 523, 18).fill(deep);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
  const headers: [string, number, number][] = [
    ["Fecha", 40, 70],
    ["Referencia", 112, 68],
    ["Descripción", 182, 180],
    ["Débito", 366, 60],
    ["Crédito", 428, 60],
    ["Saldo", 490, 62],
  ];
  for (const [label, x, width] of headers) {
    const align = x >= 366 ? "right" : "left";
    doc.text(label, x, y + 5, { width, align });
  }
  return y + 18;
}

function drawReceipt(doc: PDFKit.PDFDocument, input: ReceiptPdfInput, qr: Buffer | null) {
  const logo = path.join(process.cwd(), "public", "brand", "logo-horizontal.png");
  doc.rect(0, 0, doc.page.width, 78).fill(teal);
  if (fs.existsSync(logo)) doc.image(logo, 28, 14, { height: 50 });
  doc.fillColor("#FFFFFF").font("Times-Bold").fontSize(13).text("COMPROBANTE", 320, 30, { width: 240, align: "right" });
  doc.font("Helvetica").fontSize(9).text(input.number, 320, 50, { width: 240, align: "right" });

  doc.fillColor(ink).font("Times-Bold").fontSize(16).text(input.title, 36, 100);
  doc.font("Helvetica").fontSize(9).fillColor(muted).text(`${legalEntity.name} · ${formatDateTime(input.issuedAt)}`, 36, 124);
  doc.fillColor(ink).font("Helvetica").fontSize(10).text(input.company.legalName, 36, 146);
  doc.text(`NIT ${input.company.nit}`, 36, 162);

  doc.roundedRect(36, 190, 523, 64, 6).fill(teal);
  doc.fillColor("#E6F1F2").font("Helvetica").fontSize(9).text(input.amountLabel, 52, 204);
  doc.fillColor("#FFFFFF").font("Times-Bold").fontSize(20).text(input.amount, 52, 220);

  let y = 276;
  for (const row of input.rows) {
    doc.fillColor(muted).font("Helvetica").fontSize(8).text(row.label, 36, y);
    doc.fillColor(ink).font("Helvetica").fontSize(10).text(row.value, 180, y - 2, { width: 370 });
    y += 22;
    doc.moveTo(36, y - 8).lineTo(559, y - 8).strokeColor(line).stroke();
  }
  if (qr && input.verificationUrl) {
    doc.image(qr, 36, y + 8, { width: 72 });
    doc.fillColor(muted).font("Helvetica").fontSize(8).text("Verificación", 118, y + 18);
    doc.fillColor(teal).text(input.verificationUrl, 118, y + 32, { width: 400 });
  }
  doc.fillColor(muted).fontSize(8).text(
    "South Wind Global Services LLC no es un banco. Este comprobante acredita un registro de la plataforma.",
    36,
    760,
    { width: 523 },
  );
  if (input.mock) {
    doc.save();
    doc.rotate(-28, { origin: [300, 420] });
    doc.font("Times-Bold").fontSize(48).fillColor(teal).opacity(0.08).text("DEMOSTRACIÓN", 70, 400);
    doc.restore();
  }
}
