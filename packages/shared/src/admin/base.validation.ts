import { z } from "zod";

import {
  adminActiveStatusValues,
  adminOptionalIdSchema,
  adminPageSchema,
  adminPageSizeSchema,
  adminQueryTextSchema,
  adminRequiredIdSchema,
} from "./common.validation";

export const adminBaseTabValues = [
  "stores",
  "carriers",
  "salesAgencies",
  "colors",
  "deviceModels",
  "ratePlans",
  "addOnServices",
] as const;

export const adminBaseListQuerySchema = z.object({
  tab: z.enum(adminBaseTabValues).default("deviceModels"),
  status: z.enum(adminActiveStatusValues).default("all"),
  q: adminQueryTextSchema,
  page: adminPageSchema,
  pageSize: adminPageSizeSchema,
  detail: adminOptionalIdSchema,
});

export const adminBaseDetailQuerySchema = z.object({
  tab: z.enum(adminBaseTabValues),
  id: adminRequiredIdSchema,
});

export type AdminBaseTab = (typeof adminBaseTabValues)[number];
export type AdminBaseListQuery = z.infer<typeof adminBaseListQuerySchema>;
export type AdminBaseDetailQuery = z.infer<typeof adminBaseDetailQuerySchema>;
