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

  it("uses the verified origin without consuming or changing user authorization", () => {
    const authenticated = request("POST", "Bearer test-only");
    expect(nprepApiOrigin(authenticated, "v3/auth/login")).toBe("https://nprep.in");
    expect(authenticated.headers.get("authorization")).toBe("Bearer test-only");
  });

  it("uses the verified origin for v3 API methods", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]) {
      expect(nprepApiOrigin(request(method), "v3/auth/login")).toBe("https://nprep.in");
    }
  });

  it("uses the verified origin across login and sibling content endpoints", () => {
    for (const path of ["v3/auth/login", "v3/auth/me", "v3/home", "v3/video", "v3/video/subjects", "v3/video/courses", "v3/video/sections", "v3/qbank/subjects", "v3/test"]) {
      expect(nprepApiOrigin(request(), path)).toBe("https://nprep.in");
    }
  });

  it("retains existing origin fallback behavior outside the v3 API", () => {
    expect(nprepApiOrigin(new Request("http://localhost:8080/api/nprep/v2/home"), "v2/home")).toBe("https://beta.nprep.site");
    expect(nprepApiOrigin(new Request("http://localhost:8080/api/nprep/v2/home", {
      headers: { referer: "https://app.nprep.in/" },
    }), "v2/home")).toBe("https://app.nprep.in");
  });
});