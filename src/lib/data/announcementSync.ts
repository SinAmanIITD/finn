import { db } from "@/lib/db";
import { fetchNseAnnouncements } from "@/lib/data/nse";
import { classifyAnnouncement } from "@/lib/ai/classifier";
import type { Company } from "@prisma/client";

export type SyncOutcome = {
  ticker: string;
  fetched: number;
  created: number;
  source: "live" | "failed";
  error?: string;
};

/** Fetches, classifies, and stores recent NSE announcements for one company. */
export async function syncAnnouncementsForCompany(company: Pick<Company, "id" | "ticker" | "name">): Promise<SyncOutcome> {
  let items: Awaited<ReturnType<typeof fetchNseAnnouncements>>;
  try {
    items = await fetchNseAnnouncements(company.ticker);
  } catch (e) {
    return { ticker: company.ticker, fetched: 0, created: 0, source: "failed", error: (e as Error).message };
  }

  let created = 0;
  for (const item of items) {
    const announcementDate = new Date(item.date);
    const exists = await db.announcement.findFirst({
      where: { companyId: company.id, title: item.subject, announcementDate },
      select: { id: true },
    });
    if (exists) continue;

    const classification = await classifyAnnouncement(company.name, item.subject, item.description);

    await db.announcement.create({
      data: {
        companyId: company.id,
        category: classification.category,
        title: item.subject,
        summary: classification.summary,
        importance: classification.importance,
        announcementDate,
        sourceUrl: item.attachmentUrl,
        rawText: item.description,
        isMock: false,
      },
    });
    created++;
  }

  return { ticker: company.ticker, fetched: items.length, created, source: "live" };
}

export async function syncAnnouncementsForPortfolio() {
  const companies = await db.company.findMany();
  const results: SyncOutcome[] = [];
  for (const c of companies) {
    results.push(await syncAnnouncementsForCompany(c));
    // Be a polite citizen of NSE's public API - small gap between requests.
    await new Promise((r) => setTimeout(r, 400));
  }
  return results;
}
