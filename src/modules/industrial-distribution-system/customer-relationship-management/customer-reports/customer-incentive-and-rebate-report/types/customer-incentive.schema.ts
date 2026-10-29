// ============================================================
// customer-incentive.schema.ts
// Zod schemas validating inbound BFF query params.
// Interfaces live in customer-incentive.types.ts.
// ============================================================

import { z } from "zod";

import {
  CLAIM_STATUS_LABELS,
  REPORT_LOOKUP_KINDS,
  type ClaimStatus,
} from "../types/customer-incentive.types";

// Directus date filters and the Manila calendar both require plain ISO dates.
const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

// Directus compares these verbatim, so a pasted code with padding would match
// nothing and read as "this customer has no claims".
const codeString = (max: number) => z.string().trim().min(1).max(max);

/**
 * A list filter may arrive as one value, as a comma-joined value, or as the
 * same key repeated. All three flatten to an array so the repo sees one shape.
 * An empty value means "no cut here" and becomes undefined rather than a list
 * that matches nothing.
 */
function toList(raw: unknown): unknown {
  if (raw == null || raw === "") return undefined;
  const values = Array.isArray(raw) ? raw : [raw];
  const items = values
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return items;
}

// Upper bound for explicit multi-select IDs, scaled to support selecting across large master datasets.
const LIST_LIMIT = 2000;

const idList = z.preprocess(
  toList,
  z.array(z.coerce.number().int().positive()).max(LIST_LIMIT).optional()
);

const codeList = z.preprocess(
  toList,
  z.array(codeString(64)).max(LIST_LIMIT).optional()
);

// The label map is keyed by exactly the five business states, so its keys are
// the enum — deriving them here keeps a new status from validating while the
// report still has no label for it.
const claimStatusValues = Object.keys(CLAIM_STATUS_LABELS) as [
  ClaimStatus,
  ...ClaimStatus[],
];

const filterShape = z.object({
  startDate: isoDateString,
  endDate: isoDateString,
  customerCodes: codeList,
  branchIds: idList,
  salesmanIds: idList,
  classificationIds: idList,
  claimStatus: z.enum(claimStatusValues).optional(),
  // categories.category_id, always narrowed to is_industrial = 1 in the repo.
  categoryIds: idList,
  // A zero or fractional size would silently reprice every eligible line, so
  // the eligible cylinder size is constrained to the range the domain uses.
  sizeKg: z.coerce.number().int().min(1).max(100).optional(),
});

// An inverted window would silently return zero rows and read as
// "no incentive earned", so it is rejected rather than normalised.
const orderedWindow = (value: { startDate: string; endDate: string }) =>
  value.startDate <= value.endDate;

const windowIssue = {
  path: ["startDate"],
  message: "startDate must not be after endDate",
};

export const customerIncentiveFilterSchema = filterShape.refine(
  orderedWindow,
  windowIssue
);

export type CustomerIncentiveFilterInput = z.infer<
  typeof customerIncentiveFilterSchema
>;

// Drill-down reuses the filter shape but always needs a customer. The
// refinement is re-applied here because extending an already-refined schema
// would drop the check and let an inverted window through.
export const customerIncentiveDetailSchema = filterShape
  .extend({ customerDetail: codeString(64) })
  .refine(orderedWindow, windowIssue);

export type CustomerIncentiveDetailInput = z.infer<
  typeof customerIncentiveDetailSchema
>;

// Lookups are typeahead reads; the type is whitelisted so an arbitrary
// collection name can never reach Directus.
export const reportLookupQuerySchema = z.object({
  type: z.enum(REPORT_LOOKUP_KINDS),
  q: z.string().max(100).optional(),
});

export type ReportLookupQueryInput = z.infer<typeof reportLookupQuerySchema>;
