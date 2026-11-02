import { describe, expect, it } from "vitest";
import { jsonResult } from "../src/utils/result.js";

function textOf(result: ReturnType<typeof jsonResult>): string {
  const block = result.content[0];
  if (block.type !== "text") throw new Error("expected a text block");
  return block.text;
}

describe("jsonResult", () => {
  it("keeps text and structuredContent in sync", () => {
    const result = jsonResult({ kcal: 520, tags: ["lunch"], nested: { protein: 30 }, skipped: undefined });
    const expected = { kcal: 520, tags: ["lunch"], nested: { protein: 30 } };
    expect(JSON.parse(textOf(result))).toEqual(expected);
    expect(result.structuredContent).toEqual(expected);
  });

  it("wraps arrays in { data } so structuredContent stays an object", () => {
    const result = jsonResult([{ id: "1" }, { id: "2" }]);
    expect(result.structuredContent).toEqual({ data: [{ id: "1" }, { id: "2" }] });
    expect(JSON.parse(textOf(result))).toEqual([{ id: "1" }, { id: "2" }]);
  });

  it("marks errors without changing the payload", () => {
    const result = jsonResult({ error: "Diet plan not found" }, { isError: true });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ error: "Diet plan not found" });
  });
});
