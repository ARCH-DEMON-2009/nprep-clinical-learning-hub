import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeMediaTarget } from "./media-proxy";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}));

import { Route } from "../routes/api/media.$";

const route = Route as unknown as {
  server: { handlers: Record<"GET" | "POST", (context: { request: Request; params: { _splat: string } }) => Promise<Response>> };
};

afterEach(() => vi.unstubAllGlobals());

describe("media relay credential boundaries (mocked network only)", () => {
  it("keeps binary license challenges and NPrep bearer authorization intact", async () => {
    let captured: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: URL, init: RequestInit) => { captured = init; return new Response(new Uint8Array([4, 5])); }));
    const response = await route.server.handlers.POST({ request: new Request("https://nprep.site/api/media/relay/x", { method: "POST", headers: { authorization: "Bearer fixture-only", "content-type": "application/octet-stream" }, body: new Uint8Array([1, 2, 3]) }), params: { _splat: `relay/${encodeMediaTarget("https://api.nprep.in/license")}` } });
    expect(response.status).toBe(200);
    expect(new Headers(captured?.headers).get("authorization")).toBe("Bearer fixture-only");
    expect(new Headers(captured?.headers).get("content-type")).toBe("application/octet-stream");
    expect(new Headers(captured?.headers).get("origin")).toBeNull();
    expect([...new Uint8Array(captured?.body as ArrayBuffer)]).toEqual([1, 2, 3]);
  });
  it("does not leak the app bearer to TPStreams licenses", async () => {
    const headers: Headers[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: URL, init: RequestInit) => { headers.push(new Headers(init.headers)); return new Response("license"); }));
    await route.server.handlers.POST({ request: new Request("https://nprep.site/api/media/relay/x", { method: "POST", headers: { authorization: "Bearer fixture-only", "content-type": "application/octet-stream" }, body: new Uint8Array([1]) }), params: { _splat: `relay/${encodeMediaTarget("https://app.tpstreams.com/license?token=service-token")}` } });
    expect(headers[0]?.get("authorization")).toBeNull();
    expect(headers[0]?.get("content-type")).toBe("application/octet-stream");
  });
  const context = (target: string) => ({
    request: new Request("https://beta.nprep.site/api/media/relay/x/", {
      headers: {
        authorization: "Bearer fixture-only",
        cookie: "CloudFront-Policy=fixture; CloudFront-Signature=fixture; CloudFront-Key-Pair-Id=fixture; unrelated=private",
      },
    }),
    params: { _splat: `relay/${encodeMediaTarget(target)}` },
  });

  it("rejects an untrusted redirect even when NPrep supplied it", async () => {
    const seen: Headers[] = [];
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      seen.push(new Headers(init.headers));
      return new Response(null, {
        status: 302, headers: { location: "https://untrusted.example/video.mpd" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await route.server.handlers.GET(context("https://links.nprep.in/video"));
    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(seen[0]?.get("authorization")).toBe("Bearer fixture-only");
    expect(seen[0]?.get("cookie")).not.toContain("unrelated");
  });

  it("keeps signed CDN credentials but strips the user bearer on a trusted CDN redirect", async () => {
    const seen: { url: string; headers: Headers }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: URL, init: RequestInit) => {
      seen.push({ url: url.toString(), headers: new Headers(init.headers) });
      return seen.length === 1
        ? new Response(null, { status: 302, headers: { location: "https://dsj0ye61xl4q1.cloudfront.net/video.mp4?Policy=fixture&Signature=fixture&Key-Pair-Id=fixture" } })
        : new Response("video", { headers: { "content-type": "video/mp4" } });
    }));
    const response = await route.server.handlers.GET(context("https://links.nprep.in/video"));
    expect(response.status).toBe(200);
    expect(seen).toHaveLength(2);
    expect(seen[0]?.headers.get("authorization")).toBe("Bearer fixture-only");
    expect(seen[1]?.headers.get("authorization")).toBeNull();
    expect(seen[1]?.headers.get("cookie")).toBe("CloudFront-Policy=fixture; CloudFront-Signature=fixture; CloudFront-Key-Pair-Id=fixture");
    expect(new URL(seen[1]?.url ?? "https://invalid.example").searchParams.get("Signature")).toBe("fixture");
  });
});