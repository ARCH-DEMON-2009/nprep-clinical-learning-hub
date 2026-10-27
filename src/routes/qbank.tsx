import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loading, PageTitle } from "@/components/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { api, firstArray } from "@/lib/api";

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
  const q = useQuery({ queryKey: ["qbank"], queryFn: () => api("/qbank"), retry: false });
  const items = firstArray(q.data);
  return (
    <div>
      <PageTitle title="QBank" sub="Practice questions subject by subject." />
      {q.isLoading && <Loading />}
      {(q.error || (!q.isLoading && !items.length)) && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">QBank isn't available yet.</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((it, i) => <ItemCard key={i} item={it} />)}</div>
    </div>
  );
}
