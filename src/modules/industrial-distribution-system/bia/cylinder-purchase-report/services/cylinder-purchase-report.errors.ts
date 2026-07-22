export class UpstreamHttpError extends Error {
  public readonly status: number;

  constructor(
    status: number,
    statusText: string,
  ) {
    super(`Spring report request failed (${status} ${statusText}).`);
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
