import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Assessment } from "@/components/Assessment";
import { Button } from "@/components/ui/button";
import { Loading, PageTitle } from "@/components/AppShell";
import { api, firstArray, imageOf, questionCount, titleOf } from "@/lib/api";

export const Route = createFileRoute("/tests")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Tests & PYQ — NPrep" },
      { name: "description", content: "Test series and previous year questions." },
      { property: "og:title", content: "Tests & PYQ — NPrep" },
      { property: "og:description", content: "Test series and previous year questions." },
    ],
  }),
  component: Tests,
});

function Tests() {
  const q = useQuery({ queryKey: ["tests"], queryFn: () => api("/test"), retry: 1 });
  const root = q.data?.data ?? q.data;
  const sections: any[] = Array.isArray(root?.sections) ? root.sections : firstArray(q.data);
  const examCount = root?.selected_exam_count;
  const [selected, setSelected] = useState<any>();

  return (
    <div>
      <PageTitle title="Tests & PYQ"
        sub={examCount != null ? `${examCount} exams selected` : "Test series and previous year questions."} />
      {q.isLoading && <Loading />}
      {q.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Couldn't load tests."}</p>
          <button onClick={() => q.refetch()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      )}
      {!q.isLoading && !q.error && sections.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No tests available yet.
        </div>
      )}
      {sections.map((s, i) => {
        const tests: any[] = Array.isArray(s?.all_tests) ? s.all_tests : [];
        const label = s?.label ?? titleOf(s);
        return (
          <section key={i} className="mb-10">
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="font-display text-xl font-semibold">{label}</h2>
              {s?.your_exams != null && <span className="text-sm text-muted-foreground">{s.your_exams} of your exams</span>}
              {tests.length > 0 && <span className="text-sm text-muted-foreground">· {tests.length} tests</span>}
            </div>
            {tests.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No tests in this section yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tests.map((t, j) => {
                  const total = questionCount(t);
                  const done = t?.completed_count ?? 0;
                  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
                  return (
                    <Button variant="outline" key={t?.id ?? j} onClick={() => setSelected(t)}
                      className="group block h-auto whitespace-normal p-0 overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      {imageOf(t) && <img src={imageOf(t)} alt="" className="aspect-video w-full bg-muted object-cover" loading="lazy" />}
                      <div className="p-4">
                        <div className="font-semibold leading-snug group-hover:text-primary">{titleOf(t)}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {questionCount(t) != null && <span>{questionCount(t)} questions</span>}
                          {t?.total_count != null && <span>· {t.total_count} exams</span>}
                        </div>
                        {total != null && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{done} completed</span><span>{pct}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {selected && <Assessment item={selected} kind="test" onClose={() => setSelected(undefined)} />}

    </div>
  );
}
