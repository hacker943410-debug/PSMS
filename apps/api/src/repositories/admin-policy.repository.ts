import type { Prisma } from "@psms/db";
import type { AdminPolicyListQuery, AdminPolicyType } from "@psms/shared";

import type { DbClient } from "./types";

export type AdminPolicyRawRow = {
  id: string;
  name: string;
  carrierId: string | null;
  carrier: { id: string; code: string; name: string } | null;
  subscriptionType?: "NEW" | "CHANGE_DEVICE" | "NUMBER_PORTABILITY" | null;
  status: "ACTIVE" | "INACTIVE" | "SCHEDULED" | "EXPIRED";
  version: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  priority: number;
  ruleJson: unknown;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const carrierSelect = {
  id: true,
  code: true,
  name: true,
} as const;

const policyOrderBy = [
  { effectiveFrom: "desc" as const },
  { priority: "asc" as const },
  { id: "asc" as const },
];

function toStartDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toEndDate(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function commonPolicyWhere(query: AdminPolicyListQuery) {
  return {
    ...(query.carrierId !== "all" ? { carrierId: query.carrierId } : {}),
    ...(query.status !== "all" ? { status: query.status } : {}),
    ...(query.to ? { effectiveFrom: { lte: toEndDate(query.to) } } : {}),
    ...(query.from
      ? {
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: toStartDate(query.from) } },
          ],
        }
      : {}),
    ...(query.q ? { name: { contains: query.q } } : {}),
  };
}

function saleProfitPolicyWhere(
  query: AdminPolicyListQuery
): Prisma.SaleProfitPolicyWhereInput {
  return {
    ...commonPolicyWhere(query),
    ...(query.subscriptionType !== "all"
      ? { subscriptionType: query.subscriptionType }
      : {}),
  };
}

function staffCommissionPolicyWhere(
  query: AdminPolicyListQuery
): Prisma.StaffCommissionPolicyWhereInput {
  return commonPolicyWhere(query);
}

function discountPolicyWhere(
  query: AdminPolicyListQuery
): Prisma.DiscountPolicyWhereInput {
  return commonPolicyWhere(query);
}

function activationRuleWhere(
  query: AdminPolicyListQuery
): Prisma.CarrierActivationRuleWhereInput {
  return commonPolicyWhere(query);
}

export function countAdminPolicyRows(
  db: DbClient,
  query: AdminPolicyListQuery
) {
  switch (query.policyType) {
    case "saleProfit":
      return db.saleProfitPolicy.count({ where: saleProfitPolicyWhere(query) });
    case "staffCommission":
      return db.staffCommissionPolicy.count({
        where: staffCommissionPolicyWhere(query),
      });
    case "discount":
      return db.discountPolicy.count({ where: discountPolicyWhere(query) });
    case "activationRule":
      return db.carrierActivationRule.count({
        where: activationRuleWhere(query),
      });
  }
}

export async function findAdminPolicyRows(
  db: DbClient,
  query: AdminPolicyListQuery
): Promise<AdminPolicyRawRow[]> {
  const page = {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };

  switch (query.policyType) {
    case "saleProfit":
      return db.saleProfitPolicy.findMany({
        where: saleProfitPolicyWhere(query),
        include: { carrier: { select: carrierSelect } },
        orderBy: policyOrderBy,
        ...page,
      });
    case "staffCommission":
      return db.staffCommissionPolicy.findMany({
        where: staffCommissionPolicyWhere(query),
        include: { carrier: { select: carrierSelect } },
        orderBy: policyOrderBy,
        ...page,
      });
    case "discount":
      return db.discountPolicy.findMany({
        where: discountPolicyWhere(query),
        include: { carrier: { select: carrierSelect } },
        orderBy: policyOrderBy,
        ...page,
      });
    case "activationRule":
      return db.carrierActivationRule.findMany({
        where: activationRuleWhere(query),
        include: { carrier: { select: carrierSelect } },
        orderBy: policyOrderBy,
        ...page,
      });
  }
}

export async function findAdminPolicyById(
  db: DbClient,
  policyType: AdminPolicyType,
  policyId: string
): Promise<AdminPolicyRawRow | null> {
  switch (policyType) {
    case "saleProfit":
      return db.saleProfitPolicy.findUnique({
        where: { id: policyId },
        include: { carrier: { select: carrierSelect } },
      });
    case "staffCommission":
      return db.staffCommissionPolicy.findUnique({
        where: { id: policyId },
        include: { carrier: { select: carrierSelect } },
      });
    case "discount":
      return db.discountPolicy.findUnique({
        where: { id: policyId },
        include: { carrier: { select: carrierSelect } },
      });
    case "activationRule":
      return db.carrierActivationRule.findUnique({
        where: { id: policyId },
        include: { carrier: { select: carrierSelect } },
      });
  }
}

export function findAdminPolicyCarrierOptions(db: DbClient) {
  return db.carrier.findMany({
    select: carrierSelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}
