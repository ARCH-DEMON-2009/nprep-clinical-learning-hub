import type { ReactNode } from "react";
import { imageOf, titleOf } from "@/lib/api";

export function ItemCard({ item, children, onClick }: { item: any; children?: ReactNode; onClick?: () => void }) {
  const img = imageOf(item);
  const sub = item?.description ?? item?.subtitle ?? item?.educator_name ?? item?.duration;
  return (
    <div onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); } } : undefined}
      className="group cursor-pointer overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {img && <img src={img} alt="" className="aspect-video w-full bg-muted object-cover" loading="lazy" />}
      <div className="p-4">
        <div className="font-semibold leading-snug group-hover:text-primary">{titleOf(item)}</div>
        {sub != null && typeof sub !== "object" && <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{String(sub)}</div>}
        {children}
      </div>
    </div>
  );
}
