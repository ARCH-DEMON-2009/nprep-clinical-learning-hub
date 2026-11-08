export type ConnectionKind = "unchecked" | "connected" | "upstream" | "cloudflare" | "deployment" | "unknown" | "network" | "access";
export type ConnectionStatus = { kind: ConnectionKind; status?: number; checkedAt?: number; retrying?: boolean };

export function classifyConnection(status: number, source: string | null): ConnectionKind {
  if (status >= 520 && status <= 527) return "cloudflare";
  if (status === 401 || status === 403) return "access";
  if (status >= 500) return source === "upstream" ? "upstream" : source === "relay" ? "deployment" : "unknown";
  if ((status === 404 || status === 405) && source !== "upstream") return "deployment";
  return source === "upstream" || (status >= 200 && status < 300) ? "connected" : "unknown";
}

// Only an allowlisted category, HTTP code and timestamp enter this ephemeral store.
// Never store URLs, bodies, response messages, headers, tokens or identifiers.
let snapshot: ConnectionStatus = { kind: "unchecked" };
const listeners = new Set<() => void>();
const initial: ConnectionStatus = { kind: "unchecked" };
export const getConnectionStatus = () => snapshot;
export const getServerConnectionStatus = () => initial;
export function subscribeConnectionStatus(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function reportConnection(kind: ConnectionKind, status?: number, retrying = false) {
  snapshot = { kind, ...(status === undefined ? {} : { status }), checkedAt: Date.now(), retrying };
  listeners.forEach((listener) => listener());
}