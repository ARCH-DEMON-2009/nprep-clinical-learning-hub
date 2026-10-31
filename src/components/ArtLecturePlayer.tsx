import Artplayer from "artplayer";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ensureDrmLicenseContentType, playbackMessage } from "@/lib/lecture";

export type LecturePlayerHandle = {
  seek: (seconds: number) => void;
  getVideo: () => HTMLVideoElement | null;
};

type Props = {
  src: string;
  poster?: string;
  title?: string;
  drmType?: string;
  license?: string;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onError?: (message: string) => void;
};

const ArtLecturePlayer = forwardRef<LecturePlayerHandle, Props>(function ArtLecturePlayer(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Artplayer | null>(null);
  const shakaRef = useRef<any>(null);
  const hlsRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    seek: (seconds: number) => {
      if (playerRef.current?.video) playerRef.current.currentTime = Math.max(0, seconds);
    },
    getVideo: () => playerRef.current?.video ?? null,
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !props.src) return;
    let cancelled = false;

    void import("artplayer").then(async () => {
      let responseType = "";
      let responseSample = "";
      try {
        const response = await fetch(props.src, { headers: { range: "bytes=0-2047" } });
        responseType = response.headers.get("content-type") ?? "";
        responseSample = await response.text();
      } catch {}
      const lowerUrl = props.src.toLowerCase();
      const looksLikeHls = /mpegurl/i.test(responseType) || /#extm3u/i.test(responseSample);
      const looksLikeDash = /dash\+xml/i.test(responseType) || /<mpd[\s>]/i.test(responseSample);
      const isHls = looksLikeHls || lowerUrl.includes(".m3u8");
      const isDash = looksLikeDash || lowerUrl.includes(".mpd") || Boolean(props.license) || Boolean(props.drmType);
      const playerType = isHls ? "m3u8" : isDash ? "mpd" : "auto";

      const customType: Record<string, (video: HTMLVideoElement, url: string) => void | Promise<void>> = {};
      if (isHls) {
        customType.m3u8 = async (video, url) => {
          const { default: Hls } = await import("hls.js");
          if (!Hls.isSupported()) return;
          const hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
        };
      }
      if (isDash || props.license) {
        customType.mpd = async (video, url) => {
          const imported = await import("shaka-player");
          const shaka = imported.default;
          shaka.polyfill.installAll();
          const player = new shaka.Player();
          shakaRef.current = player;
          await player.attach(video);
          player.getNetworkingEngine()?.registerRequestFilter((type: number, request: any) => {
            if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
              request.headers = ensureDrmLicenseContentType(request.headers ?? {});
            }
            if (type !== shaka.net.NetworkingEngine.RequestType.LICENSE) {
              try {
                const target = new URL(url);
                const signed = [...target.searchParams].filter(([name]) => /^(Policy|Signature|Key-Pair-Id|Expires)$/i.test(name));
                request.uris = request.uris.map((uri: string) => {
                  const segment = new URL(uri, target);
                  if (segment.host !== target.host) return uri;
                  for (const [name, value] of signed) if (!segment.searchParams.has(name)) segment.searchParams.set(name, value);
                  return segment.toString();
                });
              } catch {}
            }
          });
          if (props.license) {
            const keySystem = props.drmType?.toLowerCase().includes("playready")
              ? "com.microsoft.playready"
              : props.drmType?.toLowerCase().includes("fairplay")
                ? "com.apple.fps.1_0"
                : "com.widevine.alpha";
            player.configure({ drm: { servers: { [keySystem]: props.license } } });
          }
          player.addEventListener("error", (event: any) => props.onError?.(playbackMessage(event.detail, props.license, props.drmType)));
          await player.load(url);
        };
      }

      if (cancelled) return;
      const player = new Artplayer({
        container,
        url: props.src,
        type: playerType,
        customType: playerType === "auto" ? undefined : customType,
        poster: props.poster,
        title: props.title,
        autoplay: false,
        muted: false,
        volume: 0.8,
        setting: true,
        playbackRate: true,
        aspectRatio: true,
        flip: false,
        playbackRateControl: true,
        fullscreen: true,
        fullscreenWeb: true,
        miniProgressBar: true,
        autoSize: false,
        pip: true,
        theme: "#8b5cf6",
        moreVideoAttr: { controlsList: "nodownload", playsInline: true },
        controls: [
          {
            name: "rewind10",
            position: "right",
            index: 15,
            html: "10",
            tooltip: "Rewind 10 seconds",
            click: () => { player.currentTime = Math.max(0, player.currentTime - 10); },
          },
          {
            name: "forward10",
            position: "right",
            index: 16,
            html: "10",
            tooltip: "Forward 10 seconds",
            click: () => { player.currentTime = Math.min(player.duration || Infinity, player.currentTime + 10); },
          },
        ],
      });
      playerRef.current = player;

      player.on("video:timeupdate", () => props.onTimeUpdate?.(player.currentTime));
      player.on("video:durationchange", () => props.onDurationChange?.(player.duration));
      player.on("video:waiting", () => player.notice.show = "Buffering…");
      player.on("video:playing", () => player.notice.show = "");
      player.on("video:error", () => props.onError?.("The lecture could not be played. Retry to refresh the source."));

      player.on("video:keydown", (event: KeyboardEvent) => {
        if (event.key === "ArrowLeft") player.currentTime = Math.max(0, player.currentTime - 10);
        if (event.key === "ArrowRight") player.currentTime = Math.min(player.duration || Infinity, player.currentTime + 10);
        if (event.key.toLowerCase() === "k") player.toggle();
      });

      if (hlsRef.current) {
        const hls = hlsRef.current;
        hls.on("hlsLevelLoaded", () => {
          const levels = hls.levels
            .filter((level: any, index: number, levels: any[]) => level.height && levels.findIndex((item: any) => item.height === level.height) === index)
            .sort((a: any, b: any) => b.height - a.height);
          player.settings.update([
            {
              html: "Quality",
              icon: "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M4 4h16v16H4z' opacity='.18'/><path fill='currentColor' d='M7 7h10v10H7zm2 2v6h6V9z'/></svg>",
              selector: [
                { default: hls.autoLevelEnabled, html: "Auto", value: -1 },
                ...levels.map((level: any) => ({ default: hls.currentLevel === level.id, html: `${level.height}p`, value: level.id })),
              ],
              onSelect(item: { value: number }) {
                hls.currentLevel = item.value;
                hls.autoLevelEnabled = item.value === -1;
                return item.html;
              },
            },
          ]);
        });
      }
    });

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      void shakaRef.current?.destroy();
      shakaRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [props.src, props.license, props.drmType, props.poster]);

  return <div ref={containerRef} className="nprep-art-player" />;
});

export default ArtLecturePlayer;
