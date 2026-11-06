// ============================================================
// customer-order-consumption.schema.ts
// Zod schemas validating inbound BFF query params.
// Interfaces live in customer-order-consumption.types.ts.
// ============================================================

import { z } from "zod";

// Directus date filters and the Manila calendar both require plain ISO dates.
const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

// ------------------------------------------------------------
// Filter schema — validates all inbound GET query params
// ------------------------------------------------------------
// Directus compares these verbatim, so a pasted code with padding would match
// nothing and read as "this customer has no demand".
const codeString = (max: number) => z.string().trim().min(1).max(max);

// The pickers are multi-selects. A selection list is capped because it becomes
// an `_in` filter in a Directus URL, and because a reader who has picked 500
// branches is asking for a different report than this page serves.
const MAX_SELECTED = 50;
const tooMany = `At most ${MAX_SELECTED} can be selected at once`;

const codeList = (max: number) =>
  z.array(codeString(max)).max(MAX_SELECTED, tooMany).optional();

const idList = () =>
  z.array(z.coerce.number().int().positive()).max(MAX_SELECTED, tooMany).optional();

const filterShape = z.object({
  startDate: isoDateString,
  endDate: isoDateString,
  customerCodes: codeList(64),
  branchIds: idList(),
  salesmanIds: idList(),
  classificationIds: idList(),
  channel: z.enum(["CYLINDER", "LPG"]).optional(),
});

// An inverted window would silently return zero rows and read as
// "no demand", so it is rejected rather than normalised.
const orderedWindow = (value: { startDate: string; endDate: string }) =>
  value.startDate <= value.endDate;

const windowIssue = {
  path: ["startDate"],
  message: "startDate must not be after endDate",
};

export const customerOrderConsumptionFilterSchema =
  filterShape.refine(orderedWindow, windowIssue);

export type CustomerOrderConsumptionFilterInput = z.infer<
  typeof customerOrderConsumptionFilterSchema
>;

// Drill-down reuses the filter shape but always needs a customer. The
// refinement is re-applied here because extending an already-refined schema
// would drop the check and let an inverted window through.
export const customerOrderConsumptionDetailSchema = filterShape
  .extend({ customerDetail: codeString(64) })
  .refine(orderedWindow, windowIssue);

export type CustomerOrderConsumptionDetailInput = z.infer<
  typeof customerOrderConsumptionDetailSchema
>;

// Lookups are typeahead reads; the type is whitelisted so an arbitrary
// collection name can never reach Directus.
export const reportLookupQuerySchema = z.object({
  type: z.enum(["customers", "branches", "salesmen", "classifications"]),
  q: z.string().max(100).optional(),
});

export type ReportLookupQueryInput = z.infer<typeof reportLookupQuerySchema>;

// ------------------------------------------------------------
// Query string -> schema input
// ------------------------------------------------------------

// A multi-select sends the same key once per pick, so only these keys are
// collected into arrays. Everything else stays a single string.
const LIST_PARAM_KEYS = new Set([
  "customerCodes",
  "branchIds",
  "salesmanIds",
  "classificationIds",
]);

export function readFilterParams(
  params: URLSearchParams
): Record<string, string | string[]> {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    raw[key] = LIST_PARAM_KEYS.has(key) ? values : (values[0] ?? "");
  }
  return raw;
}

/** Reads one repeated param as a capped list of trimmed display labels. */
export function readLabelList(params: URLSearchParams, key: string): string[] {
  const labels = params
    .getAll(key)
    .map((label) => label.trim().slice(0, 200))
    .filter((label) => label.length > 0)
    .slice(0, MAX_SELECTED);
  return labels;
}
