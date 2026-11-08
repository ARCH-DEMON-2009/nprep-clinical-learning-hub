import { afterEach, describe, expect, it, vi } from "vitest";
import { api, firstArray, findKey, idOf, isExpiredSessionResponse, titleOf, unwrap } from "./api";
import { getConnectionStatus } from "./connection-status";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); });

describe("API client", () => {
  it("reports safe upstream diagnostics and clears them after a successful request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("private response must not enter diagnostics", { status: 500, headers: { "x-nprep-response-source": "upstream" } })));
    await expect(api("/home")).rejects.toMatchObject({ status: 500 });
    expect(getConnectionStatus()).toEqual({ kind: "upstream", status: 500, checkedAt: expect.any(Number), retrying: false });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true }, { headers: { "x-nprep-response-source": "upstream" } })));
    await api("/home");
    expect(getConnectionStatus().kind).toBe("connected");
  });
  it.each(["<html>Cloudflare server down</html>", JSON.stringify({ message: "unhelpful upstream error" })])("handles 521 without exposing upstream text", async (body) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(body, { status: 521 }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = expect(api("/home")).rejects.toMatchObject({ status: 521, retryable: true });
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it.each([521, 502, 503, 504])("retries %s twice at 1000ms intervals with complete stream payload and authorization (mocked only)", async (status) => {
    vi.useFakeTimers();
    localStorage.setItem("nprep_token", "fixture-only");
    const payload = '{"phone_number":"9000000000","otp":"000000"}';
    const calls: { body: string; auth: string | null }[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      calls.push({ body: await new Response(init.body).text(), auth: new Headers(init.headers).get("authorization") });
      return calls.length < 3 ? new Response("down", { status }) : Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const pending = api("/auth/login", { method: "POST", body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(payload)); controller.close(); } }) });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(calls).toEqual(Array.from({ length: 3 }, () => ({ body: payload, auth: "Bearer fixture-only" })));
  });
  it.each([502, 503, 504])("stops after three persistent %s responses", async (status) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response("<html>down</html>", { status }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = expect(api("/home")).rejects.toMatchObject({ status, retryable: true });
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("shows an actionable OTP rejection without exposing raw Forbidden", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "NPrep rejected the OTP request (Forbidden)." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/auth/request-otp", { method: "POST", body: "{}" })).rejects.toThrow("NPrep is currently rejecting OTP requests");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("api helpers", () => {
  it("treats authenticated 401 and 403 responses as expired sessions", () => {
    expect(isExpiredSessionResponse(401, "token")).toBe(true);
    expect(isExpiredSessionResponse(403, "token")).toBe(false);
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
