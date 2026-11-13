import type { McpServer } from "@modelcontextprotocol/server";

export const STARTER_PROMPTS = [
  {
    name: "daily_overview",
    title: "Review my day",
    description: "Summarize today's Fitaily nutrition and training at a glance.",
    tools: ["get_dashboard_summary", "get_today_nutrition"],
    text: "Give me a concise overview of my Fitaily nutrition and training today. Start with get_dashboard_summary and use get_today_nutrition if meal details would help. Reply in the user's language.",
  },
  {
    name: "log_a_meal",
    title: "Log a meal",
    description: "Find catalog foods, prepare a meal entry, and ask before saving it.",
    tools: ["search_foods", "add_meal"],
    text: "Help me log this meal in Fitaily: [describe the meal]. Use search_foods to find products and their macros; never invent food IDs or macros. Show a short summary with the meal type, portions, and totals, then wait for my explicit “yes” before calling add_meal. If an item is missing from the catalog and I have not provided its macros, ask me for them. Reply in the user's language.",
  },
  {
    name: "weekly_nutrition_review",
    title: "Review my nutrition week",
    description: "Summarize meal patterns and daily nutrition over the last week.",
    tools: ["get_nutrition_stats", "get_meal_history", "get_profile"],
    text: "Review my nutrition over the last seven days. Use get_nutrition_stats for the overview and get_meal_history for examples. Call get_profile before giving calorie or macro advice, and ground every number in returned Fitaily data. Reply in the user's language.",
  },
  {
    name: "update_nutrition_goals",
    title: "Update my nutrition goals",
    description: "Prepare new daily calorie or macro goals and wait for approval before saving.",
    tools: ["get_profile", "update_nutrition_goals"],
    text: "Help me update my Fitaily nutrition goals to: [calories and macros]. First call get_profile to review my current profile and goals. Show the exact proposed values in a short summary and wait for my explicit “yes” before calling update_nutrition_goals. Do not infer missing values. Reply in the user's language.",
  },
  {
    name: "recipe_for_today",
    title: "Find a recipe for today",
    description: "Find recipes that fit the calories and macros remaining today.",
    tools: ["find_recipes_for_remaining_macros"],
    text: "Suggest a recipe that fits the calories and macros I have left today. Use find_recipes_for_remaining_macros and base nutrition details only on its results or information I provide. Reply in the user's language.",
  },
  {
    name: "training_week_review",
    title: "Review my training week",
    description: "Summarize recent activities and completed strength workouts.",
    tools: ["get_training_history", "get_personal_records"],
    text: "Summarize my recent training, including cardio and strength sessions, and mention any personal records if the data shows them. Use get_training_history and get_personal_records. Do not infer a workout that is missing from Fitaily. Reply in the user's language.",
  },
  {
    name: "exercise_progress",
    title: "Check exercise progress",
    description: "Review completed sets and progression for one exercise.",
    tools: ["search_exercises", "get_exercise_history"],
    text: "Review my progress for [exercise]. Find the exercise in Fitaily with search_exercises, then use get_exercise_history for its recent completed sets. Do not invent an exercise ID or recommend a load unsupported by the returned history. Reply in the user's language.",
  },
  {
    name: "strength_workout_ideas",
    title: "Plan my next workout",
    description: "Suggest a strength workout using the user's existing plan and exercise catalog.",
    tools: ["get_workout_plans", "search_exercises", "get_personal_records"],
    text: "Help me plan my next strength workout. Review my existing plans with get_workout_plans, use search_exercises for any exercise you suggest, and check get_personal_records before discussing previous bests. Do not change or save a plan. Reply in the user's language.",
  },
  {
    name: "body_progress_review",
    title: "Review my body progress",
    description: "Summarize measurement trends and progress toward active goals.",
    tools: ["get_progress_summary", "get_measurement_history", "get_goal_progress"],
    text: "Summarize my body-measurement trend and progress toward my active goals. Use get_progress_summary, get_measurement_history, and get_goal_progress. Clearly distinguish recorded values from estimates and do not give medical advice. Reply in the user's language.",
  },
  {
    name: "plan_with_my_fridge",
    title: "Plan a meal from my fridge",
    description: "Use fridge items and today's nutrition to suggest a practical meal.",
    tools: ["get_fridge", "get_today_nutrition", "get_profile"],
    text: "Suggest a practical meal using ingredients I already have in my Fitaily fridge. Use get_fridge and get_today_nutrition; call get_profile before giving calorie or macro advice. Only state macros returned by Fitaily or supplied by me. Reply in the user's language.",
  },
] as const;

export function registerPrompts(server: McpServer): void {
  for (const prompt of STARTER_PROMPTS) {
    server.registerPrompt(prompt.name, { title: prompt.title, description: prompt.description }, () => ({
      messages: [{ role: "user", content: { type: "text", text: prompt.text } }],
    }));
  }
}
