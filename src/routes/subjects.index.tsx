import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ErrorBox, Loading, PageTitle, useMe } from "@/components/AppShell";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import { Button } from "@/components/ui/button";
import { catalogEntities, uniqueEntities } from "@/lib/catalog";
import { api } from "@/lib/api";

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
  const q = useQuery({ queryKey: ["subjects"], queryFn: () => api("/video/subjects") });
  const home = useQuery({ queryKey: ["home"], queryFn: () => api("/home") });
  const me = useMe();
  const subjects = catalogEntities(q.data, "subject", true);
  const batches = uniqueEntities([...catalogEntities(home.data, "batch"), ...catalogEntities(me.data, "batch"), ...catalogEntities(q.data, "batch")]);
  return <div>
    <PageTitle title="Courses & Lectures" sub={subjects.length ? `${subjects.length} subjects` : undefined} />
    {q.isLoading && <Loading />}
    {q.error && <><ErrorBox error={q.error} /><Button variant="outline" onClick={() => q.refetch()}>Try again</Button></>}
    {!q.isLoading && !q.error && !subjects.length && !batches.length && <p className="text-muted-foreground">No subjects available.</p>}
    <CatalogBrowser batches={batches} subjects={subjects} />
  </div>;
}
