import { cn } from "@/lib/cn";

const STYLES: Record<string, string> = {
  high: "text-high bg-high-bg",
  medium: "text-medium bg-medium-bg",
  low: "text-low bg-low-bg",
};

export function ImportanceBadge({ importance }: { importance: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STYLES[importance] ?? STYLES.low
      )}
    >
      {importance}
    </span>
  );
}

export function CategoryTag({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted">
      {category.replace(/_/g, " ")}
    </span>
  );
}
