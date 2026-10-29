import { describe, expect, it } from "vitest";
import { lectureData, lectureMedia } from "./lecture";

describe("lecture response normalization", () => {
  it("opens a nested video envelope", () => {
    expect(lectureData({ data: { video: { id: 118 } } }).id).toBe(118);
  });
  it("finds extensionless playback URLs and nested DRM licenses", () => {
    expect(lectureMedia({ video_url: "https://media.example/play/118", drm: { license_url: "https://license.example/118" } })).toMatchObject({ src: "https://media.example/play/118", license: "https://license.example/118" });
  });
  it("does not double-decode signed licenses", () => {
    const license = "https://license.example/?token=a%2Fb";
    expect(lectureMedia({ url: `https://media.example/118.mpd?license_url=${encodeURIComponent(license)}` }).license).toBe(license);
  });
  it("keeps notes and text separate from playback", () => {
    expect(lectureMedia({ notes: "https://notes.example/download/118", sk_text: "Read this lecture" })).toEqual({ src: undefined, license: undefined, notes: ["https://notes.example/download/118"], text: "Read this lecture" });
  });
});