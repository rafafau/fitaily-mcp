import { describe, it, expect, vi, afterEach } from "vitest";
import { fitailyGet, FitailyApiError } from "../src/api/fitaily-client";

afterEach(() => vi.unstubAllGlobals());

describe("fitailyGet", () => {
  it("unwraps {data} and never leaks bodies on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { date: "2026-10-16" } }),
      }),
    );
    const out = await fitailyGet<any>("tok", "/nutrition/day-summary", { date: "2026-10-16" });
    expect(out).toEqual({ date: "2026-10-16" });
  });

  it("maps 401 without backend body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ secret: "x" }) }));
    await expect(fitailyGet("tok", "/activity")).rejects.toMatchObject({ status: 401 });
    try {
      await fitailyGet("tok", "/activity");
    } catch (err) {
      expect((err as Error).message).not.toContain("secret");
      expect(err).toBeInstanceOf(FitailyApiError);
    }
  });

  it("maps network failure to 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(fitailyGet("tok", "/activity")).rejects.toMatchObject({ status: 502 });
  });
});
