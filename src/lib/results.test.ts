import { describe, expect, it } from "vitest";
import { formatClock, scoreAttempt, testDurationSec } from "./results";

const qs = [
  { id: "1", text: "a", options: [], correctId: "x" },
  { id: "2", text: "b", options: [], correctId: "y" },
  { id: "3", text: "c", options: [] },
];

describe("attempt results", () => {
  it("scores correct, wrong and unanswered", () => {
    expect(scoreAttempt(qs, { "1": "x", "2": "z" })).toEqual({ total: 3, answered: 2, correct: 1, wrong: 1, gradable: 2, score: 50 });
  });
  it("uses NPrep duration minutes or one minute per question", () => {
    expect(testDurationSec({ duration: 90 }, 10)).toBe(5400);
    expect(testDurationSec({}, 10)).toBe(600);
  });
  it("formats the timer", () => {
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(65)).toBe("01:05");
  });
});
