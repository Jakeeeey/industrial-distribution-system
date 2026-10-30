// ============================================================
// directus.ts
// Minimal Directus REST client for this report. Server-side only: the
// static token must never reach the browser.
// Kept deliberately small — one GET, one projection, one filter object.
// ============================================================

import {
  UpstreamContractError,
  UpstreamHttpError,
} from "./customer-order-consumption.errors";
import { isAbortError } from "./customer-order-consumption.helpers";

export interface DirectusConfig {
  baseUrl: string;
  token: string;
}

export interface DirectusFetchOptions {
  fields: string;
  filter?: Record<string, unknown>;
  sort?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Reads the Directus endpoint from the environment.
 * `NEXT_PUBLIC_API_BASE_URL` is sometimes stored without a scheme, which is
 * why the bare host:port case is normalised instead of rejected.
 */
export function resolveDirectusConfig(
  env: NodeJS.ProcessEnv = process.env
): DirectusConfig {
  const raw = (
    env.DIRECTUS_URL ||
    env.NEXT_PUBLIC_DIRECTUS_URL ||
    env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  const token = (env.DIRECTUS_STATIC_TOKEN || env.DIRECTUS_TOKEN || "").trim();

  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured. Cannot fetch the Customer Order & Consumption Report."
    );
  }

  return {
    baseUrl: /^https?:\/\//i.test(raw) ? raw : `http://${raw}`,
    token,
  };
}

function buildUrl(
  config: DirectusConfig,
  collection: string,
  options: DirectusFetchOptions
): string {
  const url = new URL(`${config.baseUrl}/items/${collection}`);
  url.searchParams.set("fields", options.fields);
  if (options.filter && Object.keys(options.filter).length > 0) {
    url.searchParams.set("filter", JSON.stringify(options.filter));
  }
  if (options.sort) url.searchParams.set("sort", options.sort);
  // Directus defaults to a 100-row page; a report needs the whole set.
  url.searchParams.set("limit", String(options.limit ?? -1));
  return url.toString();
}

/**
 * GETs one collection and returns its rows.
 * A non-array `data` payload is a contract break, not an empty result, so it
 * throws instead of silently reporting zero demand.
 */
export async function fetchDirectusRows<T>(
  collection: string,
  options: DirectusFetchOptions,
  config: DirectusConfig
): Promise<T[]> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;

  const doFetch = options.fetchImpl ?? fetch;
  let response: Response;

  try {
    response = await doFetch(buildUrl(config, collection, options), {
      headers,
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new UpstreamHttpError(null, "", { cause: error });
  }

  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new UpstreamContractError(
      `Directus collection ${collection} returned a non-JSON response.`
    );
  }

  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    throw new UpstreamContractError(
      `Directus collection ${collection} returned no 'data' array.`
    );
  }

  return data as T[];
}

/**
 * Runs one request per chunk. MySQL has no limit on the number of `_in`
 * values, but the URL does — 500 ids keeps every request well under it.
 */
export function chunk<T>(items: T[], size = 500): T[][] {
  if (items.length === 0) return [];
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
