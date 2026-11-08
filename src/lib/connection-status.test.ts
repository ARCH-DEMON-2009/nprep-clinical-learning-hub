import { describe, expect, it } from "vitest";
import { classifyConnection, getConnectionStatus, reportConnection } from "./connection-status";

describe("privacy-safe connection classification", () => {
  it("distinguishes confirmed upstream failure from relay failure at the same HTTP code", () => {
    expect(classifyConnection(503, "upstream")).toBe("upstream");
    expect(classifyConnection(503, "relay")).toBe("deployment");
    expect(classifyConnection(503, null)).toBe("unknown");
    expect(classifyConnection(503, "untrusted-value")).toBe("unknown");
  });
  it("identifies Cloudflare 521 without claiming the failed server is known", () => {
    expect(classifyConnection(521, "upstream")).toBe("cloudflare");
    expect(classifyConnection(521, null)).toBe("cloudflare");
  });
  it("does not mistake authentication refusal or an upstream missing resource for an outage", () => {
    expect(classifyConnection(401, "upstream")).toBe("access");
    expect(classifyConnection(403, "upstream")).toBe("access");
    expect(classifyConnection(404, "upstream")).toBe("connected");
    expect(classifyConnection(404, null)).toBe("deployment");
  });
  it("retains only category, code, time and retry state and recovers on success", () => {
    reportConnection("cloudflare", 521, true);
    expect(getConnectionStatus()).toEqual({ kind: "cloudflare", status: 521, checkedAt: expect.any(Number), retrying: true });
    reportConnection(classifyConnection(200, "upstream"), 200);
    expect(getConnectionStatus()).toEqual({ kind: "connected", status: 200, checkedAt: expect.any(Number), retrying: false });
  });
});