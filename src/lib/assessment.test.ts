import { describe, expect, it } from "vitest";
import { assessmentChildren, findEntity, questionList, questionPath } from "./assessment";

describe("NPrep question data", () => {
  it("finds an exam inside a test series", () => {
    expect(findEntity({ data: { sections: [{ all_tests: [{ id: 118, exams: [{ id: 119, name: "Exam" }] }] }] } }, "119")?.name).toBe("Exam");
  });
  it("normalizes supplied questions without inventing an answer key", () => {
    expect(questionList({ questions: [{ id: 8, question: "Which?", options: ["A", "B"] }] })).toEqual([{ id: "8", text: "Which?", options: [{ id: "0", text: "A", correct: false }, { id: "1", text: "B", correct: false }], correctId: undefined, explanation: undefined }]);
  });
  it("follows a supplied NPrep question URL", () => {
    expect(questionPath({ questions_url: "https://api.nprep.in/v3/test/questions?testId=118" })).toBe("/test/questions?testId=118");
  });
  it("rejects an off-origin question URL", () => {
    expect(questionPath({ questions_url: "https://attacker.example/v3/test/questions" })).toBeUndefined();
  });
  it("does not invent an endpoint for a catalog item", () => {
    expect(questionPath({ id: 118 })).toBeUndefined();
    expect(questionList({ id: 118, name: "Test series" })).toEqual([]);
  });
  it("opens nested exams", () => {
    expect(assessmentChildren({ exams: [{ id: 119 }] })).toEqual([{ id: 119 }]);
  });
});