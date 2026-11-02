/**
 * Backend response shapes.
 *
 * These describe only the fields the tools read; everything else is ignored.
 * They are deliberately loose (`| null`, optional) because the Fitaily API is a
 * separate deployable and may add fields at any time — the tools must keep
 * working and only ever forward the projections defined in `src/tools/`.
 */

/** First array found: the value itself, or one of the named envelope keys. */
export function listOf<T>(value: unknown, ...keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      const candidate = record[key];
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }
  return [];
}

/** Response of a create/update call when the tool only needs the new id. */
export interface CreatedEntity {
  id?: string;
  date?: string;
}

// --- Training -------------------------------------------------------------

export interface Activity {
  id?: string;
  date?: string;
  type?: string;
  name?: string;
  distance?: number | null;
  /** Seconds. */
  duration?: number | null;
  caloriesBurned?: number | null;
  averageHeartrate?: number | null;
}

export interface WorkoutSet {
  reps?: number | null;
  weight?: number | null;
  isCompleted?: boolean;
}

export interface WorkoutExercise {
  name?: string;
  exercise?: { name?: string } | null;
  sets?: WorkoutSet[];
}

export interface Workout {
  id?: string;
  date?: string;
  startTime?: string;
  name?: string;
  status?: string;
  exercises?: WorkoutExercise[];
}

export interface PlanSummary {
  id?: string;
  name?: string;
  description?: string | null;
  origin?: string | null;
}

export interface ExerciseRecord {
  exerciseId?: string;
  exerciseName?: string;
  recordType?: string;
  value?: number | null;
  unit?: string | null;
  reps?: number | null;
  weight?: number | null;
  previousValue?: number | null;
  achievedAt?: string | null;
}

export interface ExerciseSessionSet {
  reps?: number | null;
  weight?: number | null;
  /** Seconds (time-based exercises). */
  time?: number | null;
  estimated1RM?: number | null;
  isPersonalRecord?: boolean;
}

export interface ExerciseSession {
  date?: string;
  workoutDate?: string;
  workoutName?: string;
  sets?: ExerciseSessionSet[];
  maxWeight?: number | null;
  totalReps?: number | null;
  sessionVolume?: number | null;
  totalVolume?: number | null;
  bestSetVolume?: number | null;
  best1RM?: number | null;
}

export interface MuscleActivation {
  exerciseId?: string;
  name?: string;
  category?: string | null;
  muscleGroup?: string | null;
  completedSets?: number | null;
}

// --- Progress -------------------------------------------------------------

export interface Measurement {
  id?: string;
  date?: string;
  weight?: number | null;
  bodyFat?: number | null;
  muscleMassKg?: number | null;
  muscleMass?: number | null;
}

export interface TrendPoint {
  date?: string;
  weight?: number | null;
}

export interface Goal {
  id?: string;
  type?: string;
  name?: string;
  currentValue?: number | null;
  targetValue?: number | null;
  unit?: string | null;
  isActive?: boolean;
  isCompleted?: boolean;
  targetDate?: string | null;
}

export interface GoalProgress {
  goalId?: string;
  remaining?: number | null;
  percentComplete?: number | null;
  isOnTrack?: boolean | null;
  daysRemaining?: number | null;
}

export interface MetricTrend {
  category?: string;
  metric?: string;
  unit?: string | null;
  points?: TrendPoint[];
  delta?: number | null;
  startValue?: number | null;
  endValue?: number | null;
}

export interface ForecastPoint {
  date?: string | null;
  value?: number | null;
  confidenceLower?: number | null;
  confidenceUpper?: number | null;
}

export interface Forecast {
  metric?: string;
  unit?: string | null;
  engineType?: string | null;
  forecast?: ForecastPoint[];
}

// --- Nutrition ------------------------------------------------------------

export interface NutritionGoals {
  caloriesGoal?: number | null;
  proteinGoal?: number | null;
  carbsGoal?: number | null;
  fatGoal?: number | null;
}

export interface MealSuggestion {
  source?: string | null;
  recipeId?: string | null;
  recipeName?: string | null;
  productId?: string | null;
  productName?: string | null;
  gramsToUse?: number | null;
  servingMultiplier?: number | null;
  comboItems?: unknown;
  projected?: unknown;
  matchScore?: number | null;
}

export interface MealSuggestions {
  suggestions?: MealSuggestion[];
  mealTarget?: unknown;
  dailyRemaining?: unknown;
  offerAiFallback?: boolean;
}

export interface NutritionStats {
  totals?: unknown;
  averagePerDay?: unknown;
  byMealType?: unknown;
  entryCount?: number | null;
}

export interface ActivityStats {
  totals?: unknown;
  byType?: unknown;
  averagePerDay?: unknown;
}

export interface MeasurementStats {
  count?: number | null;
  weight?: unknown;
  bodyFat?: unknown;
  muscleMass?: unknown;
  bmi?: unknown;
}

export interface NutritionHistoryRow {
  foodName?: string | null;
  productBarcode?: string | null;
  occurrences?: number | null;
  avgCalories?: number | null;
  avgProtein?: number | null;
  avgCarbs?: number | null;
  avgFat?: number | null;
}

export interface FoodProduct {
  id?: string;
  name?: string;
  brand?: string | null;
  barcode?: string | null;
  caloriesPer100?: number | null;
  calories?: number | null;
  proteinPer100?: number | null;
  protein?: number | null;
  carbsPer100?: number | null;
  carbs?: number | null;
  fatPer100?: number | null;
  fat?: number | null;
  servingSize?: string | null;
  servingUnit?: string | null;
}

export interface WaterEntry {
  id?: string;
  amount?: number | null;
  date?: string | null;
  createdAt?: string | null;
}

export interface FridgeItem {
  id?: string;
  name?: string;
  quantity?: string | number | null;
  category?: string | null;
  expiryDate?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

export interface ShoppingItem {
  id?: string;
  name?: string;
  quantity?: string | number | null;
  category?: string | null;
  isCompleted?: boolean;
}

export interface ShoppingList {
  id?: string;
  name?: string;
  items?: ShoppingItem[];
}

export interface RecipeTagRef {
  slug?: string;
  label?: string;
  name?: string;
  count?: number | null;
}

export interface DiscoveryRecipe {
  id?: string;
  title?: string;
  calories?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  durationMinutes?: number | null;
  servings?: number | null;
  reason?: string | null;
}

export interface DiscoverySection {
  key?: string;
  items?: DiscoveryRecipe[];
}

// --- Profile --------------------------------------------------------------

export interface Profile {
  id?: string;
  dateOfBirth?: string | null;
  displayName?: string | null;
  email?: string | null;
  language?: string | null;
  units?: string | null;
  height?: number | null;
  gender?: string | null;
  activityLevel?: string | null;
  weightDirection?: string | null;
  targetWeight?: number | null;
  dailyCaloriesGoal?: number | null;
  proteinGoal?: number | null;
  carbsGoal?: number | null;
  fatGoal?: number | null;
}

export interface CoachProfile {
  isActive?: boolean;
  goal?: string | null;
  phase?: string | null;
  targetWeeklyRateKg?: number | null;
  currentCalories?: number | null;
  baselineCalories?: number | null;
  minCaloriesFloor?: number | null;
  maxCaloriesCeiling?: number | null;
  macroStrategy?: string | null;
  proteinPerKgBw?: number | null;
  autoCalories?: boolean | null;
  effectiveGoals?: unknown;
  dailyPredictions?: unknown[];
}

export interface DashboardStats {
  calories?: number | null;
  workouts?: number | null;
  weight?: number | null;
  records?: number | null;
}
