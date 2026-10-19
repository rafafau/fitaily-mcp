import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { SearchExercisesInput, GetExerciseInput } from "../schemas/common";

interface RawExercise {
  id: string;
  name: string;
  category?: string | null;
  muscleGroup?: string | null;
  equipment?: string | null;
  type?: string | null;
  difficulty?: string | null;
  gifSourceId?: string | null;
}

function trimExercise(e: RawExercise): object {
  return {
    id: e.id,
    name: e.name,
    category: e.category ?? null,
    muscle: e.muscleGroup ?? null,
    equipment: e.equipment ?? null,
    type: e.type ?? null,
    difficulty: e.difficulty ?? null,
  };
}

/**
 * Exercise catalog. `exerciseId` values from here are what `create_workout_plan`
 * expects — never fabricate ids.
 */
export function registerExerciseTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "search_exercises",
    {
      description:
        "Search the Fitaily exercise catalog (name, category, equipment). Returns exerciseId values used when building a workout plan. Call this before create_workout_plan.",
      inputSchema: SearchExercisesInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "training:read");
      const res = await fitailyGet<any>(accessToken, "/exercises/global", {
        search: input.search,
        category: input.category,
        equipment: input.equipment,
      });
      const list = Array.isArray(res) ? res : res.exercises || res.items || res.data || [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              exercises: (list as RawExercise[]).slice(0, input.limit ?? 20).map(trimExercise),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_exercise",
    {
      description: "Single exercise by id (category, muscle group, equipment, type).",
      inputSchema: GetExerciseInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "training:read");
      const e = await fitailyGet<RawExercise>(accessToken, `/exercises/${input.id}`);
      return { content: [{ type: "text", text: JSON.stringify(trimExercise(e)) }] };
    },
  );
}
