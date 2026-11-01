import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ErrorBox, Loading, PageTitle, RawData, useMe } from "@/components/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { api, findArrays, findKey, imageOf, label, unwrap, idOf, titleOf } from "@/lib/api";
import { ArrowRight, BookOpen, ClipboardCheck, Library, PlayCircle, Activity } from "lucide-react";

import { CatalogBrowser } from "@/components/CatalogBrowser";
import { catalogEntities, dailyStats, recentLectures, uniqueEntities } from "@/lib/catalog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Home & Batches — NPrep" },
      { name: "description", content: "Your NPrep batches, recent lectures and daily learning activity." },
      { property: "og:title", content: "Home & Batches — NPrep" },
      { property: "og:description", content: "Your NPrep batches, recent lectures and daily learning activity." },
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
  const batches = uniqueEntities([...catalogEntities(q.data, "batch"), ...catalogEntities(me.data, "batch")]);
  const recent = recentLectures(q.data);
  const stats = dailyStats(q.data);
  const rest = groups.filter((g) => g !== banners && !/batch|edition|recent|resume|continue|stats/i.test(g.name));

  const quickActions = [
    { title: "Subjects & Lectures", detail: "Continue learning", to: "/subjects", icon: BookOpen },
    { title: "Tests & PYQ", detail: "Practice and review", to: "/tests", icon: ClipboardCheck },
    { title: "QBank", detail: "Build your accuracy", to: "/qbank", icon: Library },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageTitle title={`Welcome${name ? ` back, ${String(name).split(" ")[0]}` : ""}`} sub="Home & Batches" />
      {q.isLoading && <Loading />}
      {q.error && <ErrorBox error={q.error} />}
      {banners && (
        <div className="-mx-1 mb-7 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
          {banners.items.map((b, i) => {
            const img = imageOf(b);
            return img ? <img key={i} src={img} alt="" className="h-44 w-[88%] shrink-0 snap-start rounded-lg object-cover sm:h-56 sm:w-[58%] lg:w-[42%]" /> : null;
          })}
        </div>
      )}
      <div className="mb-9 grid gap-3 sm:grid-cols-3">
        {quickActions.map(({ title, detail, to, icon: Icon }) => (
          <Link key={to} to={to} className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/50 hover:shadow-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="mt-0.5 block text-sm text-muted-foreground">{detail}</span></span>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </Link>
        ))}
      </div>
      {stats.length > 0 && <section className="mb-8 grid grid-cols-2 gap-4 border-y border-border py-5 sm:grid-cols-4">{stats.map((stat) => <div key={stat.label}><Activity className="mb-2 h-4 w-4 text-primary" /><div className="text-2xl font-semibold">{stat.value}</div><div className="text-sm capitalize text-muted-foreground">{stat.label}</div></div>)}</section>}
      {recent.length > 0 && <section className="mb-8"><h2 className="mb-3 font-display text-xl font-semibold">Resume watching</h2><div className="grid gap-3 sm:grid-cols-2">{recent.map((lecture, i) => { const id = idOf(lecture); return id ? <Link key={id} to="/lecture/$videoId" params={{ videoId: id }} className="catalog-tile flex items-center gap-3 border border-border bg-card p-4"><PlayCircle className="h-6 w-6 shrink-0 text-primary" /><span className="min-w-0 break-words font-medium">{titleOf(lecture)}</span><ArrowRight className="ml-auto h-4 w-4 shrink-0" /></Link> : null; })}</div></section>}
      {batches.length > 0 && <section className="mb-8"><CatalogBrowser batches={batches} subjects={catalogEntities(q.data, "subject")} /></section>}
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
