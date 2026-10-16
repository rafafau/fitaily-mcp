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

// ---------------------------------------------------------------------------
// Recipes (write + browse). Free for every account — the MCP server does not
// apply subscription limits; the backend keeps its own validation.
// ---------------------------------------------------------------------------

const RecipeIngredientInput = z.object({
  productName: z.string().min(1).max(200),
  amount: z.number().min(0).max(10000),
  unit: z.string().min(1).max(20),
  // Optional per-100 macros so the recipe carries nutrition without a product lookup.
  caloriesPer100: z.number().min(0).max(1000).optional(),
  proteinPer100: z.number().min(0).max(100).optional(),
  carbsPer100: z.number().min(0).max(100).optional(),
  fatPer100: z.number().min(0).max(100).optional(),
});

const RecipeStepInput = z.object({
  instruction: z.string().min(1).max(2000),
});

export const ListRecipesInput = z.object({
  search: z.string().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const PublicRecipesInput = z.object({
  search: z.string().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const GetRecipeInput = z.object({
  id: z.string().min(1),
});

export const CreateRecipeInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  prepTimeMinutes: z.number().int().min(0).max(1440),
  cookTimeMinutes: z.number().int().min(0).max(1440),
  servings: z.number().int().min(1).max(100),
  ingredients: z.array(RecipeIngredientInput).min(1).max(60),
  steps: z.array(RecipeStepInput).min(1).max(50),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  isPublic: z.boolean().optional(),
  sourceLanguage: z.enum(["pl", "en"]).optional(),
});

export const UpdateRecipeInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  prepTimeMinutes: z.number().int().min(0).max(1440).optional(),
  cookTimeMinutes: z.number().int().min(0).max(1440).optional(),
  servings: z.number().int().min(1).max(100).optional(),
  ingredients: z.array(RecipeIngredientInput).min(1).max(60).optional(),
  steps: z.array(RecipeStepInput).min(1).max(50).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  isPublic: z.boolean().optional(),
});

export const DeleteRecipeInput = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Exercise catalog + strength plans
// ---------------------------------------------------------------------------

export const SearchExercisesInput = z.object({
  search: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(40).optional(),
  equipment: z.string().min(1).max(60).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const GetExerciseInput = z.object({
  id: z.string().min(1),
});

export const ListWorkoutPlansInput = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

export const GetWorkoutPlanInput = z.object({
  id: z.string().min(1),
});

const PlanExerciseInput = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(20).optional(),
  reps: z.string().min(1).max(20).optional(),
  orderIndex: z.number().int().min(0).max(200).optional(),
  dayOfWeek: z.number().int().min(1).max(7).optional(),
});

export const CreateWorkoutPlanInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  exercises: z.array(PlanExerciseInput).min(1).max(60),
});

export const UpdateWorkoutPlanInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  exercises: z.array(PlanExerciseInput).min(1).max(60).optional(),
});

export const DeleteWorkoutPlanInput = z.object({
  id: z.string().min(1),
});
