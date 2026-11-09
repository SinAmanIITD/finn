import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncStockPrices } from "@/lib/data/stockPrices";
import { syncAnnouncementsForCompany, type SyncOutcome } from "@/lib/data/announcementSync";

export const maxDuration = 60;

/**
 * Refreshes prices + announcements for one company (?ticker=INFY) or, with no
 * ticker, the whole portfolio. This is the app's own data-sync job - intended
 * to run on a schedule (cron/APScheduler-equivalent) in a real deployment; here
 * it's exposed as a POST endpoint so it can be triggered from the UI or tested
 * directly, same as any other feature of the app.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  const companies = await db.company.findMany({
    where: ticker ? { ticker: ticker.toUpperCase() } : { inPortfolio: true },
  });

  const priceResults: { ticker: string; ok: boolean; error?: string }[] = [];
  const announcementResults: SyncOutcome[] = [];

  for (const c of companies) {
    try {
      const written = await syncStockPrices(c);
      priceResults.push({ ticker: c.ticker, ok: true, error: written === 0 ? "no new rows" : undefined });
    } catch (e) {
      priceResults.push({ ticker: c.ticker, ok: false, error: (e as Error).message });
    }

    announcementResults.push(await syncAnnouncementsForCompany(c));
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({ companies: companies.length, priceResults, announcementResults });
}
