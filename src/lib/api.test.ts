import { describe, expect, it } from "vitest";
import { firstArray, findKey, idOf, unwrap } from "./api";

describe("api helpers", () => {
  it("finds a nested token", () => {
    expect(findKey({ data: { user: {}, access_token: "abc" } }, /token/i)).toBe("abc");
  });
  it("unwraps nested data envelopes", () => {
    expect(unwrap({ data: { data: [1] } })).toEqual([1]);
  });
  it("finds sibling course arrays inside nested payloads", () => {
    const courses = firstArray({ data: { featured: { courses: [{ id: 1, title: "Course one" }] }, all_courses: [{ id: 2, course_name: "Course two" }] } });
    expect(courses.map((course) => idOf(course))).toEqual(["1", "2"]);
  });
  it("finds nested lectures without relying on the wrapper array name", () => {
    expect(firstArray({ payload: { course_content: [{ id: 8, name: "Lecture" }] } })).toEqual([{ id: 8, name: "Lecture" }]);
  });
});
