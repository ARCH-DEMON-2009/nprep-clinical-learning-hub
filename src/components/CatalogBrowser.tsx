import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Layers } from "lucide-react";
import { catalogEntities, type CatalogKind } from "@/lib/catalog";
import { idOf, imageOf, titleOf } from "@/lib/api";
import { Button } from "./ui/button";

export function CatalogBrowser({ batches, subjects }: { batches: any[]; subjects: any[] }) {
  const navigate = useNavigate();
  const [trail, setTrail] = useState<{ item: any; kind: CatalogKind }[]>([]);
  const current = trail.at(-1);
  const courses = current ? catalogEntities(current.item, "course") : [];
  const nestedSubjects = current ? catalogEntities(current.item, "subject") : [];
  const children = current?.kind === "batch" && courses.length ? courses : nestedSubjects.length ? nestedSubjects : subjects;
  const kind: CatalogKind = current?.kind === "batch" && courses.length ? "course" : "subject";
  const open = (item: any, level: CatalogKind) => {
    const id = idOf(item);
    if (level !== "subject" && (catalogEntities(item, "course").length || catalogEntities(item, "subject").length)) {
      setTrail([...trail, { item, kind: level }]); return;
    }
    if (level === "batch") { setTrail([...trail, { item, kind: level }]); return; }
    if (id) void navigate({ to: "/subjects/$subjectId", params: { subjectId: id }, search: { kind: level } });
  };
  const tiles = (items: any[], level: CatalogKind) => <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {items.map((item, index) => <Button key={idOf(item) ?? index} variant="outline" onClick={() => open(item, level)} className="catalog-tile h-auto justify-start whitespace-normal p-0 text-left">
      {imageOf(item) ? <img src={imageOf(item)} alt="" className="h-20 w-20 shrink-0 object-cover" /> : <span className="flex h-20 w-20 shrink-0 items-center justify-center bg-accent text-primary">{level === "batch" ? <Layers /> : <BookOpen />}</span>}
      <span className="min-w-0 flex-1 p-4"><span className="block text-xs uppercase text-muted-foreground">{level === "batch" ? "Batch / edition" : level}</span><span className="mt-1 block break-words font-semibold">{titleOf(item)}</span></span>
      <ArrowRight className="mr-4 h-4 w-4 shrink-0 text-primary" />
    </Button>)}
  </div>;
  return <div className="space-y-7">
    {current ? <>
      <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" onClick={() => setTrail(trail.slice(0, -1))}><ArrowLeft />Back</Button><h2 className="font-display text-xl font-semibold">{titleOf(current.item)}</h2></div>
      <h3 className="font-semibold">{kind === "course" ? "Courses" : "Subjects"}</h3>
      {tiles(children, kind)}
      {!children.length && <p className="text-sm text-muted-foreground">No courses or subjects were returned for this batch.</p>}
    </> : <>
      {batches.length > 0 && <section className="space-y-3"><h2 className="font-display text-xl font-semibold">My batches & editions</h2>{tiles(batches, "batch")}</section>}
      <section className="space-y-3"><h2 className="font-display text-xl font-semibold">All subjects</h2>{tiles(subjects, "subject")}</section>
    </>}
  </div>;
}