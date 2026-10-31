import { describe, expect, it } from "vitest";
import { drmKeySystem, ensureDrmLicenseContentType, lectureData, lectureMedia, lectureMediaDiagnostics, playbackMessage } from "./lecture";
import { cloudFrontCookieHeader, cloudFrontCredentialSummary, decodeMediaTarget, embeddedMediaRedirect, encodeMediaTarget, ensureMediaPostContentType, isAllowedMediaHost, isNprepLinkResolverUrl, isNprepSiteHost, localMediaCookies, localMediaCookiesFromPayload, mediaProxyUrl, normalizeCloudFrontSignedUrl, nprepSiteOrigin, rewriteMediaManifest } from "./media-proxy";

describe("lecture response normalization", () => {
  it("opens a nested video envelope", () => {
    expect(lectureData({ data: { video: { id: 118 } } }).id).toBe(118);
  });
  it("finds extensionless playback URLs and nested DRM licenses", () => {
    expect(lectureMedia({ video_url: "https://media.example/play/118", drm: { license_url: "https://license.example/118" } })).toMatchObject({ src: "https://media.example/play/118", license: "https://license.example/118" });
  });
  it("reads drm_type from the signed media URL and selects its key system", () => {
    const media = lectureMedia({ url: "https://media.example/video.mpd?drm_type=playready&license_url=https%3A%2F%2Flicense.example%2Fdrm" });
    expect(media.drmType).toBe("playready");
    expect(media.license).toBe("https://license.example/drm");
    expect(drmKeySystem(media.drmType)).toBe("com.microsoft.playready");
    expect(drmKeySystem("widevine")).toBe("com.widevine.alpha");
    expect(drmKeySystem("fairplay")).toBe("com.apple.fps.1_0");
  });
  it("extracts embedded NPrep resolver destinations", () => {
    expect(embeddedMediaRedirect(`<meta http-equiv="refresh" content="0; url=https://cdn.example/video.mpd?a=1&amp;b=2">`)).toBe("https://cdn.example/video.mpd?a=1&b=2");
    expect(embeddedMediaRedirect(`window.location.href = "https://cdn.example/video.m3u8";`)).toBe("https://cdn.example/video.m3u8");
  });
  it("allows NPrep link hosts and TPStreams license hosts", () => {
    expect(isAllowedMediaHost("links.nprep.in")).toBe(true);
    expect(isNprepLinkResolverUrl("https://links.nprep.in/lecture/118")).toBe(true);
    expect(isAllowedMediaHost("app.tpstreams.com")).toBe(true);
    expect(isAllowedMediaHost("tpstreams.com")).toBe(true);
    expect(isAllowedMediaHost("app.tpstreams.com.attacker.example")).toBe(false);
  });
  it("recognizes beta.nprep.site and uses it as the safe local proxy origin", () => {
    expect(isNprepSiteHost("beta.nprep.site")).toBe(true);
    expect(isAllowedMediaHost("beta.nprep.site")).toBe(true);
    expect(nprepSiteOrigin("https://beta.nprep.site/api/media/relay/x")).toBe("https://beta.nprep.site");
    expect(nprepSiteOrigin("http://localhost:8080/api/media/relay/x")).toBe("https://beta.nprep.site");
    expect(nprepSiteOrigin("http://localhost:8080", "https://app.nprep.in")).toBe("https://app.nprep.in");
  });
  it("sets the binary content type for DRM POSTs without overriding explicit types", () => {
    expect(ensureMediaPostContentType(new Headers()).get("content-type")).toBe("application/octet-stream");
    expect(ensureMediaPostContentType(new Headers({ "content-type": "application/json" })).get("content-type")).toBe("application/json");
    expect(ensureDrmLicenseContentType({})).toEqual({ "content-type": "application/octet-stream" });
    expect(ensureDrmLicenseContentType({ "Content-Type": "application/json" })).toEqual({ "Content-Type": "application/json" });
  });
  it("gives an actionable error for Widevine initialization failure", () => {
    expect(playbackMessage({ code: 6001 }, undefined, "widevine")).toContain("initialize Widevine");
  });
  it("uses resolver HTML as an actionable playback error", () => {
    expect(playbackMessage({ code: 1001, data: ["/api/media/relay/x", 502, "Lecture link resolver did not return a media URL"] })).toContain("resolver did not return a media URL");
  });
  it("explains the Shaka 4036 region error", () => {
    expect(playbackMessage({ code: 4036 })).toContain("outside India");
  });
  it("explains DRM license HTTP failures", () => {
    const message = playbackMessage({ code: 6007, data: ["License request failed", 403, "AccessDenied"] }, "https://license.example/path", "widevine");
    expect(message).toContain("HTTP 403");
    expect(message).toContain("from license.example");
    expect(message).toContain("DRM widevine");
  });
  it("prefers a signed playback URL over an unsigned manifest", () => {
    expect(lectureMedia({
      manifest_url: "https://d123.cloudfront.net/unsigned/video.mpd",
      video_url: "https://d123.cloudfront.net/signed/video.mpd?Policy=p&Signature=s&Key-Pair-Id=k",
    }).src).toBe("https://d123.cloudfront.net/signed/video.mpd?Policy=p&Signature=s&Key-Pair-Id=k");
  });
  it("converts CloudFront cookie-style URL keys to signed URL parameter names", () => {
    const signed = normalizeCloudFrontSignedUrl(new URL("https://d123.cloudfront.net/video.mpd?CloudFront-Policy=p&CloudFront-Signature=s&CloudFront-Key-Pair-Id=k"));
    expect(signed.searchParams.get("Policy")).toBe("p");
    expect(signed.searchParams.get("Signature")).toBe("s");
    expect(signed.searchParams.get("Key-Pair-Id")).toBe("k");
    expect([...signed.searchParams.keys()]).not.toContain("CloudFront-Key-Pair-Id");
  });
  it("preserves percent-encoded CloudFront signature bytes while renaming query keys", () => {
    const signed = normalizeCloudFrontSignedUrl(new URL("https://d123.cloudfront.net/video.mpd?CloudFront-Policy=eyJTdGF0ZW1lbnQiOiJ4In0%3D&CloudFront-Signature=ab%2Bcd%2Fef%3D%7E&CloudFront-Key-Pair-Id=K123"));
    expect(signed.search).toBe("?Policy=eyJTdGF0ZW1lbnQiOiJ4In0%3D&Signature=ab%2Bcd%2Fef%3D%7E&Key-Pair-Id=K123");
  });
  it("reports lecture credential field names without exposing signed values", () => {
    const diagnostics = lectureMediaDiagnostics({ video: {
      video_url: "https://cdn.example/video.mpd?Policy=secret-policy&Key-Pair-Id=secret-id",
      signedCookies: { policy: "secret-policy", keyPairId: "secret-id" },
    } }, "https://cdn.example/video.mpd?Policy=secret-policy&Key-Pair-Id=secret-id", "https://license.example/license?token=secret", "widevine");
    expect(diagnostics).toContain("Selected media host: cdn.example");
    expect(diagnostics).toContain("query keys: Policy, Key-Pair-Id");
    expect(diagnostics).toContain("signedCookies");
    expect(diagnostics).toContain("DRM type: widevine; License host: license.example");
    expect(diagnostics).not.toContain("secret-policy");
    expect(diagnostics).not.toContain("secret-id");
  });
  it("does not double-decode signed licenses", () => {
    const license = "https://license.example/?token=a%2Fb";
    expect(lectureMedia({ url: `https://media.example/118.mpd?license_url=${encodeURIComponent(license)}` }).license).toBe(license);
  });
  it("keeps notes and text separate from playback", () => {
    expect(lectureMedia({ notes: "https://notes.example/download/118", sk_text: "Read this lecture" })).toEqual({ src: undefined, license: undefined, notes: ["https://notes.example/download/118"], text: "Read this lecture" });
  });
  it("rewrites HLS segment and key references through the media relay", () => {
    const manifest = "#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\"\nsegment.ts\n";
    const rewritten = rewriteMediaManifest(manifest, "https://cdn.nprep.in/lesson/master.m3u8", "application/vnd.apple.mpegurl");
    expect(rewritten).toContain(`URI="${mediaProxyUrl("https://cdn.nprep.in/lesson/key.bin")}"`);
    expect(rewritten).toContain(mediaProxyUrl("https://cdn.nprep.in/lesson/segment.ts"));
  });
  it("rewrites DASH base URLs and segment templates", () => {
    const manifest = '<MPD><BaseURL>https://cdn.nprep.in/lesson/</BaseURL><SegmentTemplate media="part-$Number$.m4s" /></MPD>';
    const rewritten = rewriteMediaManifest(manifest, "https://cdn.nprep.in/lesson/video.mpd", "application/dash+xml");
    expect(rewritten).toContain(mediaProxyUrl("https://cdn.nprep.in/lesson/"));
    expect(rewritten).toContain(mediaProxyUrl("https://cdn.nprep.in/lesson/part-$Number$.m4s"));
  });
  it("keeps DASH variables expandable in proxied segment URLs", () => {
    const target = "https://cdn.nprep.in/lesson/part-$Number$.m4s?token=abc";
    const template = encodeMediaTarget(target);
    expect(template).toContain("v$Number$");
    expect(decodeMediaTarget(template)).toBe(target);
    expect(decodeMediaTarget(template.replace("v$Number$", "v42"))).toBe("https://cdn.nprep.in/lesson/part-42.m4s?token=abc");
  });
  it("scopes CloudFront signed cookies to the local media proxy", () => {
    const headers = new Headers();
    headers.append("set-cookie", "CloudFront-Policy=policy; Domain=.cloudfront.net; Path=/; Secure");
    headers.append("set-cookie", "CloudFront-Signature=sig; Path=/");
    headers.append("set-cookie", "CloudFront-Key-Pair-Id=key-id; Path=/");
    headers.append("set-cookie", "session=secret; Path=/");
    const localCookies = localMediaCookies(headers, true);
    expect(localCookies).toHaveLength(3);
    expect(localCookies[0]).toContain("Path=/api/media");
    expect(localCookies[0]).toContain("HttpOnly");
    expect(localCookies[0]).not.toContain("Domain=");
    expect(cloudFrontCookieHeader(`nprep_media_token=app; ${localCookies.map((cookie) => cookie.split(";")[0]).join("; ")}`)).toBe("CloudFront-Policy=policy; CloudFront-Signature=sig; CloudFront-Key-Pair-Id=key-id");
  });
  it("extracts complete CloudFront credentials from a nested API payload", () => {
    const cookies = localMediaCookiesFromPayload({ data: { signedCookies: { policy: "policy", signature: "sig", keyPairId: "key-id" } } }, false);
    expect(cookies.map((cookie) => cookie.split(";")[0])).toEqual([
      "CloudFront-Policy=policy",
      "CloudFront-Signature=sig",
      "CloudFront-Key-Pair-Id=key-id",
    ]);
  });
  it("extracts top-level credential aliases and cookie strings", () => {
    const values = localMediaCookiesFromPayload({
      policy: "policy-value",
      signature: "signature-value",
      key_pair_id: "pair-id",
      cookie: "CloudFront-Policy=header-policy; CloudFront-Signature=header-signature; CloudFront-Key-Pair-Id=header-id",
    }, false);
    expect(values.map((cookie) => cookie.split(";")[0])).toEqual([
      "CloudFront-Policy=header-policy",
      "CloudFront-Signature=header-signature",
      "CloudFront-Key-Pair-Id=header-id",
    ]);
  });
  it("reports only CloudFront credential presence, never values", () => {
    const summary = cloudFrontCredentialSummary(
      new URL("https://cdn.example/video.mpd?CloudFront-Key-Pair-Id=secret"),
      ["CloudFront-Policy", "CloudFront-Key-Pair-Id"],
    );
    expect(summary).toContain("Key-Pair-Id query=yes");
    expect(summary).toContain("Key-Pair-Id cookie=yes");
    expect(summary).not.toContain("secret");
  });
  it("preserves signed query parameters for relative media segments", () => {
    const rewritten = rewriteMediaManifest("segment.ts", "https://cdn.nprep.in/lesson/master.m3u8?token=abc", "application/vnd.apple.mpegurl");
    expect(rewritten).toContain(mediaProxyUrl("https://cdn.nprep.in/lesson/segment.ts?token=abc"));
  });
  it("reports the upstream HTTP status for rejected playback requests", () => {
    expect(playbackMessage({ code: 1001, data: ["https://media.example/video.mpd?token=secret", 403, "<Error>AccessDenied</Error>"] })).toContain("HTTP 403 from media.example: AccessDenied");
    expect(playbackMessage({ code: 1001, data: ["https://media.example/video.mpd?token=secret", 403, "Forbidden"] })).not.toContain("secret");
  });
  it("identifies a media host blocked by the local relay", () => {
    expect(playbackMessage({ code: 1001, data: ["/api/media/relay/url", 403, "Media host is not allowed"] })).toContain("proxy allowlist");
  });
});
describe("geo-blocked relay diagnostics", () => {
  it("names the relay region when it ran outside India", () => {
    const msg = playbackMessage({ code: 1001, data: ["https://beta.nprep.site/api/media/relay/x/", 403, "relay region: iad1. The Amazon CloudFront distribution is configured to block access from your country."] });
    expect(msg).toContain('"iad1"');
    expect(msg).toContain("bom1");
  });
  it("falls back to the VPN hint when the relay already runs in Mumbai", () => {
    const msg = playbackMessage({ code: 1001, data: ["https://x/", 403, "relay region: bom1. configured to block access from your country."] });
    expect(msg).toContain("Turn off any VPN");
  });
});
