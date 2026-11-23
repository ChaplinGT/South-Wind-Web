import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { audit } from "../audit";
import { getBridge } from "../bridge";
import { getMockBridge } from "../bridge/mock";
import { AppError } from "../errors";
import { isMockMode } from "../env";
import { mapKybStatus } from "../kyb";
import type { z } from "zod";
import type { inviteSchema } from "../validation";
import { accountSignupSchema } from "../validation";
import { provisionCompany } from "./provision";

export async function registerAccount(input: z.infer<typeof accountSignupSchema>, ip?: string | null) {
  const emailTaken = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (emailTaken) throw new AppError("Ese correo ya tiene una cuenta de South Wind. Inicie sesión.", 409);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: bcrypt.hashSync(input.password, 10),
      name: input.name,
      phone: input.phone,
      role: "client",
    },
  });
  await audit({
    actorId: user.id,
    action: "customer.register",
    entityType: "user",
    entityId: user.id,
    ip,
    metadata: { kind: "southwind" },
  });
  return user;
}

export async function startKyb(companyId: string, actorId: string, ip?: string | null) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError("No encontramos la empresa.", 404);
  const bridge = getBridge();
  let customerId = company.bridgeCustomerId;
  if (!customerId) {
    const created = await bridge.createCustomer(
      company.kind === "persona"
        ? {
            type: "individual",
            email: company.email,
            first_name: company.legalName,
            client_reference_id: company.id,
          }
        : {
            type: "business",
            email: company.email,
            business_legal_name: company.legalName,
            client_reference_id: company.id,
          },
      randomUUID(),
    );
    customerId = created.id;
    await prisma.company.update({
      where: { id: company.id },
      data: { bridgeCustomerId: created.id, bridgeKycStatus: created.status, kybStatus: mapKybStatus(created.status) },
    });
  }
  const link = await bridge.getKycLink(customerId);
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: {
      kybLinkUrl: link.url,
      tosLinkUrl: link.tos_url ?? null,
      kybStatus: company.kybStatus === "approved" ? "approved" : "pending",
    },
  });
  await audit({
    actorId,
    companyId: company.id,
    action: "kyb.link",
    entityType: "company",
    entityId: company.id,
    ip,
  });
  return updated;
}

export async function approveMockKyb(bridgeCustomerId: string, actorId: string) {
  if (!isMockMode()) {
    throw new AppError("No se pudo completar la verificación.", 403);
  }
  const company = await prisma.company.findUnique({ where: { bridgeCustomerId } });
  if (!company) throw new AppError("No encontramos la empresa de esta verificación.", 404);
  await getMockBridge().markCustomerActive(bridgeCustomerId);
  await prisma.company.update({
    where: { id: company.id },
    data: { kybStatus: "approved", bridgeKycStatus: "active" },
  });
  await provisionCompany(company.id);
  await audit({
    actorId,
    companyId: company.id,
    action: "kyb.approved",
    entityType: "company",
    entityId: company.id,
    metadata: { mode: "mock" },
  });
  return prisma.company.findUnique({ where: { id: company.id } });
}

export async function linkExistingCustomer(input: z.infer<typeof inviteSchema> & { actorId: string; ip?: string | null }) {
  const remote = await getBridge().getCustomer(input.bridgeCustomerId.trim());
  const already = await prisma.company.findUnique({ where: { bridgeCustomerId: remote.id } });
  if (already) throw new AppError("Ese cliente de Bridge ya está vinculado a una empresa del portal.", 409);
  const nitTaken = await prisma.company.findUnique({ where: { nit: input.nit } });
  if (nitTaken) throw new AppError("Ya existe una empresa con ese NIT.", 409);
  const emailTaken = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (emailTaken) throw new AppError("Ese correo ya tiene un usuario.", 409);

  const kybStatus = mapKybStatus(remote.status);
  const company = await prisma.company.create({
    data: {
      legalName: input.legalName,
      tradeName: input.tradeName,
      nit: input.nit,
      email: input.email.toLowerCase(),
      phone: input.phone,
      address: input.address,
      city: input.city,
      clientType: input.clientType,
      contactName: input.contactName,
      bridgeCustomerId: remote.id,
      bridgeKycStatus: remote.status,
      kybStatus,
      onboardingSource: "invited",
    },
  });
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: bcrypt.hashSync(input.password, 10),
      name: input.contactName,
      role: "client",
      companyId: company.id,
    },
  });
  if (kybStatus === "approved" || kybStatus === "restricted") {
    await provisionCompany(company.id);
  }
  await audit({
    actorId: input.actorId,
    companyId: company.id,
    action: "customer.invite",
    entityType: "company",
    entityId: company.id,
    ip: input.ip,
    metadata: { bridgeCustomerId: remote.id, bridgeStatus: remote.status },
  });
  return { company, user, bridgeStatus: remote.status };
}
