import { ExternalLink } from "lucide-react";
import { ImportanceBadge, CategoryTag } from "@/components/ImportanceBadge";
import type { DigestAnnouncement } from "@/lib/data/digest";

function timeAgo(date: Date | string) {
  const d = new Date(date);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function AnnouncementCard({ a }: { a: DigestAnnouncement }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm">{a.ticker}</span>
            <span className="text-muted text-xs truncate">{a.companyName}</span>
          </div>
        </div>
        <ImportanceBadge importance={a.importance} />
      </div>

      <p className="text-sm leading-snug">{a.summary ?? a.title}</p>

      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1.5">
          <CategoryTag category={a.category} />
          {a.isMock && (
            <span className="text-[10px] font-medium text-medium bg-medium-bg rounded-full px-2 py-0.5">
              demo data
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">{timeAgo(a.announcementDate)}</span>
          {a.sourceUrl && (
            <a
              href={a.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent"
              aria-label="Open original filing"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
