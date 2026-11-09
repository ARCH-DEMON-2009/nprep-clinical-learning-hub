import { describe, expect, it, vi } from "vitest";
import { api, firstArray, findKey, idOf, isExpiredSessionResponse, titleOf, unwrap } from "./api";

describe("API client", () => {
  it("shows an actionable OTP rejection without exposing raw Forbidden", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "NPrep rejected the OTP request (Forbidden)." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    })));
    await expect(api("/auth/request-otp", { method: "POST", body: "{}" })).rejects.toThrow("NPrep is currently rejecting OTP requests");
    vi.unstubAllGlobals();
  });
});

describe("api helpers", () => {
  it("treats authenticated 401 and 403 responses as expired sessions", () => {
    expect(isExpiredSessionResponse(401, "token")).toBe(true);
    expect(isExpiredSessionResponse(403, "token")).toBe(true);
    expect(isExpiredSessionResponse(403, null)).toBe(false);
    expect(isExpiredSessionResponse(200, "token")).toBe(false);
  });

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
  it("recognizes batch names and batch ids", () => {
    expect(titleOf({ batch_name: "Rapid Revision 2.0" })).toBe("Rapid Revision 2.0");
    expect(idOf({ batch_id: 118 })).toBe("118");
  });
  it("finds nested lectures without relying on the wrapper array name", () => {
    expect(firstArray({ payload: { course_content: [{ id: 8, name: "Lecture" }] } })).toEqual([{ id: 8, name: "Lecture" }]);
  });
});
