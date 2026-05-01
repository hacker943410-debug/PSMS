import { z } from "zod";

import {
  adminActiveStatusValues,
  adminOptionalIdSchema,
  adminPageSchema,
  adminPageSizeSchema,
  adminQueryTextSchema,
  adminRequiredIdSchema,
  normalizeAllableText,
} from "./common.validation";

export const adminStaffListQuerySchema = z.object({
  role: z.enum(["ADMIN", "STAFF", "all"]).default("all"),
  storeId: normalizeAllableText(100),
  status: z.enum(adminActiveStatusValues).default("all"),
  q: adminQueryTextSchema,
  page: adminPageSchema,
  pageSize: adminPageSizeSchema,
  detail: adminOptionalIdSchema,
});

export const adminStaffDetailQuerySchema = z.object({
  userId: adminRequiredIdSchema,
});

export type AdminStaffListQuery = z.infer<typeof adminStaffListQuerySchema>;
export type AdminStaffDetailQuery = z.infer<typeof adminStaffDetailQuerySchema>;
