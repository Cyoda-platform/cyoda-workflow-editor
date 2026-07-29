import { describe, expect, test } from "vitest";
import { TransitionScheduleSchema } from "../../src/schema/workflow.js";

const FN = { name: "c", resultKind: "Schedule", calculationNodesTags: "s" };

describe("TransitionScheduleSchema (spec §1)", () => {
  test("accepts static mode", () => {
    expect(TransitionScheduleSchema.safeParse({ delayMs: 1000 }).success).toBe(true);
  });

  test("accepts timeoutMs of 0 — the strictest legal setting", () => {
    expect(TransitionScheduleSchema.safeParse({ delayMs: 1, timeoutMs: 0 }).success).toBe(true);
  });

  test("accepts a negative timeoutMs, which the server also accepts", () => {
    expect(TransitionScheduleSchema.safeParse({ delayMs: 1, timeoutMs: -1 }).success).toBe(true);
  });

  test("accepts function mode", () => {
    expect(TransitionScheduleSchema.safeParse({ function: FN }).success).toBe(true);
  });

  test("accepts function mode with timeoutMs", () => {
    expect(TransitionScheduleSchema.safeParse({ function: FN, timeoutMs: 5 }).success).toBe(true);
  });

  test("rejects both modes at once", () => {
    expect(TransitionScheduleSchema.safeParse({ delayMs: 5, function: FN }).success).toBe(false);
  });

  test("rejects neither mode", () => {
    expect(TransitionScheduleSchema.safeParse({ timeoutMs: 5 }).success).toBe(false);
  });

  test("requires resultKind to be exactly Schedule", () => {
    expect(TransitionScheduleSchema.safeParse({
      function: { ...FN, resultKind: "Entity" },
    }).success).toBe(false);
  });

  test("requires a non-empty calculationNodesTags", () => {
    expect(TransitionScheduleSchema.safeParse({
      function: { ...FN, calculationNodesTags: "" },
    }).success).toBe(false);
  });
});
