import { z } from "zod";

export const adminPageSizeValues = [10, 20, 50] as const;
export const adminActiveStatusValues = ["ACTIVE", "INACTIVE", "all"] as const;

export type AdminPageSize = (typeof adminPageSizeValues)[number];
export type AdminActiveStatus = (typeof adminActiveStatusValues)[number];

function readFirst(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeText(value: unknown, maxLength = 120) {
  const rawValue = readFirst(value);

  if (typeof rawValue !== "string") {
    return rawValue;
  }

  const normalized = rawValue.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return undefined;
  }

  const lowerValue = normalized.toLowerCase();

  if (lowerValue === "undefined" || lowerValue === "null") {
    return undefined;
  }

  return normalized.slice(0, maxLength);
}

export function normalizeOptionalText(maxLength = 120) {
  return z
    .preprocess(
      (value) => normalizeText(value, maxLength),
      z.string().min(1).max(maxLength)
    )
    .optional();
}

export function normalizeAllableText(maxLength = 100) {
  return z
    .preprocess((value) => {
      const normalized = normalizeText(value, maxLength);

      if (typeof normalized !== "string") {
        return normalized;
      }

      return normalized.toLowerCase() === "all" ? "all" : normalized;
    }, z.string().min(1).max(maxLength))
    .optional()
    .transform((value) => value ?? "all");
}

function normalizeNumber(value: unknown) {
  const rawValue = readFirst(value);

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined;
  }

  if (typeof rawValue === "number") {
    return rawValue;
  }

  if (typeof rawValue === "string" && /^\d+$/.test(rawValue.trim())) {
    return Number(rawValue);
  }

  return rawValue;
}

export const adminPageSchema = z
  .preprocess(normalizeNumber, z.number().int().min(1).max(100_000))
  .optional()
  .transform((value) => value ?? 1);

export const adminPageSizeSchema = z
  .preprocess(
    normalizeNumber,
    z.union([z.literal(10), z.literal(20), z.literal(50)])
  )
  .optional()
  .transform((value) => value ?? 10);

export const adminOptionalIdSchema = normalizeOptionalText(100);
export const adminRequiredIdSchema = normalizeOptionalText(100).pipe(
  z.string().min(1)
);
export const adminQueryTextSchema = normalizeOptionalText(120);
