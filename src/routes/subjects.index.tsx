import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ErrorBox, Loading, PageTitle } from "@/components/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { api, firstArray, idOf } from "@/lib/api";
import { RawData } from "@/components/AppShell";

export const Route = createFileRoute("/subjects/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Subjects & Lectures — NPrep" },
      { name: "description", content: "Browse all NPrep subjects and video lectures." },
      { property: "og:title", content: "Subjects & Lectures — NPrep" },
      { property: "og:description", content: "Browse all NPrep subjects and video lectures." },
    ],
  }),
  component: Subjects,
});

function Subjects() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["subjects"], queryFn: () => api("/video/subjects") });
  const items = firstArray(q.data);
  return (
    <div>
      <PageTitle title="Subjects" sub={items.length ? `${items.length} subjects` : undefined} />
      {q.isLoading && <Loading />}
      {q.error && <ErrorBox error={q.error} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((s, i) => (
          <ItemCard key={i} item={s} onClick={() => { const id = idOf(s); if (id) nav({ to: "/subjects/$subjectId", params: { subjectId: id } }); }} />
        ))}
      </div>
      {!q.isLoading && items.length < 3 && <RawData data={q.data} />}
    </div>
  );
}
