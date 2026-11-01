import { describe, expect, it } from "vitest";
import { catalogEntities, filterSectionLectures, lectureRows, sectionGroups, dailyStats } from "./catalog";

describe("NPrep hierarchy", () => {
  const lecture = { id: 31, name: "Respiratory diagnostics", time: 100, watch_time: 90, is_free: true };
  it("keeps batches courses and subjects distinct even when their IDs overlap", () => {
    const data = { batches: [{ id: 1, name: "Gold Batch", courses: [{ id: 1, name: "Nursing", subjects: [{ id: 1, name: "Anatomy" }] }] }] };
    expect(catalogEntities(data, "batch").map((x) => x.name)).toEqual(["Gold Batch"]);
    expect(catalogEntities(data, "course").map((x) => x.name)).toEqual(["Nursing"]);
    expect(catalogEntities(data, "subject").map((x) => x.name)).toEqual(["Anatomy"]);
  });
  it("loads sibling and nested playable sections without rendering faculty as lectures", () => {
    const data = { data: { sections: [{ id: 2, name: "Part one", sections: [{ id: 3, name: "Basics", videos: [lecture], faculty: [{ id: 9, name: "Teacher" }] }] }, { id: 4, name: "Part two", videos: [{ id: 32, name: "SK text", sk_text: "Notes" }] }] } };
    expect(sectionGroups(data).map((x) => x.id)).toEqual([3, 4]);
    expect(lectureRows(data.data.sections[0].sections[0])).toEqual([lecture]);
  });
  it("keeps lectures visible when their section name matches the search", () => {
    expect(filterSectionLectures({ name: "Clinical nursing", videos: [lecture] }, "clinical", "all").videos).toEqual([lecture]);
    expect(filterSectionLectures({ name: "Clinical nursing", videos: [lecture] }, "cardiology", "all").videos).toEqual([]);
  });
  it("filters completed lectures at the existing 90 percent threshold", () => {
    expect(filterSectionLectures({ videos: [lecture, { ...lecture, id: 32, watch_time: 89 }] }, "", "completed").videos.map((x) => x.id)).toEqual([31]);
  });
  it("never invents daily statistics", () => {
    expect(dailyStats({})).toEqual([]);
    expect(dailyStats({ daily_stats: { questions_solved: 12 } })).toEqual([{ label: "questions solved", value: "12" }]);
  });
});