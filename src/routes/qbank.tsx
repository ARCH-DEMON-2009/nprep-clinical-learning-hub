import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Loading, PageTitle } from "@/components/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { Assessment } from "@/components/Assessment";
import { Button } from "@/components/ui/button";
import { api, firstArray, questionCount, titleOf } from "@/lib/api";

export const Route = createFileRoute("/qbank")({
  head: () => ({
    meta: [
      { title: "QBank — NPrep" },
      { name: "description", content: "Practice questions by subject." },
      { property: "og:title", content: "QBank — NPrep" },
      { property: "og:description", content: "Practice questions by subject." },
    ],
  }),
  component: QBank,
});

function QBank() {
  const q = useQuery({ queryKey: ["qbank"], queryFn: () => api("/qbank/subjects"), retry: 1 });
  const subjects = firstArray(q.data);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return subjects;
    return subjects.filter((s: any) => String(titleOf(s)).toLowerCase().includes(term));
  }, [subjects, search]);

  return (
    <div>
      <PageTitle title="QBank" sub={subjects.length ? `${subjects.length} subjects to practice` : "Practice questions subject by subject."} />
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subjects…"
          className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>
      {q.isLoading && <Loading />}
      {q.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Couldn't load the QBank."}</p>
          <button onClick={() => q.refetch()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      )}
      {!q.isLoading && !q.error && subjects.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">QBank isn't available yet.</div>
      )}
      {!q.isLoading && !q.error && subjects.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">No subjects match “{search}”.</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s: any, i: number) => {
          const total = questionCount(s);
          const done = s?.completed_count ?? s?.attempted_count ?? s?.solved_count;
          const pct = total && done != null ? Math.min(100, Math.round((done / total) * 100)) : null;
          return (
            <ItemCard key={s?.id ?? i} item={s} onClick={() => setSelected(s)}>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {total != null && <span>{total} questions</span>}
                {done != null && <span>· {done} practiced</span>}
              </div>
              {pct != null && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{pct}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
              <Button className="mt-4 w-full" onClick={() => setSelected(s)}>Open practice</Button>
            </ItemCard>
          );
        })}
      </div>
      {selected && <Assessment item={selected} kind="qbank" onClose={() => setSelected(undefined)} />}
    </div>
  );
}
