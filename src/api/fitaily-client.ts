import { fitailyApiUrl } from "../config";

export class FitailyApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Thin authenticated fetch to the existing backend. No caching, no DB. */
export async function fitailyGet<T>(accessToken: string, path: string, params?: Record<string, string | number | undefined>): Promise<T> {
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
  const json = (await res.json()) as any;
  return (json?.data ?? json) as T;
}
