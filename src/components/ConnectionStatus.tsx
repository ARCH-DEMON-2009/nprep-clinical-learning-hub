import { useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp, CircleCheck, Wifi, WifiOff } from "lucide-react";
import { Button } from "./ui/button";
import { getConnectionStatus, getServerConnectionStatus, subscribeConnectionStatus, type ConnectionKind } from "@/lib/connection-status";

const descriptions: Record<ConnectionKind, { title: string; detail: string }> = {
  unchecked: { title: "Connection not checked", detail: "No NPrep API request has completed in this visit." },
  connected: { title: "NPrep reachable", detail: "The last API request reached the service. Video availability is checked separately by the player." },
  upstream: { title: "NPrep service unavailable", detail: "The site reached NPrep, but its service returned a server error. Try the affected action again shortly." },
  cloudflare: { title: "Cloudflare connection error", detail: "Cloudflare could not complete the connection. This code alone does not identify which server failed. Try again shortly." },
  deployment: { title: "Site connection error", detail: "The site's request handler could not complete the request. This does not confirm an NPrep outage." },
  unknown: { title: "Connection error — source unclear", detail: "The response does not identify the failing service. Try again; if it persists, the site connection needs checking." },
  network: { title: "Network connection interrupted", detail: "No server response arrived. Check your internet connection and try the affected action again." },
  access: { title: "NPrep reachable — access required", detail: "NPrep responded but did not allow this request. Check your sign-in or subscription; this is not an outage." },
};

export function ConnectionStatusPanel() {
  const state = useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus, getServerConnectionStatus);
  const [expanded, setExpanded] = useState(false);
  const copy = descriptions[state.kind];
  const healthy = state.kind === "connected" || state.kind === "access";
  const Icon = healthy ? CircleCheck : state.kind === "unchecked" ? Wifi : WifiOff;
  return (
    <section aria-label="Connection status" className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-foreground">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p role="status" className="min-w-0 flex-1">{copy.title}{state.retrying ? " · Retrying…" : ""}</p>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={expanded ? "Hide connection details" : "Show connection details"} aria-expanded={expanded} aria-controls="connection-details" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </div>
      {expanded && <div id="connection-details" className="mx-auto mt-1 max-w-screen-2xl space-y-1 pb-1 text-muted-foreground">
        <p>{copy.detail}</p>
        <p>Last API response{state.status ? `: HTTP ${state.status}` : ": none"}{state.checkedAt ? ` · ${new Date(state.checkedAt).toLocaleTimeString()}` : ""}</p>
      </div>}
    </section>
  );
}