import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ErrorBox, Loading, PageTitle, RawData } from "@/components/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { api, findArrays, firstArray, titleOf } from "@/lib/api";

export const Route = createFileRoute("/tests")({
  head: () => ({
    meta: [
      { title: "Tests & PYQ — NPrep" },
      { name: "description", content: "Test series and previous year questions." },
      { property: "og:title", content: "Tests & PYQ — NPrep" },
      { property: "og:description", content: "Test series and previous year questions." },
    ],
  }),
  component: Tests,
});

function Tests() {
  const q = useQuery({ queryKey: ["tests"], queryFn: () => api("/test") });
  const sections = firstArray(q.data);
  return (
    <div>
      <PageTitle title="Tests & PYQ" />
      {q.isLoading && <Loading />}
      {q.error && <ErrorBox error={q.error} />}
      {sections.map((s, i) => {
        const exams = findArrays(s)[0]?.items ?? [];
        return (
          <section key={i} className="mb-8">
            <h2 className="mb-3 font-display text-xl font-semibold">{titleOf(s)}</h2>
            {exams.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {exams.map((e, j) => (
                  <ItemCard key={j} item={e}>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {(e.total_questions ?? e.questions_count) != null && <span>{e.total_questions ?? e.questions_count} Qs</span>}
                      {e.duration != null && <span>· {e.duration} min</span>}
                    </div>
                  </ItemCard>
                ))}
              </div>
            ) : <ItemCard item={s} />}
          </section>
        );
      })}
      {q.data && <RawData data={q.data} />}
    </div>
  );
}
