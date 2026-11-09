import YahooFinance from "yahoo-finance2";
import { db } from "@/lib/db";
import { toYahooSymbol } from "@/lib/data/companies";
import type { Company } from "@prisma/client";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/**
 * Resolves any NSE ticker to a Company row, creating one on the fly via a
 * live Yahoo Finance lookup if it isn't in our seeded portfolio/ad-hoc list.
 * This is what makes the research engine generalise to "any ticker where the
 * data is available", per the brief, instead of being hard-wired to our demo set.
 */
export async function getOrCreateCompanyByTicker(rawTicker: string): Promise<Company> {
  const ticker = rawTicker.trim().toUpperCase().replace(/\.NS$|\.BO$/, "");

  const existing = await db.company.findUnique({ where: { ticker } });
  if (existing) return existing;

  const yahooSymbol = toYahooSymbol(ticker);
  const quote = await yf.quote(yahooSymbol);
  if (!quote) throw new Error(`No data found for ticker "${ticker}" on NSE.`);

  return db.company.create({
    data: {
      name: quote.longName ?? quote.shortName ?? ticker,
      ticker,
      yahooSymbol,
      exchange: "NSE",
      sector: quote.sector ?? quote.industry ?? "Unknown",
      inPortfolio: false,
    },
  });
}
