import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ClipboardList, LayoutDashboard, Library, LogOut, Menu, Moon, Sun, User, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { api, clearToken, findKey, getToken, syncSupabaseUser } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const NAV = [
  { to: "/", label: "Home & Batches", icon: LayoutDashboard },
  { to: "/subjects", label: "Courses & Lectures", icon: BookOpen },
  { to: "/tests", label: "Tests & PYQ", icon: ClipboardList },
  { to: "/qbank", label: "QBank", icon: Library },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api("/auth/me"), enabled: !!getToken(), staleTime: 300_000 });
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const me = useMe();

  useEffect(() => {
    const d = localStorage.getItem("theme") === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    if (!getToken() && path !== "/login") navigate({ to: "/login", replace: true });
    else setReady(true);
  }, [path, navigate]);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!me.data) return;
    const phone = findKey(me.data, /phone|mobile/i);
    if (typeof phone === "string" || typeof phone === "number") {
      void syncSupabaseUser(String(phone), { profile: me.data, raw: me.data }).catch((syncError) => console.error("Could not save profile data", syncError));
    }
  }, [me.data]);

  const toggleTheme = () => {
    const d = !dark;
    setDark(d);
    localStorage.setItem("theme", d ? "dark" : "light");
    document.documentElement.classList.toggle("dark", d);
  };

  if (path === "/login") return <>{children}</>;
  if (!ready) return <div className="min-h-screen bg-background" />;

  const name = findKey(me.data, /^(name|full_?name|first_?name)$/i);
  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <img src="/nprep-logo.jpg" alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
            <span className="font-display text-xl font-bold">NPrep</span>
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></Button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(n.to) ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-accent")}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="truncate px-3 pb-2 text-sm text-muted-foreground">{name ?? "Student"}</div>
          <Button variant="ghost" onClick={() => { clearToken(); window.location.href = "/login"; }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/30 md:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          <div className="hidden text-sm text-muted-foreground md:block">{NAV.find((n) => isActive(n.to))?.label}</div>
          <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme" className="rounded-full">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>
        <main className="flex-1 p-4 md:px-8 md:py-7 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string | undefined }) {
  return (
    <div className="mb-7">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
      {sub && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{sub}</p>}
    </div>
  );
}

export function Loading() {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{(error as Error)?.message ?? "Something went wrong"}</div>;
}

export function RawData({ data }: { data: unknown }) {
  return (
    <details className="mt-8 rounded-xl border border-border p-4 text-xs">
      <summary className="cursor-pointer text-muted-foreground">Raw response</summary>
      <pre className="mt-3 max-h-96 overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}
