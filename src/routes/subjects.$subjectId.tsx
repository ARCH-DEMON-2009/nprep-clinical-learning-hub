import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, PlayCircle, Lock } from "lucide-react";
import { useState } from "react";
import { ErrorBox, Loading, PageTitle } from "@/components/AppShell";
import { api, findArrays, firstArray, idOf, imageOf, titleOf } from "@/lib/api";

export const Route = createFileRoute("/subjects/$subjectId")({
  head: () => ({
    meta: [
      { title: "Courses — NPrep" },
      { name: "description", content: "Courses, sections and lectures for this subject." },
      { property: "og:title", content: "Courses — NPrep" },
      { property: "og:description", content: "Courses, sections and lectures for this subject." },
    ],
  }),
  component: Courses,
});

function Courses() {
  const { subjectId } = Route.useParams();
  const q = useQuery({ queryKey: ["courses", subjectId], queryFn: () => api(`/video/courses?subjectId=${subjectId}`) });
  const courses = firstArray(q.data);
  const [active, setActive] = useState<string>();
  const current = active ?? idOf(courses[0]);
  return (
    <div>
      <Link to="/subjects" className="text-sm text-muted-foreground hover:text-foreground">← All subjects</Link>
      <div className="mt-2"><PageTitle title="Courses" /></div>
      {q.isLoading && <Loading />}
      {q.error && <ErrorBox error={q.error} />}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {courses.map((c, i) => {
            const id = idOf(c);
            return (
              <button key={i} onClick={() => setActive(id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${id === current ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}>
                {imageOf(c) && <img src={imageOf(c)} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <span className="font-medium">{titleOf(c)}</span>
              </button>
            );
          })}
        </div>
        {current && <Sections courseId={current} />}
      </div>
    </div>
  );
}

function Sections({ courseId }: { courseId: string }) {
  const q = useQuery({ queryKey: ["sections", courseId], queryFn: () => api(`/video/sections?courseId=${courseId}`) });
  const sections = firstArray(q.data);
  const [open, setOpen] = useState<number | null>(0);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!sections.length) return <p className="text-muted-foreground">No sections yet.</p>;
  return (
    <div className="space-y-3">
      {sections.map((s, i) => {
        const videos = findArrays(s)[0]?.items ?? [];
        return (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between p-4 text-left">
              <span className="font-semibold">{titleOf(s)}</span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {videos.length > 0 && `${videos.length} lectures`}
                <ChevronDown className={`h-4 w-4 transition ${open === i ? "rotate-180" : ""}`} />
              </span>
            </button>
            {open === i && (
              <ul className="divide-y divide-border border-t border-border">
                {videos.length === 0 && idOf(s) && (
                  <li><Link to="/lecture/$videoId" params={{ videoId: idOf(s)! }} className="flex items-center gap-3 p-4 hover:bg-accent"><PlayCircle className="h-5 w-5 text-primary" /> Open</Link></li>
                )}
                {videos.map((v, j) => {
                  const id = idOf(v);
                  const locked = v?.is_locked ?? v?.locked;
                  return (
                    <li key={j}>
                      {id ? (
                        <Link to="/lecture/$videoId" params={{ videoId: id }} className="flex items-center gap-3 p-4 hover:bg-accent">
                          {locked ? <Lock className="h-5 w-5 text-muted-foreground" /> : <PlayCircle className="h-5 w-5 text-primary" />}
                          <span className="flex-1">{titleOf(v)}</span>
                          {v?.duration && <span className="text-sm text-muted-foreground">{String(v.duration)}</span>}
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
  );
}
