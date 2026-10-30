// ============================================================
// customer-incentive.errors.ts
// Typed error classes for the data-fetch layer.
// Keeps error handling explicit and distinguishable in catch blocks.
// ============================================================

/**
 * Thrown when the upstream HTTP request fails (non-2xx status or network error).
 */
export class UpstreamHttpError extends Error {
  readonly statusCode: number | null;
  readonly statusText: string;

  constructor(
    statusCode: number | null,
    statusText: string,
    options?: ErrorOptions
  ) {
    const msg =
      statusCode != null
        ? `Upstream responded with ${statusCode} ${statusText}`
        : "Network error reaching the Customer Incentive & Rebate Report API";
    super(msg, options);
    this.name = "UpstreamHttpError";
    this.statusCode = statusCode;
    this.statusText = statusText;
  }
}

/**
 * Thrown when the API response shape does not match the expected contract.
 * Indicates a backend breaking change or an unexpected payload.
 */
export class UpstreamContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamContractError";
  }
}
