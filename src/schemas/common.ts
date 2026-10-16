import { z } from "zod";

export const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd")
  .optional();

export const RangeInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd"),
  limit: z.number().int().min(1).max(50).optional(),
});

export const TodayNutritionInput = z.object({
  date: DateString,
});

export const TrainingHistoryInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const ProgressSummaryInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
});
