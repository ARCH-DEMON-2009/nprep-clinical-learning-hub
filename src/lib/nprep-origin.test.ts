import { describe, expect, it } from "vitest";
import { nprepApiOrigin } from "./media-proxy";

describe("NPrep API origin selection (no network requests)", () => {
  const request = (method = "POST", authorization?: string) => new Request(
    "https://beta.nprep.site/api/nprep/v3/auth/request-otp",
    { method, headers: {
      origin: "https://beta.nprep.site",
      referer: "https://beta.nprep.site/login",
      ...(authorization ? { authorization } : {}),
    } },
  );

  it("uses the verified NPrep origin and derived referer for unauthenticated OTP POST", () => {
    const origin = nprepApiOrigin(request(), "v3/auth/request-otp");
    expect(origin).toBe("https://nprep.in");
    expect(`${origin}/`).toBe("https://nprep.in/");
  });

  it("preserves the original origin for authenticated OTP requests", () => {
    expect(nprepApiOrigin(request("POST", "Bearer test-only"), "v3/auth/request-otp")).toBe("https://beta.nprep.site");
  });

  it("preserves the original origin for other methods", () => {
    for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD"]) {
      expect(nprepApiOrigin(request(method), "v3/auth/request-otp")).toBe("https://beta.nprep.site");
    }
  });

  it("preserves the original origin for all other endpoint paths", () => {
    for (const path of ["v3/auth/login", "v3/auth/me", "v3/home", "v3/video", "v3/auth/request-otp/", "v3/auth/request-otp-extra"]) {
      expect(nprepApiOrigin(request(), path)).toBe("https://beta.nprep.site");
    }
  });

  it("retains existing origin fallback behavior outside the OTP exception", () => {
    expect(nprepApiOrigin(new Request("http://localhost:8080/api/nprep/v3/home"), "v3/home")).toBe("https://beta.nprep.site");
    expect(nprepApiOrigin(new Request("http://localhost:8080/api/nprep/v3/home", {
      headers: { referer: "https://app.nprep.in/" },
    }), "v3/home")).toBe("https://app.nprep.in");
  });
});