import { describe, expect, it } from "vitest";
import { assessmentChildren, assessmentDiagnostics, assessmentQuestionCount, assessmentQuestionSource, assessmentShareLink, findEntity, questionList, questionPath } from "./assessment";

describe("NPrep question data", () => {
  it("finds an exam inside a test series", () => {
    expect(findEntity({ data: { sections: [{ all_tests: [{ id: 118, exams: [{ id: 119, name: "Exam" }] }] }] } }, "119")?.name).toBe("Exam");
  });
  it("normalizes supplied questions without inventing an answer key", () => {
    expect(questionList({ questions: [{ id: 8, question: "Which?", options: ["A", "B"] }] })).toEqual([{ id: "8", text: "Which?", options: [{ id: "0", text: "A", correct: false }, { id: "1", text: "B", correct: false }], correctId: undefined, explanation: undefined }]);
  });
  it("finds embedded questions in nested NPrep response envelopes", () => {
    expect(questionList({ result: { payload: { question_list: [{ question_id: 9, question_text: "Nested?", choices: { a: "Yes", b: "No" } }] } } })).toMatchObject([
      { id: "9", text: "Nested?", options: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }] },
    ]);
  });
  it("normalizes camelCase question fields and JSON-encoded answer options", () => {
    expect(questionList({ result: { items: [{ questionId: 7, questionText: "Camel case?", answer_options: "[{\"option_id\":\"A\",\"option_text\":\"Yes\"}]" }] } })).toMatchObject([
      { id: "7", text: "Camel case?", options: [{ id: "A", text: "Yes" }] },
    ]);
  });
  it("parses a JSON-encoded nested question array with option_a fields", () => {
    const payload = { data: { questions: JSON.stringify([{ questionId: "q1", questionTitle: "Encoded?", option_a: "True", option_b: "False" }]) } };
    expect(questionList(payload)).toMatchObject([{ id: "q1", text: "Encoded?", options: [{ id: "a", text: "True" }, { id: "b", text: "False" }] }]);
  });
  it("parses a single embedded question object", () => {
    expect(questionList({ data: { question: { questionId: 2, questionText: "One?", options: ["Yes", "No"] } } })).toMatchObject([
      { id: "2", text: "One?", options: [{ text: "Yes" }, { text: "No" }] },
    ]);
  });
  it("follows a supplied NPrep question URL", () => {
    expect(questionPath({ questions_url: "https://api.nprep.in/v3/test/questions?testId=118" })).toBe("/test/questions?testId=118");
  });
  it("finds a nested question link returned by NPrep", () => {
    expect(questionPath({ data: { links: { question_paper: { url: "/v3/qbank/questions?subjectId=118" } } } })).toBe("/qbank/questions?subjectId=118");
  });
  it("follows a question link discovered on the fetched catalog entity", () => {
    const source = assessmentQuestionSource({ data: { tests: [{ id: 118, name: "PYQ", links: { questions: "/v3/test/118/questions" } }] } }, "118", { id: 118, name: "PYQ" });
    expect(source.path).toBe("/test/118/questions");
    expect(source.entity.name).toBe("PYQ");
  });
  it("normalizes an explicitly supplied unversioned NPrep question link", () => {
    expect(questionPath({ links: { questions: "https://api.nprep.in/test/questions?testId=118" } })).toBe("/test/questions?testId=118");
  });
  it("follows a test_url explicitly supplied by NPrep", () => {
    expect(questionPath({ test_url: "/v3/test/118/questions" })).toBe("/test/118/questions");
  });
  it("uses NPrep share_link as a visible share URL without treating it as an API endpoint", () => {
    expect(assessmentShareLink({ share_link: "https://nprep.in/share/subject/118" })).toBe("https://nprep.in/share/subject/118");
    expect(questionPath({ share_link: "https://nprep.in/share/subject/118" })).toBeUndefined();
  });
  it("reads total_questions from nested test data", () => {
    expect(assessmentQuestionCount({ data: { total_questions: 125, year_tag: [] } })).toBe(125);
  });
  it("follows explicit versioned question routes outside the qbank/test namespaces", () => {
    expect(questionPath({ question_url: "https://api.nprep.in/v3/assessment/118/questions" })).toBe("/assessment/118/questions");
    expect(questionPath({ question_url: "https://api.nprep.in/v3/auth/profile" })).toBeUndefined();
  });
  it("does not follow unrelated generic URLs", () => {
    expect(questionPath({ url: "https://api.nprep.in/v3/test/118/overview" })).toBeUndefined();
  });
  it("rejects an off-origin question URL", () => {
    expect(questionPath({ questions_url: "https://attacker.example/v3/test/questions" })).toBeUndefined();
  });
  it("does not invent an endpoint for a catalog item", () => {
    expect(questionPath({ id: 118 })).toBeUndefined();
    expect(questionList({ id: 118, name: "Test series" })).toEqual([]);
  });
  it("shows only assessment response field names in diagnostics", () => {
    const diagnostic = assessmentDiagnostics({ selected: { id: 1 }, fetched: { data: { questionText: "private question", accessToken: "secret" } } });
    expect(diagnostic).toContain("fetched.data.questionText: string");
    expect(diagnostic).not.toContain("private question");
    expect(diagnostic).not.toContain("secret");
  });
  it("opens nested exams", () => {
    expect(assessmentChildren({ exams: [{ id: 119 }] })).toEqual([{ id: 119 }]);
  });
  it("finds assessment children inside a nested response envelope", () => {
    const sections = assessmentChildren({ data: { sections: [{ all_tests: [{ id: 118 }] }] } });
    expect(sections).toHaveLength(1);
    expect(assessmentChildren(sections[0])).toEqual([{ id: 118 }]);
  });
});