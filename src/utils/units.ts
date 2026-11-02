import { fitailyGet } from "../api/fitaily-client.js";
import type { Profile } from "../api/types.js";

const LB_PER_KG = 2.20462262185;
const CM_PER_INCH = 2.54;
const INCH_PER_FOOT = 12;

/** Konwertuje kilogramy na funty (1 decimal place). Zwraca null dla null/undefined. */
export function kgToLbs(kg: number | null | undefined): number | null {
  if (kg === null || kg === undefined) return null;
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

/** Konwertuje cm na stopy i cale. Zwraca null dla null/undefined. */
export function cmToFtIn(cm: number | null | undefined): { feet: number; inches: number } | null {
  if (cm === null || cm === undefined) return null;
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / INCH_PER_FOOT);
  const inches = Math.round(totalInches % INCH_PER_FOOT);
  return { feet, inches };
}

/** Pobiera jednostki użytkownika z profilu (domyślnie metric). */
export async function getUserUnits(accessToken: string): Promise<string> {
  try {
    const profile = await fitailyGet<Profile>(accessToken, "/auth/me");
    return profile?.units ?? "metric";
  } catch {
    return "metric";
  }
}

export function isImperial(units: string): boolean {
  return units === "imperial";
}

/** Konwertuje obiekt statystyk wagi ({min,max,avg,latest,first}) na funty gdy imperial. */
export function convertWeightStats(
  stats: { min?: number | null; max?: number | null; avg?: number | null; latest?: number | null; first?: number | null } | null | undefined,
  imperial: boolean,
) {
  if (!stats) return stats;
  return {
    min: imperial ? kgToLbs(stats.min ?? null) : stats.min ?? null,
    max: imperial ? kgToLbs(stats.max ?? null) : stats.max ?? null,
    avg: imperial ? kgToLbs(stats.avg ?? null) : stats.avg ?? null,
    latest: imperial ? kgToLbs(stats.latest ?? null) : stats.latest ?? null,
    first: imperial ? kgToLbs(stats.first ?? null) : stats.first ?? null,
  };
}

/** Konwertuje pojedynczą wagę (kg → lbs gdy imperial). */
export function convertWeight(kg: number | null | undefined, imperial: boolean): number | null {
  return imperial ? kgToLbs(kg) : (kg ?? null);
}

/** Konwertuje wartość celu (current/target/remaining) gdy typ to waga i jednostki imperialne. */
export function convertGoalValue(value: number | null | undefined, imperial: boolean): number | null {
  return imperial ? kgToLbs(value) : (value ?? null);
}
