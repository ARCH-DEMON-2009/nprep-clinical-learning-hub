import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, ExternalLink, FileText, Maximize, RotateCcw, RotateCw, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ErrorBox, Loading } from "@/components/AppShell";
import { api, findArrays, findKey, getToken, imageOf, titleOf } from "@/lib/api";
import { drmKeySystem, ensureDrmLicenseContentType, lectureData, lectureMedia, lectureMediaDiagnostics, playbackMessage } from "@/lib/lecture";
import { mediaProxyUrl, normalizeCloudFrontSignedUrl } from "@/lib/media-proxy";

/** CloudFront only reads Policy/Signature/Key-Pair-Id in the query string. */
function signedDirectUrl(url: string): string {
  try { return normalizeCloudFrontSignedUrl(new URL(url)).toString(); } catch { return url; }
}
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/lecture/$videoId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Lecture — NPrep" },
      { name: "description", content: "Watch the lecture with chapters and notes." },
      { property: "og:title", content: "Lecture — NPrep" },
      { property: "og:description", content: "Watch the lecture with chapters and notes." },
    ],
  }),
  component: Lecture,
});

function toSeconds(v: any): number {
  if (typeof v === "number") return v;
  const parts = String(v).split(":").map(Number);
  return parts.reduce((a, p) => a * 60 + (p || 0), 0);
}

