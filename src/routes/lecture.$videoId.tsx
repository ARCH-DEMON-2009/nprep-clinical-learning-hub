import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ErrorBox, Loading, RawData } from "@/components/AppShell";
import { api, findArrays, findKey, imageOf, titleOf, unwrap } from "@/lib/api";

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

function allStrings(o: any, out: string[] = [], d = 0): string[] {
  if (!o || d > 5) return out;
  if (typeof o === "string") out.push(o);
  else if (typeof o === "object") Object.values(o).forEach((v) => allStrings(v, out, d + 1));
  return out;
}

function toSeconds(v: any): number {
  if (typeof v === "number") return v;
  const parts = String(v).split(":").map(Number);
  return parts.reduce((a, p) => a * 60 + (p || 0), 0);
}

function Lecture() {
  const { videoId } = Route.useParams();
  const q = useQuery({ queryKey: ["video", videoId], queryFn: () => api(`/video?videoId=${videoId}`) });
  const data = unwrap(q.data);
  const v = Array.isArray(data) ? data[0] : data;
  const strings = allStrings(v).filter((s) => /^https?:\/\//.test(s));
  const src = strings.find((s) => /\.(m3u8|mp4|webm)(\?|$)/i.test(s));
  const embed = !src ? strings.find((s) => /youtube|youtu\.be|vimeo|player\./i.test(s)) : undefined;
  const pdfs = [...new Set(strings.filter((s) => /\.pdf(\?|$)/i.test(s)))];
  const chapters = findArrays(v).find((a) => a.items.some((x) => Object.keys(x).some((k) => /time|start|second/i.test(k))))?.items ?? [];
  const educator = v?.educator ?? v?.faculty ?? v?.teacher ?? v?.instructor;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pdf, setPdf] = useState<string>();

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    if (!src.includes(".m3u8") || el.canPlayType("application/vnd.apple.mpegurl")) { el.src = src; return; }
    let hls: any;
    import("hls.js").then(({ default: Hls }) => {
      if (Hls.isSupported()) { hls = new Hls(); hls.loadSource(src); hls.attachMedia(el); }
    });
    return () => hls?.destroy();
  }, [src]);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  const seek = (c: any) => {
    const t = findKey(c, /time|start|second/i);
    if (videoRef.current && t != null) { videoRef.current.currentTime = toSeconds(t); videoRef.current.play(); }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-5">
        <div className="aspect-video overflow-hidden rounded-xl bg-foreground">
          {src ? <video ref={videoRef} controls playsInline poster={imageOf(v)} className="h-full w-full" />
            : embed ? <iframe src={embed} className="h-full w-full" allow="autoplay; fullscreen" allowFullScreen title="Lecture" />
            : <div className="flex h-full items-center justify-center text-background">Video not available</div>}
        </div>
        <h1 className="font-display text-2xl font-bold">{titleOf(v)}</h1>
        {educator && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            {imageOf(educator) && <img src={imageOf(educator)} alt="" className="h-12 w-12 rounded-full object-cover" />}
            <div>
              <div className="font-semibold">{typeof educator === "string" ? educator : titleOf(educator)}</div>
              {educator?.designation && <div className="text-sm text-muted-foreground">{educator.designation}</div>}
            </div>
          </div>
        )}
        {pdfs.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {pdfs.map((p, i) => (
                <button key={p} onClick={() => setPdf(pdf === p ? undefined : p)}
                  className={`rounded-lg border px-3 py-2 text-sm ${pdf === p ? "border-primary bg-accent" : "border-border"}`}>📄 Notes {pdfs.length > 1 ? i + 1 : ""}</button>
              ))}
            </div>
            {pdf && <iframe src={pdf} title="Lecture notes" className="h-[75vh] w-full rounded-xl border border-border" />}
          </div>
        )}
        <RawData data={q.data} />
      </div>
      <aside className="h-fit rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">Chapters</h2>
        {chapters.length === 0 && <p className="text-sm text-muted-foreground">No chapters for this lecture.</p>}
        <ul className="space-y-1">
          {chapters.map((c, i) => (
            <li key={i}>
              <button onClick={() => seek(c)} className="flex w-full gap-3 rounded-lg p-2 text-left text-sm hover:bg-accent">
                <span className="font-mono text-primary">{String(findKey(c, /time|start|second/i) ?? "")}</span>
                <span>{titleOf(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
