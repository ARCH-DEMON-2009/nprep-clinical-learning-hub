import type { ReactNode } from "react";
import { imageOf, titleOf } from "@/lib/api";

export function ItemCard({ item, children, onClick }: { item: any; children?: ReactNode; onClick?: () => void }) {
  const img = imageOf(item);
  const sub = item?.description ?? item?.subtitle ?? item?.educator_name ?? item?.duration;
  return (
    <div onClick={onClick}
      className="group overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {img && <img src={img} alt="" className="aspect-video w-full bg-muted object-cover" loading="lazy" />}
      <div className="p-4">
        <div className="font-semibold leading-snug group-hover:text-primary">{titleOf(item)}</div>
        {sub != null && typeof sub !== "object" && <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{String(sub)}</div>}
        {children}
      </div>
    </div>
  );
}
