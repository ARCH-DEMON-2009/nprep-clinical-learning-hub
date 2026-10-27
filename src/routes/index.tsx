import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ErrorBox, Loading, PageTitle, RawData, useMe } from "@/components/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { api, findArrays, findKey, imageOf, label, unwrap } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — NPrep" },
      { name: "description", content: "Your NPrep learning dashboard." },
      { property: "og:title", content: "Dashboard — NPrep" },
      { property: "og:description", content: "Your NPrep learning dashboard." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const me = useMe();
  const q = useQuery({ queryKey: ["home"], queryFn: () => api("/home") });
  const name = findKey(me.data, /^(name|full_?name|first_?name)$/i);
  const groups = findArrays(unwrap(q.data));
  const banners = groups.find((g) => /banner|slider|carousel/i.test(g.name));
  const rest = groups.filter((g) => g !== banners);

  return (
    <div>
      <PageTitle title={`Hello${name ? `, ${String(name).split(" ")[0]}` : ""} 👋`} sub="Pick up where you left off." />
      {q.isLoading && <Loading />}
      {q.error && <ErrorBox error={q.error} />}
      {banners && (
        <div className="-mx-1 mb-8 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
          {banners.items.map((b, i) => {
            const img = imageOf(b);
            return img ? <img key={i} src={img} alt="" className="h-40 w-[85%] shrink-0 snap-start rounded-xl object-cover sm:h-52 sm:w-[48%]" /> : null;
          })}
        </div>
      )}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {([["Subjects & Lectures", "/subjects"], ["Tests & PYQ", "/tests"], ["QBank", "/qbank"]] as const).map(([t, to]) => (
          <Link key={to} to={to} className="rounded-xl border border-border bg-accent p-5 font-semibold text-accent-foreground hover:border-primary">{t} →</Link>
        ))}
      </div>
      {rest.map((g) => (
        <section key={g.name} className="mb-8">
          <h2 className="mb-3 font-display text-xl font-semibold">{label(g.name)}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {g.items.slice(0, 12).map((it, i) => <ItemCard key={i} item={it} />)}
          </div>
        </section>
      ))}
      {q.data && <RawData data={q.data} />}
    </div>
  );
}
