import type { Prisma } from "@psms/db";
import type { AdminBaseListQuery, AdminBaseTab } from "@psms/shared";

import type { DbClient } from "./types";

export type AdminBaseRawRow = {
  id: string;
  code?: string | null;
  name: string;
  phone?: string | null;
  address?: string | null;
  status: "ACTIVE" | "INACTIVE";
  carrierId?: string | null;
  carrier?: { id: string; code: string; name: string } | null;
  contactName?: string | null;
  contractStatus?: string | null;
  hex?: string | null;
  modelNo?: string | null;
  manufacturer?: string | null;
  releaseDate?: Date | null;
  supports5g?: boolean;
  imageUrl?: string | null;
  monthlyFee?: number;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function pagination(query: AdminBaseListQuery) {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

function storeWhere(query: AdminBaseListQuery): Prisma.StoreWhereInput {
  return {
    ...(query.status !== "all" ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { code: { contains: query.q } },
            { name: { contains: query.q } },
            { phone: { contains: query.q } },
            { address: { contains: query.q } },
          ],
        }
      : {}),
  };
}

function carrierWhere(query: AdminBaseListQuery): Prisma.CarrierWhereInput {
  return {
    ...(query.status !== "all" ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { code: { contains: query.q } },
            { name: { contains: query.q } },
          ],
        }
      : {}),
  };
}

function salesAgencyWhere(
  query: AdminBaseListQuery
): Prisma.SalesAgencyWhereInput {
  return {
    ...(query.status !== "all" ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { contactName: { contains: query.q } },
            { phone: { contains: query.q } },
            { contractStatus: { contains: query.q } },
            { carrier: { name: { contains: query.q } } },
          ],
        }
      : {}),
  };
}

function colorWhere(
  query: AdminBaseListQuery
): Prisma.InventoryColorOptionWhereInput {
  return {
    ...(query.status !== "all" ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { code: { contains: query.q } },
            { hex: { contains: query.q } },
          ],
        }
      : {}),
  };
}

function deviceModelWhere(
  query: AdminBaseListQuery
): Prisma.DeviceModelWhereInput {
  return {
    ...(query.status !== "all" ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { modelNo: { contains: query.q } },
            { manufacturer: { contains: query.q } },
          ],
        }
      : {}),
  };
}

function ratePlanWhere(query: AdminBaseListQuery): Prisma.RatePlanWhereInput {
  return {
    ...(query.status !== "all" ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { description: { contains: query.q } },
            { carrier: { name: { contains: query.q } } },
          ],
        }
      : {}),
  };
}

function addOnServiceWhere(
  query: AdminBaseListQuery
): Prisma.AddOnServiceWhereInput {
  return {
    ...(query.status !== "all" ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { description: { contains: query.q } },
            { carrier: { name: { contains: query.q } } },
          ],
        }
      : {}),
  };
}

const carrierSelect = {
  id: true,
  code: true,
  name: true,
} as const;

const baseOrderBy = [{ createdAt: "desc" as const }, { id: "asc" as const }];

export function countAdminBaseRows(db: DbClient, query: AdminBaseListQuery) {
  switch (query.tab) {
    case "stores":
      return db.store.count({ where: storeWhere(query) });
    case "carriers":
      return db.carrier.count({ where: carrierWhere(query) });
    case "salesAgencies":
      return db.salesAgency.count({ where: salesAgencyWhere(query) });
    case "colors":
      return db.inventoryColorOption.count({ where: colorWhere(query) });
    case "deviceModels":
      return db.deviceModel.count({ where: deviceModelWhere(query) });
    case "ratePlans":
      return db.ratePlan.count({ where: ratePlanWhere(query) });
    case "addOnServices":
      return db.addOnService.count({ where: addOnServiceWhere(query) });
  }
}

export async function findAdminBaseRows(
  db: DbClient,
  query: AdminBaseListQuery
): Promise<AdminBaseRawRow[]> {
  const page = pagination(query);

  switch (query.tab) {
    case "stores":
      return db.store.findMany({
        where: storeWhere(query),
        orderBy: baseOrderBy,
        ...page,
      });
    case "carriers":
      return db.carrier.findMany({
        where: carrierWhere(query),
        orderBy: baseOrderBy,
        ...page,
      });
    case "salesAgencies":
      return db.salesAgency.findMany({
        where: salesAgencyWhere(query),
        include: { carrier: { select: carrierSelect } },
        orderBy: baseOrderBy,
        ...page,
      });
    case "colors":
      return db.inventoryColorOption.findMany({
        where: colorWhere(query),
        orderBy: baseOrderBy,
        ...page,
      });
    case "deviceModels":
      return db.deviceModel.findMany({
        where: deviceModelWhere(query),
        orderBy: baseOrderBy,
        ...page,
      });
    case "ratePlans":
      return db.ratePlan.findMany({
        where: ratePlanWhere(query),
        include: { carrier: { select: carrierSelect } },
        orderBy: baseOrderBy,
        ...page,
      });
    case "addOnServices":
      return db.addOnService.findMany({
        where: addOnServiceWhere(query),
        include: { carrier: { select: carrierSelect } },
        orderBy: baseOrderBy,
        ...page,
      });
  }
}

export async function findAdminBaseRowById(
  db: DbClient,
  tab: AdminBaseTab,
  id: string
): Promise<AdminBaseRawRow | null> {
  switch (tab) {
    case "stores":
      return db.store.findUnique({ where: { id } });
    case "carriers":
      return db.carrier.findUnique({ where: { id } });
    case "salesAgencies":
      return db.salesAgency.findUnique({
        where: { id },
        include: { carrier: { select: carrierSelect } },
      });
    case "colors":
      return db.inventoryColorOption.findUnique({ where: { id } });
    case "deviceModels":
      return db.deviceModel.findUnique({ where: { id } });
    case "ratePlans":
      return db.ratePlan.findUnique({
        where: { id },
        include: { carrier: { select: carrierSelect } },
      });
    case "addOnServices":
      return db.addOnService.findUnique({
        where: { id },
        include: { carrier: { select: carrierSelect } },
      });
  }
}

export function findAdminBaseCarrierOptions(db: DbClient) {
  return db.carrier.findMany({
    select: carrierSelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}
