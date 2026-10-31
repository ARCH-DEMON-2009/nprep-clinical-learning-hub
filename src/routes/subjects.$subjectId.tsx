import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Clock, Lock, PlayCircle, Search, Unlock } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorBox, Loading, PageTitle } from "@/components/AppShell";
import { api, contentArrays, findArrays, firstArray, idOf, imageOf, titleOf } from "@/lib/api";

export const Route = createFileRoute("/subjects/$subjectId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Courses — NPrep" },
      { name: "description", content: "Courses, sections and lectures for this subject." },
      { property: "og:title", content: "Courses — NPrep" },
      { property: "og:description", content: "Courses, sections and lectures for this subject." },
    ],
  }),
  component: Courses,
});

const fmt = (secs: any): string | undefined => {
  const n = Number(secs);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const isDone = (v: any): boolean => {
  const wt = Number(v?.watch_time);
  const t = Number(v?.time);
  if (v?.is_completed || v?.completed) return true;
  return Number.isFinite(wt) && Number.isFinite(t) && t > 0 && wt >= t * 0.9;
};

function Courses() {
  const { subjectId } = Route.useParams();
  const q = useQuery({ queryKey: ["courses", subjectId], queryFn: () => api(`/video/courses?subjectId=${subjectId}`) });
  const courses = firstArray(q.data);
  const [active, setActive] = useState<string>();
  const current = active ?? idOf(courses[0]);
  const currentCourse = courses.find((c) => idOf(c) === current);

  return (
    <div>
      <Link to="/subjects" className="text-sm text-muted-foreground hover:text-foreground">← All subjects</Link>
      <div className="mt-2"><PageTitle title="Courses" sub={courses.length ? `${courses.length} courses in this subject` : undefined} /></div>
      {q.isLoading && <Loading />}
      {q.error && <ErrorBox error={q.error} />}
      {!q.isLoading && !q.error && courses.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">No courses available for this subject.</p>}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {courses.map((c, i) => {
            const id = idOf(c);
            const faculty = c?.faculty ?? c?.educator ?? c?.teacher ?? c?.instructor_name;
            return (
              <button key={i} onClick={() => setActive(id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${id === current ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}>
                {imageOf(c) && <img src={imageOf(c)} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{titleOf(c)}</span>
                  {faculty && <span className="block truncate text-xs text-muted-foreground">{typeof faculty === "string" ? faculty : titleOf(faculty)}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {current && <Sections key={current} courseId={current} course={currentCourse} />}
      </div>
    </div>
  );
}

function Sections({ courseId, course }: { courseId: string; course?: any }) {
  const q = useQuery({ queryKey: ["sections", courseId], queryFn: () => api(`/video/sections?courseId=${courseId}`) });
  const sections = firstArray(q.data);
  const [open, setOpen] = useState<number | null>(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "completed">("all");

  const faculty = course?.faculty ?? course?.educator ?? course?.teacher ?? course?.instructor_name;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sections
      .map((s: any) => {
        const knownVideos = Object.entries(s ?? {}).flatMap(([key, value]) =>
          /videos?|lectures?|contents?|items/i.test(key) && Array.isArray(value)
            ? value.filter((item) => item && typeof item === "object")
            : []);
        const nestedVideos = contentArrays(s)
          .filter(({ key }) => /videos?|lectures?|contents?|items/i.test(key))
          .flatMap(({ items }) => items);
        const fallbackVideos = findArrays(s).flatMap((collection) => collection.items);
        const seenVideos = new Map<string, any>();
        for (const video of [...knownVideos, ...nestedVideos, ...fallbackVideos]) {
          const key = idOf(video) ?? `${titleOf(video)}-${String(Object.values(video).join("|"))}`;
          if (!seenVideos.has(key)) seenVideos.set(key, video);
        }
        const videos: any[] = [...seenVideos.values()];
        const kept = videos.filter((v) => {
          if (term && !String(titleOf(v)).toLowerCase().includes(term)) return false;
          if (filter === "free" && !v?.is_free) return false;
          if (filter === "completed" && !isDone(v)) return false;
          return true;
        });
        return { s, videos: kept, total: videos.length };
      })
      .filter(({ s, videos, total }) => {
        if (!term && filter === "all") return true;
        if (term && String(titleOf(s)).toLowerCase().includes(term)) return true;
        return videos.length > 0 || (total > 0 && !term && filter === "all");
      });
  }, [sections, search, filter]);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="min-w-0">
      {faculty && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          {imageOf(faculty) && <img src={imageOf(faculty)} alt="" className="h-11 w-11 rounded-full object-cover" />}
          <div>
            <div className="text-sm text-muted-foreground">Faculty</div>
            <div className="font-semibold">{typeof faculty === "string" ? faculty : titleOf(faculty)}</div>
          </div>
        </div>
      )}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sections or lectures…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1 text-sm">
          {(["all", "free", "completed"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 capitalize transition ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      {!sections.length && <p className="text-muted-foreground">No sections yet.</p>}
      {sections.length > 0 && filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">Nothing matches your search.</p>
      )}
      <div className="space-y-3">
        {filtered.map(({ s, videos, total }, i) => {
          const done = videos.filter(isDone).length;
          const openIdx = open === i;
          return (
            <div key={idOf(s) ?? i} className="overflow-hidden rounded-xl border border-border bg-card">
              <button onClick={() => setOpen(openIdx ? null : i)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                <span className="font-semibold">{titleOf(s)}</span>
                <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                  {done > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{done} done</span>}
                  {total > 0 && `${videos.length}${videos.length !== total ? `/${total}` : ""} lectures`}
                  <ChevronDown className={`h-4 w-4 transition ${openIdx ? "rotate-180" : ""}`} />
                </span>
              </button>
              {openIdx && (
                <ul className="divide-y divide-border border-t border-border">
                  {videos.length === 0 && <li className="p-4 text-sm text-muted-foreground">No lectures match.</li>}
                  {videos.map((v, j) => {
                    const id = idOf(v);
                    const free = v?.is_free;
                    const locked = !free && (v?.is_locked ?? v?.locked);
                    const dur = fmt(v?.time ?? v?.duration);
                    const watched = fmt(v?.watch_time);
                    const completed = isDone(v);
                    return (
                      <li key={id ?? j}>
                        {id ? (
                          <Link to="/lecture/$videoId" params={{ videoId: id }} className="flex items-center gap-3 p-4 hover:bg-accent">
                            {locked ? <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                              : completed ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                              : <PlayCircle className="h-5 w-5 shrink-0 text-primary" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{titleOf(v)}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {free ? <span className="inline-flex items-center gap-1 text-primary"><Unlock className="h-3 w-3" /> Free</span> : null}
                                {watched && !completed && <span>Watched {watched}</span>}
                              </span>
                            </span>
                            {dur && <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />{dur}</span>}
                          </Link>
                        ) : <div className="p-4">{titleOf(v)}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
