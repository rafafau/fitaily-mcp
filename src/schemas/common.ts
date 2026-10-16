import { z } from "zod";

export const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd")
  .optional();

export const MealType = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const TodayNutritionInput = z.object({
  date: DateString,
});

export const MealHistoryInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd"),
  mealType: MealType.optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const MacroBase = {
  foodName: z.string().min(1).max(200),
  calories: z.number().min(0).max(5000),
  protein: z.number().min(0).max(500),
  carbs: z.number().min(0).max(500),
  fat: z.number().min(0).max(500),
};

export const AddMealInput = z.object({
  mealType: MealType,
  ...MacroBase,
  servingSize: z.string().max(120).optional(),
  date: z.string().datetime().optional(),
  clientRequestId: z.string().min(1).max(128).optional(),
});

export const UpdateMealInput = z.object({
  id: z.string().min(1),
  mealType: MealType.optional(),
  foodName: z.string().min(1).max(200).optional(),
  calories: z.number().min(0).max(5000).optional(),
  protein: z.number().min(0).max(500).optional(),
  carbs: z.number().min(0).max(500).optional(),
  fat: z.number().min(0).max(500).optional(),
  servingSize: z.string().max(120).optional(),
});

export const DeleteMealInput = z.object({
  id: z.string().min(1),
});

export const FoodSearchInput = z.object({
  query: z.string().min(2).max(120),
  limit: z.number().int().min(1).max(20).optional(),
});

export const BarcodeInput = z.object({
  code: z.string().min(4).max(32),
});

export const WaterHistoryInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const LogWaterInput = z.object({
  amountMl: z.number().int().min(10).max(3000),
  date: z.string().datetime().optional(),
});

export const DeleteWaterInput = z.object({
  id: z.string().min(1),
});

export const TrainingHistoryInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const LogActivityInput = z.object({
  type: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  durationMin: z.number().int().min(1).max(1440),
  distanceKm: z.number().min(0).max(500).optional(),
  caloriesBurned: z.number().min(0).max(10000).optional(),
  date: z.string().datetime().optional(),
});

export const ProgressSummaryInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
});

export const MeasurementHistoryInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const AddMeasurementInput = z.object({
  weight: z.number().min(0).max(500).optional(),
  bodyFat: z.number().min(0).max(100).optional(),
  muscleMass: z.number().min(0).max(300).optional(),
  date: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const AddGoalInput = z.object({
  type: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  targetValue: z.number(),
  unit: z.string().max(20).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd").optional(),
});

export const UpdateGoalInput = z.object({
  id: z.string().min(1),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  isCompleted: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateNutritionGoalsInput = z.object({
  dailyCaloriesGoal: z.number().int().min(500).max(15000).optional(),
  proteinGoal: z.number().min(0).max(1000).optional(),
  carbsGoal: z.number().min(0).max(1000).optional(),
  fatGoal: z.number().min(0).max(1000).optional(),
});

export const RecipeSuggestionInput = z.object({
  date: DateString,
  mealType: MealType.optional(),
  maxTimeMin: z.number().int().min(5).max(300).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});
