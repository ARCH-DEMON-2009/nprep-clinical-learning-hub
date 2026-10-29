import { createFileRoute } from "@tanstack/react-router";
import { ErrorBox, Loading, PageTitle, RawData, useMe } from "@/components/AppShell";
import { findKey, imageOf } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "My Profile — NPrep" },
      { name: "description", content: "Your NPrep profile and subscription." },
      { property: "og:title", content: "My Profile — NPrep" },
      { property: "og:description", content: "Your NPrep profile and subscription." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const q = useMe();
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  const name = findKey(d, /^(name|full_?name|first_?name)$/i) ?? "Student";
  const degree = findKey(d, /degree|course|qualification/i);
  const plan = findKey(d, /batch|plan_?name|subscription_?name|package|tier/i);
  const phone = findKey(d, /phone|mobile/i);
  const email = findKey(d, /email/i);
  const avatar = imageOf(d);
  return (
    <div className="max-w-2xl">
      <PageTitle title="Profile" />
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          {avatar ? <img src={avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
            : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">{String(name)[0]}</div>}
          <div>
            <div className="font-display text-2xl font-bold">{String(name)}</div>
            {degree && <div className="text-muted-foreground">{String(degree)}</div>}
          </div>
        </div>
        <div className="mt-6 rounded-xl bg-accent p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Subscription</div>
          <div className="mt-1 text-lg font-semibold text-primary">{plan ? String(plan) : "No active plan"}</div>
        </div>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          {phone && <div><dt className="text-muted-foreground">Phone</dt><dd>{String(phone)}</dd></div>}
          {email && <div><dt className="text-muted-foreground">Email</dt><dd>{String(email)}</dd></div>}
        </dl>
      </div>
      <RawData data={d} />
    </div>
  );
}
