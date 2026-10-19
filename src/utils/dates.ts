/** Date helpers shared by the tool modules (yyyy-MM-dd, UTC). */

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

/** Defaults `from`/`to` to the last `days` days ending today. */
export function resolvePeriod(
  from: string | undefined,
  to: string | undefined,
  days = 30,
): { from: string; to: string } {
  return { from: from ?? daysAgo(days), to: to ?? today() };
}
