import { cn } from "@/lib/cn";

export function PriceChip({
  changePct,
  close,
  compact = false,
}: {
  changePct: number | null | undefined;
  close: number | null | undefined;
  compact?: boolean;
}) {
  if (close == null || changePct == null) {
    return <span className="text-xs text-muted">no data</span>;
  }
  const positive = changePct >= 0;
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", compact && "flex-col items-end gap-0")}>
      <span className="font-mono text-sm font-medium">
        ₹{close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </span>
      <span
        className={cn(
          "font-mono text-xs font-semibold",
          positive ? "text-positive" : "text-negative"
        )}
      >
        {positive ? "+" : ""}
        {changePct.toFixed(2)}%
      </span>
    </span>
  );
}
