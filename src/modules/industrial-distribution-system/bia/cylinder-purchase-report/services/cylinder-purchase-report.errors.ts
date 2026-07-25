export class UpstreamHttpError extends Error {
  public readonly status: number | null;

  constructor(
    status: number | null,
    statusText: string = "",
    options?: ErrorOptions,
  ) {
    super(
      status === null
        ? "Spring report request failed."
        : `Spring report request failed (${status} ${statusText}).`,
      options,
    );
    this.name = "UpstreamHttpError";
    this.status = status;
  }
}

export class UpstreamContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamContractError";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

export interface CylinderPurchaseReportRouteError {
  body: {
    ok: false;
    code:
      | "UPSTREAM_CONTRACT_ERROR"
      | "UPSTREAM_TIMEOUT"
      | "UPSTREAM_UNAVAILABLE"
      | "INTERNAL_ERROR";
    message: string;
  };
  status: 500 | 502 | 504;
}

export function classifyCylinderPurchaseReportRouteError(
  error: unknown,
): CylinderPurchaseReportRouteError {
  if (error instanceof UpstreamContractError) {
    return {
      status: 502,
      body: {
        ok: false,
        code: "UPSTREAM_CONTRACT_ERROR",
        message: "The report service returned invalid quantity data.",
      },
    };
  }
  if (isAbortError(error)) {
    return {
      status: 504,
      body: {
        ok: false,
        code: "UPSTREAM_TIMEOUT",
        message: "The report service timed out.",
      },
    };
  }
  if (error instanceof UpstreamHttpError) {
    return {
      status: 502,
      body: {
        ok: false,
        code: "UPSTREAM_UNAVAILABLE",
        message: "The report service is unavailable.",
      },
    };
  }
  return {
    status: 500,
    body: {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Unable to load the cylinder purchase report.",
    },
  };
}
