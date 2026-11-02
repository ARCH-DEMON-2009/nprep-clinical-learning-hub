import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Assessment } from "@/components/Assessment";
import { Button } from "@/components/ui/button";
import { Loading, PageTitle } from "@/components/AppShell";
import { api, firstArray, idOf, imageOf, questionCount, titleOf, unwrap } from "@/lib/api";
import { testListPath } from "@/lib/assessment";

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
  const root = unwrap(q.data);
  const sections: any[] = Array.isArray(root?.sections) ? root.sections : firstArray(q.data);
  const examCount = root?.selected_exam_count;
  const [selected, setSelected] = useState<any>();
  const [selectedModule, setSelectedModule] = useState<any>();
  const [category, setCategory] = useState("all");
  const modules: any[] = (() => {
    const found: any[] = [];
    const visit = (value: any, depth = 0) => {
      if (!value || typeof value !== "object" || depth > 5) return;
      if (Array.isArray(value)) { value.forEach((child) => visit(child, depth + 1)); return; }
      for (const key of ["modules", "test_modules", "categories"]) {
        if (Array.isArray(value[key])) found.push(...value[key]);
      }
      Object.values(value).forEach((child) => visit(child, depth + 1));
    };
    visit(q.data);
    return found.filter((module, index) => found.findIndex((candidate) => idOf(candidate) === idOf(module)) === index);
  })();
  const moduleId = String(selectedModule?.id ?? selectedModule?.module_id ?? selectedModule?.moduleId ?? "");
  const moduleType = String(selectedModule?.type ?? selectedModule?.test_type ?? "PYQ");
  const moduleTestsQuery = useQuery({
    queryKey: ["test-list", moduleType, moduleId],
    queryFn: () => api(testListPath(moduleType, moduleId)),
    enabled: Boolean(moduleId),
    retry: 1,
  });

  return (
    <div>
      <PageTitle title="Tests & PYQ"
        sub={examCount != null ? `${examCount} exams selected` : "Test series and previous year questions."} />
      {selectedModule && <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" onClick={() => setSelectedModule(undefined)}>All test modules</Button>
        <span className="font-semibold">{titleOf(selectedModule)}</span>
      </div>}
      {!selectedModule && modules.length > 0 && <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module, index) => <Button key={idOf(module) ?? index} variant="outline" className="h-auto justify-between whitespace-normal p-4 text-left"
          onClick={() => setSelectedModule({ ...module, type: module.type ?? module.test_type ?? moduleType })}>
          <span>{titleOf(module)}{questionCount(module) != null && <span className="mt-1 block text-xs text-muted-foreground">{questionCount(module)} questions</span>}</span>
        </Button>)}
      </div>}
      {sections.length > 0 && !selectedModule && modules.length === 0 && <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Test category">
        <Button variant={category === "all" ? "default" : "outline"} aria-pressed={category === "all"} onClick={() => setCategory("all")}>All tests</Button>
        {sections.map((section, i) => <Button key={i} variant={category === String(i) ? "default" : "outline"} aria-pressed={category === String(i)} onClick={() => setCategory(String(i))}>{section.label ?? titleOf(section)}</Button>)}
      </div>}
      {q.isLoading && <Loading />}
      {q.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Couldn't load tests."}</p>
          <Button onClick={() => q.refetch()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      )}
      {!q.isLoading && !q.error && sections.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No tests available yet.
        </div>
      )}
      {selectedModule && (moduleTestsQuery.isLoading ? <Loading /> : moduleTestsQuery.error ? <p className="text-sm text-destructive">Could not load this module's tests.</p> : (() => {
        const moduleTests = firstArray(moduleTestsQuery.data);
        return moduleTests.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moduleTests.map((test, index) => <Button key={idOf(test) ?? index} variant="outline" className="h-auto justify-between whitespace-normal p-4 text-left"
            onClick={() => setSelected({ ...test, type: moduleType, module_id: moduleId })}>
            <span>{titleOf(test)}{questionCount(test) != null && <span className="mt-1 block text-xs text-muted-foreground">{questionCount(test)} questions</span>}</span>
          </Button>)}
        </div> : <p className="text-sm text-muted-foreground">No tests available in this module.</p>;
      })())}
      {!selectedModule && sections.map((s, i) => {
        if (category !== "all" && category !== String(i)) return null;
        const tests: any[] = Array.isArray(s?.all_tests) ? s.all_tests : [];
        const label = s?.label ?? titleOf(s);
        return (
          <section key={i} className="mb-10">
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="font-display text-xl font-semibold">{label}</h2>
              {s?.your_exams != null && <span className="text-sm text-muted-foreground">{Array.isArray(s.your_exams) ? s.your_exams.length : typeof s.your_exams === "number" ? s.your_exams : ""} of your exams</span>}
              {tests.length > 0 && <span className="text-sm text-muted-foreground">· {tests.length} tests</span>}
            </div>
            {tests.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No tests in this section yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tests.map((t, j) => {
                  const total = questionCount(t);
                  const done = t?.completed_count ?? 0;
                  const examTotal = Number(t?.total_count);
                  const pct = examTotal > 0 ? Math.min(100, Math.round((done / examTotal) * 100)) : 0;
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
                        {examTotal > 0 && (
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
