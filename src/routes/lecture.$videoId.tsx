import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, ExternalLink, FileText, Maximize, RotateCcw, RotateCw, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ErrorBox, Loading, RawData } from "@/components/AppShell";
import { api, findArrays, findKey, imageOf, titleOf, unwrap } from "@/lib/api";
import { lectureData, lectureMedia, playbackMessage } from "@/lib/lecture";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/lecture/$videoId")({
  head: () => ({
    meta: [
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
  const { src: mediaSrc, license, notes, text } = lectureMedia(v);
  const embed = mediaSrc && /youtube\.com|youtu\.be|vimeo\.com/i.test(mediaSrc) ? mediaSrc : undefined;
  const src = embed ? undefined : mediaSrc;

  const stamps: any[] = Array.isArray(v?.stamps) ? v.stamps
    : findArrays(v).find((a) => a.items.some((x) => Object.keys(x).some((k) => /time|start|second/i.test(k))))?.items ?? [];

  const nextId = v?.next_video_id != null ? String(v.next_video_id) : undefined;
  const educator = v?.educator ?? v?.faculty ?? v?.teacher ?? v?.instructor;

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
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
    async function attach() {
      try {
        if (/\.(mp4|webm)(?:[?#]|$)/i.test(src ?? "") && !license) {
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
          if (!cancelled) setPlaybackError(playbackMessage(event.detail));
        });
        await player.attach(el);
        if (cancelled) return;
        if (license) player.configure({ drm: { servers: { "com.widevine.alpha": license } } });
        await player.load(src);
      } catch (error) {
        if (!cancelled) setPlaybackError(playbackMessage(error));
      }
    }
    void attach();
    return () => {
      cancelled = true;
      el.removeEventListener("error", onError);
      void player?.destroy();
      playerRef.current = null;
      el.pause(); el.removeAttribute("src"); el.load();
    };
  }, [src, license, attempt]);

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
              <button onClick={() => skip(-10)} aria-label="Rewind 10 seconds"
                className="flex items-center gap-1 rounded-lg bg-background/10 px-3 py-1.5 text-sm text-background hover:bg-background/20">
                <RotateCcw className="h-4 w-4" /> 10s
              </button>
              <button onClick={() => skip(10)} aria-label="Forward 10 seconds"
                className="flex items-center gap-1 rounded-lg bg-background/10 px-3 py-1.5 text-sm text-background hover:bg-background/20">
                10s <RotateCw className="h-4 w-4" />
              </button>
              <button onClick={changeSpeed} aria-label="Playback speed"
                className="rounded-lg bg-background/10 px-3 py-1.5 text-sm font-medium text-background hover:bg-background/20">
                {speed}x
              </button>
              <span className="ml-auto font-mono text-sm text-background/80">
                {fmtTime(time)} / {fmtTime(duration)}
              </span>
              <button onClick={fullscreen} aria-label="Full screen"
                className="rounded-lg bg-background/10 p-1.5 text-background hover:bg-background/20">
                <Maximize className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {playbackError && <div role="alert" className="space-y-3 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{playbackError}</p>
          <Button variant="outline" onClick={async () => { await q.refetch(); setAttempt((n) => n + 1); }}>Retry playback</Button>
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
          <button onClick={() => setTab("chapters")}
            className={`flex-1 px-4 py-3 transition ${tab === "chapters" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
            Chapters {stamps.length > 0 && `(${stamps.length})`}
          </button>
          <button onClick={() => setTab("notes")}
            className={`flex-1 px-4 py-3 transition ${tab === "notes" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
            Notes {notes.length > 0 && `(${notes.length})`}
          </button>
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
                    <button onClick={() => seek(c)}
                      className={`flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-accent ${active ? "bg-accent" : ""}`}>
                      <span className="font-mono text-primary">{secs != null ? fmtTime(secs) : ""}</span>
                      <span className="flex-1">{titleOf(c)}</span>
                      {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </button>
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
                  <button onClick={() => setPdf(pdf === p ? undefined : p)}
                    className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${pdf === p ? "border-primary bg-accent" : "border-border"}`}>
                    <FileText className="h-4 w-4 text-primary" /> Notes {notes.length > 1 ? i + 1 : ""}
                  </button>
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
