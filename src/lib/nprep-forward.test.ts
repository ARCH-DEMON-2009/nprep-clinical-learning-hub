import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeMediaTarget } from "./media-proxy";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}));

import { Route as NprepRoute } from "../routes/api/nprep.$";
import { Route as MediaRoute } from "../routes/api/media.$";

type Handler = (context: { request: Request; params: { _splat: string } }) => Promise<Response>;
const nprep = (NprepRoute as unknown as { server: { handlers: { GET: Handler; POST: Handler } } }).server.handlers;
const media = (MediaRoute as unknown as { server: { handlers: { GET: Handler; POST: Handler } } }).server.handlers;

afterEach(() => vi.unstubAllGlobals());

// Mocked network only: no OTP is sent or verified and no session is created.
function captureFetch() {
  const calls: { url: string; method: string; headers: Headers; body?: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: URL, init: RequestInit) => {
    calls.push({ url: url.toString(), method: init.method ?? "GET", headers: new Headers(init.headers), ...(typeof init.body === "string" ? { body: init.body } : {}) });
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }));
  return calls;
}

const betaRequest = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
  new Request(`https://beta.nprep.site/api/nprep/${path}`, {
    ...init,
    headers: { origin: "https://beta.nprep.site", referer: "https://beta.nprep.site/login", ...init.headers },
  });

describe("NPrep pass-through uses the accepted origin", () => {
  it("sends OTP verification with nprep.in origin and an unchanged body", async () => {
    const calls = captureFetch();
    const body = JSON.stringify({ phone_number: "9000000000", otp: "000000" });
    const response = await nprep.POST({
      request: betaRequest("v3/auth/login", { method: "POST", body, headers: { "content-type": "application/json" } }),
      params: { _splat: "v3/auth/login" },
    });
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.nprep.in/v3/auth/login");
    expect(calls[0]?.headers.get("origin")).toBe("https://nprep.in");
    expect(calls[0]?.headers.get("referer")).toBe("https://nprep.in/");
    expect(calls[0]?.body).toBe(body);
  });

  it.each([
    ["v3/auth/me", ""],
    ["v3/home", ""],
    ["v3/video/subjects", ""],
    ["v3/video/courses", "?subjectId=5"],
    ["v3/video/sections", "?courseId=118"],
    ["v3/qbank/subjects", ""],
    ["v3/test", ""],
    ["v3/video", "?videoId=31"],
  ])("sends %s%s with nprep.in origin and the user's bearer token", async (path, query) => {
    const calls = captureFetch();
    await nprep.GET({
      request: betaRequest(`${path}${query}`, { headers: { authorization: "Bearer user-token" } }),
      params: { _splat: path },
    });
    expect(calls[0]?.url).toBe(`https://api.nprep.in/${path}${query}`);
    expect(calls[0]?.headers.get("origin")).toBe("https://nprep.in");
    expect(calls[0]?.headers.get("referer")).toBe("https://nprep.in/");
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer user-token");
  });

  it("keeps the bearer token on NPrep redirects but drops it for CDN redirects", async () => {
    const seen: Headers[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: URL, init: RequestInit) => {
      seen.push(new Headers(init.headers));
      if (seen.length === 1) return new Response(null, { status: 302, headers: { location: "https://api.nprep.in/v3/video/play?id=31" } });
      if (seen.length === 2) return new Response(null, { status: 302, headers: { location: "https://dsj0ye61xl4q1.cloudfront.net/a.mpd" } });
      return new Response("{}", { headers: { "content-type": "application/json" } });
    }));
    await nprep.GET({
      request: betaRequest("v3/video?videoId=31", { headers: { authorization: "Bearer user-token" } }),
      params: { _splat: "v3/video" },
    });
    expect(seen.map((h) => h.get("authorization"))).toEqual(["Bearer user-token", "Bearer user-token", null]);
  });
});

describe("lecture relay uses the accepted origin for NPrep API links", () => {
  it("sends API-hosted lecture links with nprep.in origin and the user's bearer token", async () => {
    const calls = captureFetch();
    await media.GET({
      request: new Request("https://beta.nprep.site/api/media/relay/x/", {
        headers: { origin: "https://beta.nprep.site", authorization: "Bearer user-token" },
      }),
      params: { _splat: `relay/${encodeMediaTarget("https://api.nprep.in/v3/video/stream?videoId=31")}` },
    });
    expect(calls[0]?.headers.get("origin")).toBe("https://nprep.in");
    expect(calls[0]?.headers.get("referer")).toBe("https://nprep.in/");
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer user-token");
  });
});
