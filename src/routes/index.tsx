import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ErrorBox, Loading, PageTitle, RawData, useMe } from "@/components/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { api, findArrays, findKey, imageOf, label, unwrap } from "@/lib/api";
import { ArrowRight, BookOpen, ClipboardCheck, Library } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

  const quickActions = [
    { title: "Subjects & Lectures", detail: "Continue learning", to: "/subjects", icon: BookOpen },
    { title: "Tests & PYQ", detail: "Practice and review", to: "/tests", icon: ClipboardCheck },
    { title: "QBank", detail: "Build your accuracy", to: "/qbank", icon: Library },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageTitle title={`Welcome${name ? ` back, ${String(name).split(" ")[0]}` : ""}`} sub="Your learning dashboard" />
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
