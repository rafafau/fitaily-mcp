import { fitailyApiUrl } from "../config";

export class FitailyApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Authenticated JSON write (POST/PUT/PATCH/DELETE). Returns unwrapped data. */
export async function fitailySend<T>(
  accessToken: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = new URL(fitailyApiUrl() + path);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new FitailyApiError(502, "Fitaily API is unreachable");
  }
  if (res.status === 401 || res.status === 403) {
    throw new FitailyApiError(res.status, "Fitaily authorization failed");
  }
  if (!res.ok) {
    throw new FitailyApiError(res.status, `Fitaily API error (${res.status})`);
  }
  if (res.status === 204) return {} as T;
  const json = (await res.json().catch(() => ({}))) as any;
  return (json?.data ?? json) as T;
}
/** Thin authenticated fetch to the existing backend. No caching, no DB. */
export async function fitailyGet<T>(accessToken: string, path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const json = await fitailyGetRaw<any>(accessToken, path, params);
  return (json?.data ?? json) as T;
}

/**
 * Same as {@link fitailyGet} but keeps the whole envelope (e.g. `pagination`).
 * Use it when the caller needs metadata that lives outside `data`.
 */
export async function fitailyGetRaw<T>(
  accessToken: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const base = fitailyApiUrl();
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      // Fail fast instead of hanging a model turn on a stalled backend.
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new FitailyApiError(502, "Fitaily API is unreachable");
  }
  if (res.status === 401 || res.status === 403) {
    throw new FitailyApiError(res.status, "Fitaily authorization failed");
  }
  if (!res.ok) {
    // Never leak backend bodies to the model; status is enough to branch on.
    throw new FitailyApiError(res.status, `Fitaily API error (${res.status})`);
  }
  return (await res.json()) as T;
}
