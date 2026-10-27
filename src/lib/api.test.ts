import { describe, expect, it } from "vitest";
import { findKey, unwrap } from "./api";

describe("api helpers", () => {
  it("finds a nested token", () => {
    expect(findKey({ data: { user: {}, access_token: "abc" } }, /token/i)).toBe("abc");
  });
  it("unwraps nested data envelopes", () => {
    expect(unwrap({ data: { data: [1] } })).toEqual([1]);
  });
});
