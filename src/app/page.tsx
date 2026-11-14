"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { PriceChip } from "@/components/PriceChip";
import { cn } from "@/lib/cn";
import type { Digest } from "@/lib/data/digest";

type CompanyWithPrice = {
  id: number;
  name: string;
  ticker: string;
  price: { close: number; changePct: number } | null;
};

const WINDOWS = [
  { hours: 24, label: "24h" },
  { hours: 72, label: "3d" },
  { hours: 168, label: "7d" },
];

export default function HomePage() {
  const [hours, setHours] = useState(24);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [companies, setCompanies] = useState<CompanyWithPrice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [digestRes, companiesRes] = await Promise.all([
      fetch(`/api/digest?hours=${hours}`).then((r) => r.json()),
      fetch(`/api/companies`).then((r) => r.json()),
    ]);
    setDigest(digestRes);
    setCompanies(companiesRes.companies);
    setLoading(false);
  }, [hours]);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await fetch("/api/refresh", { method: "POST" });
    await load();
    setRefreshing(false);
  }

  const totalCount = digest ? digest.high.length + digest.medium.length + digest.low.length : 0;

  return (
    <div className="px-4 pt-5 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">FINN</h1>
          <p className="text-xs text-muted">Daily intelligence, filtered</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted active:scale-95 transition-transform disabled:opacity-50"
        >
          <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
          {refreshing ? "Syncing..." : "Refresh"}
        </button>
      </header>

      {/* Portfolio ticker strip */}
      <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1">
        {companies === null
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 w-28 shrink-0 rounded-xl bg-surface border border-border animate-pulse" />
            ))
          : companies.map((c) => (
              <Link
                key={c.id}
                href={`/research?ticker=${c.ticker}`}
                className="h-16 w-28 shrink-0 rounded-xl border border-border bg-surface px-3 py-2 flex flex-col justify-between active:scale-95 transition-transform"
              >
                <span className="text-xs font-semibold">{c.ticker}</span>
                <PriceChip close={c.price?.close} changePct={c.price?.changePct} compact />
              </Link>
            ))}
      </div>

      {/* Window selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted">Announcements</h2>
        <div className="flex rounded-full border border-border p-0.5 bg-surface">
          {WINDOWS.map((w) => (
            <button
              key={w.hours}
              onClick={() => setHours(w.hours)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                hours === w.hours ? "bg-accent text-accent-foreground" : "text-muted"
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !digest ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : digest && totalCount === 0 && digest.volumeAlerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Nothing material in the last {WINDOWS.find((w) => w.hours === hours)?.label}. Try a wider window, or hit
          Refresh to fetch the latest filings from NSE.
        </div>
      ) : (
        digest && (
          <div className="space-y-5">
            {digest.volumeAlerts.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-medium">
                  <Activity size={13} /> Unusual activity
                </h3>
                <div className="space-y-2">
                  {digest.volumeAlerts.map((a) => (
                    <div
                      key={a.ticker}
                      className="rounded-xl border border-border bg-medium-bg/40 p-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold">{a.ticker}</p>
                        <p className="text-xs text-muted">{a.volumeRatio.toFixed(1)}x average volume</p>
                      </div>
                      <PriceChip close={a.close} changePct={a.changePct} compact />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {digest.high.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-high">High priority</h3>
                <div className="space-y-2">
                  {digest.high.map((a) => (
                    <AnnouncementCard key={a.id} a={a} />
                  ))}
                </div>
              </section>
            )}

            {digest.medium.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-medium">Medium priority</h3>
                <div className="space-y-2">
                  {digest.medium.map((a) => (
                    <AnnouncementCard key={a.id} a={a} />
                  ))}
                </div>
              </section>
            )}

            {digest.low.length > 0 && (
              <section className="space-y-2">
                <button
                  onClick={() => setShowRoutine((v) => !v)}
                  className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-low"
                >
                  <span>Routine ({digest.low.length})</span>
                  {showRoutine ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showRoutine && (
                  <div className="space-y-2">
                    {digest.low.map((a) => (
                      <AnnouncementCard key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )
      )}
    </div>
  );
}
