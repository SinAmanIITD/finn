import YahooFinance from "yahoo-finance2";
import { db } from "@/lib/db";
import type { Company } from "@prisma/client";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** Fetches end-of-day price/volume history for one company and upserts it. */
export async function syncStockPrices(company: Pick<Company, "id" | "yahooSymbol">, days = 180) {
  const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const chart = await yf.chart(company.yahooSymbol, {
    period1,
    interval: "1d",
  });

  let written = 0;
  for (const q of chart.quotes) {
    if (q.close == null || q.open == null || q.high == null || q.low == null) continue;
    const date = new Date(Date.UTC(q.date.getUTCFullYear(), q.date.getUTCMonth(), q.date.getUTCDate()));
    await db.stockPrice.upsert({
      where: { companyId_date: { companyId: company.id, date } },
      update: { open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume ?? 0 },
      create: {
        companyId: company.id,
        date,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume ?? 0,
      },
    });
    written++;
  }
  return written;
}

export type PriceSnapshot = {
  date: Date;
  close: number;
  volume: number;
  changePct: number; // vs previous close
  avgVolume20d: number;
  volumeRatio: number; // today's volume / 20d average
  isUnusualVolume: boolean; // > 2x average, per the brief's example threshold
};

/** Computes the latest price snapshot + volume-anomaly signal for a company already in the DB. */
export async function getPriceSnapshot(companyId: number): Promise<PriceSnapshot | null> {
  const rows = await db.stockPrice.findMany({
    where: { companyId },
    orderBy: { date: "desc" },
    take: 21,
  });
  if (rows.length < 2) return null;

  const [latest, prev] = rows;
  const window = rows.slice(1, 21); // trailing 20 sessions, excluding today
  const avgVolume20d = window.reduce((s, r) => s + r.volume, 0) / (window.length || 1);
  const volumeRatio = avgVolume20d > 0 ? latest.volume / avgVolume20d : 0;

  return {
    date: latest.date,
    close: latest.close,
    volume: latest.volume,
    changePct: ((latest.close - prev.close) / prev.close) * 100,
    avgVolume20d,
    volumeRatio,
    isUnusualVolume: volumeRatio >= 2,
  };
}