const fmtTime = (secs: number) => {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

function Lecture() {
  const { videoId } = Route.useParams();
  const q = useQuery({ queryKey: ["video", videoId], queryFn: () => api(`/video?videoId=${videoId}`) });
  const v = lectureData(q.data);
  const { src: mediaSrc, license, drmType, notes, text } = lectureMedia(v);
  const embed = mediaSrc && /youtube\.com|youtu\.be|vimeo\.com/i.test(mediaSrc) ? mediaSrc : undefined;
  // Play straight from the CDN first: NPrep's CloudFront is geo-restricted, so the
  // viewer's own (Indian) connection works where an overseas server proxy gets 403.
  const [viaProxy, setViaProxy] = useState(false);
  const src = embed || !mediaSrc ? undefined : viaProxy ? mediaProxyUrl(mediaSrc) : signedDirectUrl(mediaSrc);

  const stamps: any[] = Array.isArray(v?.stamps) ? v.stamps
    : findArrays(v).find((a) => a.items.some((x) => Object.keys(x).some((k) => /time|start|second/i.test(k))))?.items ?? [];

  const nextId = v?.next_video_id != null ? String(v.next_video_id) : undefined;
  const educator = v?.educator ?? v?.faculty ?? v?.teacher ?? v?.instructor;

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const refreshedVideoRef = useRef<string | null>(null);
  const [tab, setTab] = useState<"chapters" | "notes">("chapters");
  const [pdf, setPdf] = useState<string>();
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [safeText, setSafeText] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSafeText("");
    if (text) import("dompurify").then(({ default: DOMPurify }) => {
      if (!cancelled) setSafeText(DOMPurify.sanitize(text));
    });
    return () => { cancelled = true; };
  }, [text]);

  // Configure DRM before loading; all browser-only player imports stay in effects.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    let cancelled = false;
    let player: any;
    setPlaybackError(""); setTime(0); setDuration(0); setSpeed(1);
    const onError = () => setPlaybackError("The browser could not play this video. Try again to refresh the lecture link.");
    el.addEventListener("error", onError);
    const attach = async () => {
      try {
        const token = getToken();
        if (token) {
          const session = await fetch("/api/media/session", {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
          });
          if (!session.ok) throw new Error("Could not authorize lecture playback");
        }
        if (cancelled) return;
        if (/\.(mp4|webm)(?:[?#]|$)/i.test(mediaSrc ?? "") && !license) {
          el.src = src ?? "";
          el.load();
          return;
        }
        const imported = await import("shaka-player");
        if (cancelled) return;
        const shaka = imported.default;
        shaka.polyfill.installAll();
        if (!shaka.Player.isBrowserSupported()) throw new Error("Unsupported browser");
        player = new shaka.Player();
        playerRef.current = player;
        player.addEventListener("error", (event: any) => {
          if (cancelled) return;
          const error = event.detail;
          const details = Array.isArray(error?.data) ? error.data : [];
          const status = Number.isInteger(details[1]) ? details[1] : undefined;
          if ([401, 403].includes(status) && refreshedVideoRef.current !== videoId) {
            refreshedVideoRef.current = videoId;
            void q.refetch().then((result) => {
              if (cancelled || !result.data) return;
              const refreshedSrc = lectureMedia(lectureData(result.data)).src;
              if (refreshedSrc && refreshedSrc !== mediaSrc) setAttempt((value) => value + 1);
            });
          }
          if (!viaProxy && error?.code === 1002) {
            setViaProxy(true);
            return;
          }
          setPlaybackError(playbackMessage(error, license, drmType));
        });
        await player.attach(el);
        if (cancelled) return;
        if (!viaProxy) {
          // Segments are requested without the manifest's signature; copy it onto every same-host request.
          const signed = new URL(src ?? "", window.location.href);
          const signing = [...signed.searchParams].filter(([k]) => /^(Policy|Signature|Key-Pair-Id|Expires)$/.test(k));
          player.getNetworkingEngine()?.registerRequestFilter((_type: unknown, request: any) => {
            request.uris = request.uris.map((uri: string) => {
              try {
                const u = new URL(uri, signed);
                if (u.host !== signed.host) return uri;
                for (const [k, val] of signing) if (!u.searchParams.has(k)) u.searchParams.set(k, val);
                return u.toString();
              } catch { return uri; }
            });
          });
        }
        player.getNetworkingEngine()?.registerRequestFilter((type: number, request: any) => {
          const licenseRequest = shaka.net.NetworkingEngine.RequestType.LICENSE;
          if (type === licenseRequest) {
            request.headers = ensureDrmLicenseContentType(request.headers ?? {});
          }
        });
        // The license server allows browser requests from any site, so it never needs the relay.
        if (license) player.configure({ drm: { servers: { [drmKeySystem(drmType)]: license } } });
        await player.load(src);
      } catch (error: any) {
        if (cancelled) return;
        if (!viaProxy && error?.code === 1002) { setViaProxy(true); return; }
        setPlaybackError(playbackMessage(error, license, drmType));
      }
    };
    void attach();
    return () => {
      cancelled = true;
      el.removeEventListener("error", onError);
      void player?.destroy();
      playerRef.current = null;
      el.pause(); el.removeAttribute("src"); el.load();
    };
  }, [src, license, attempt, viaProxy]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => setTime(el.currentTime);
    const onDur = () => setDuration(el.duration);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("durationchange", onDur);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("durationchange", onDur);
    };
  }, [src]);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  const seek = (c: any) => {
    const t = findKey(c, /time|start|second/i);
    if (videoRef.current && t != null) {
      videoRef.current.currentTime = toSeconds(t);
      void videoRef.current.play().catch(() => setPlaybackError("Press Play to continue from this chapter."));
    }
  };
  const skip = (delta: number) => {
    const el = videoRef.current;
    if (el) el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + delta));
  };
  const changeSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };
  const fullscreen = () => {
    const el = videoRef.current;
    if (el?.requestFullscreen) el.requestFullscreen();
    else (el as any)?.webkitEnterFullscreen?.();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-5">
        <div className="overflow-hidden rounded-xl bg-foreground">
          <div className={text && !src && !embed ? "p-6 text-background" : "aspect-video"}>
            {src ? <video ref={videoRef} controls playsInline poster={imageOf(v)} className="h-full w-full" />
              : embed ? <iframe src={embed} className="h-full w-full" allow="autoplay; fullscreen" allowFullScreen title="Lecture" />
              : text ? <article className="space-y-3 break-words" dangerouslySetInnerHTML={{ __html: safeText }} />
              : <div className="flex h-full items-center justify-center text-background">Video not available</div>}
          </div>
          {src && (
            <div className="flex flex-wrap items-center gap-2 border-t border-background/20 p-3">
              <Button variant="ghost" onClick={() => skip(-10)} aria-label="Rewind 10 seconds"
                className="flex items-center gap-1 rounded-lg bg-background/10 px-3 py-1.5 text-sm text-background hover:bg-background/20">
                <RotateCcw className="h-4 w-4" /> 10s
              </Button>
              <Button variant="ghost" onClick={() => skip(10)} aria-label="Forward 10 seconds"
                className="flex items-center gap-1 rounded-lg bg-background/10 px-3 py-1.5 text-sm text-background hover:bg-background/20">
                10s <RotateCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={changeSpeed} aria-label="Playback speed"
                className="rounded-lg bg-background/10 px-3 py-1.5 text-sm font-medium text-background hover:bg-background/20">
                {speed}x
              </Button>
              <span className="ml-auto font-mono text-sm text-background/80">
                {fmtTime(time)} / {fmtTime(duration)}
              </span>
              <Button variant="ghost" onClick={fullscreen} aria-label="Full screen"
                className="rounded-lg bg-background/10 p-1.5 text-background hover:bg-background/20">
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {playbackError && <div role="alert" className="space-y-3 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{playbackError}</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-foreground/80">
            <li><b>HTTP 403 / blocked country:</b> NPrep's video service only serves India. Use an Indian connection (turn off VPN) and retry.</li>
            <li><b>DRM / license errors (6xxx):</b> enable protected content in browser settings; Chrome, Edge or Firefox work best. Incognito may block it.</li>
            <li><b>Network errors (1xxx):</b> the lecture link may have expired — press Retry to fetch a fresh one.</li>
          </ul>
          <p className="text-xs text-foreground/70">Mode: {viaProxy ? "via server" : "direct from CDN"}</p>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium">Playback diagnostics (redacted)</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono">{lectureMediaDiagnostics(q.data, mediaSrc, license, drmType)}</pre>
          </details>
          <Button variant="outline" onClick={async () => { await q.refetch(); setViaProxy(false); setAttempt((n) => n + 1); }}>Retry playback</Button>
          {!viaProxy && <Button variant="ghost" className="ml-2" onClick={() => setViaProxy(true)}>Try via server</Button>}
        </div>}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-2xl font-bold">{titleOf(v)}</h1>
          {nextId && (
            <Link to="/lecture/$videoId" params={{ videoId: nextId }}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Next lecture <SkipForward className="h-4 w-4" />
            </Link>
          )}
        </div>

        {educator && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            {imageOf(educator) && <img src={imageOf(educator)} alt="" className="h-12 w-12 rounded-full object-cover" />}
            <div>
              <div className="font-semibold">{typeof educator === "string" ? educator : titleOf(educator)}</div>
              {educator?.designation && <div className="text-sm text-muted-foreground">{educator.designation}</div>}
            </div>
          </div>
        )}

      </div>

      <aside className="h-fit overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex border-b border-border text-sm font-medium">
          <Button variant="ghost" onClick={() => setTab("chapters")}
            className={`flex-1 px-4 py-3 transition ${tab === "chapters" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
            Chapters {stamps.length > 0 && `(${stamps.length})`}
          </Button>
          <Button variant="ghost" onClick={() => setTab("notes")}
            className={`flex-1 px-4 py-3 transition ${tab === "notes" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
            Notes {notes.length > 0 && `(${notes.length})`}
          </Button>
        </div>

        {tab === "chapters" && (
          <div className="p-3">
            {stamps.length === 0 && <p className="p-2 text-sm text-muted-foreground">No chapters for this lecture.</p>}
            <ul className="space-y-1">
              {stamps.map((c, i) => {
                const t = findKey(c, /time|start|second/i);
                const secs = t != null ? toSeconds(t) : null;
                const active = secs != null && time >= secs && (i === stamps.length - 1 || time < toSeconds(findKey(stamps[i + 1], /time|start|second/i)));
                return (
                  <li key={i}>
                    <Button variant="ghost" onClick={() => seek(c)}
                      className={`flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-accent ${active ? "bg-accent" : ""}`}>
                      <span className="font-mono text-primary">{secs != null ? fmtTime(secs) : ""}</span>
                      <span className="flex-1">{titleOf(c)}</span>
                      {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {tab === "notes" && (
          <div className="space-y-3 p-3">
            {notes.length === 0 && <p className="p-2 text-sm text-muted-foreground">No notes for this lecture.</p>}
            {notes.map((p, i) => (
              <div key={p} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setPdf(pdf === p ? undefined : p)}
                    className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${pdf === p ? "border-primary bg-accent" : "border-border"}`}>
                    <FileText className="h-4 w-4 text-primary" /> Notes {notes.length > 1 ? i + 1 : ""}
                  </Button>
                  <a href={p} download target="_blank" rel="noreferrer" aria-label="Download notes"
                    className="rounded-lg border border-border p-2 hover:bg-accent"><Download className="h-4 w-4" /></a>
                  <a href={p} target="_blank" rel="noreferrer" aria-label="Open notes in new tab"
                    className="rounded-lg border border-border p-2 hover:bg-accent"><ExternalLink className="h-4 w-4" /></a>
                </div>
                {pdf === p && <iframe src={p} title="Lecture notes" className="h-[70vh] w-full rounded-lg border border-border" />}
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
