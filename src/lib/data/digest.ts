import { db } from "@/lib/db";
import { getPriceSnapshotsForCompanies } from "@/lib/data/stockPrices";

export type DigestAnnouncement = {
  id: number;
  companyName: string;
  ticker: string;
  category: string;
  title: string;
  summary: string | null;
  importance: string;
  announcementDate: Date;
  sourceUrl: string | null;
  isMock: boolean;
};

export type VolumeAlert = {
  companyName: string;
  ticker: string;
  volumeRatio: number;
  changePct: number;
  close: number;
  date: Date;
};

export type Digest = {
  windowHours: number;
  generatedAt: Date;
  high: DigestAnnouncement[];
  medium: DigestAnnouncement[];
  low: DigestAnnouncement[]; // routine - collapsed by default in the UI
  volumeAlerts: VolumeAlert[];
};

/** Builds the windowed, prioritised PUSH digest across the portfolio. */
export async function getDigest(windowHours = 24): Promise<Digest> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const announcements = await db.announcement.findMany({
    where: { announcementDate: { gte: since }, company: { inPortfolio: true } },
    include: { company: { select: { name: true, ticker: true } } },
    orderBy: { announcementDate: "desc" },
  });

  const mapped: DigestAnnouncement[] = announcements.map((a) => ({
    id: a.id,
    companyName: a.company.name,
    ticker: a.company.ticker,
    category: a.category,
    title: a.title,
    summary: a.summary,
    importance: a.importance,
    announcementDate: a.announcementDate,
    sourceUrl: a.sourceUrl,
    isMock: a.isMock,
  }));

  const companies = await db.company.findMany({ where: { inPortfolio: true } });
  const snapshots = await getPriceSnapshotsForCompanies(companies.map((c) => c.id));
  const volumeAlerts: VolumeAlert[] = [];
  for (const c of companies) {
    const snap = snapshots.get(c.id);
    if (snap?.isUnusualVolume) {
      volumeAlerts.push({
        companyName: c.name,
        ticker: c.ticker,
        volumeRatio: snap.volumeRatio,
        changePct: snap.changePct,
        close: snap.close,
        date: snap.date,
      });
    }
  }
  volumeAlerts.sort((a, b) => b.volumeRatio - a.volumeRatio);

  return {
    windowHours,
    generatedAt: new Date(),
    high: mapped.filter((a) => a.importance === "high"),
    medium: mapped.filter((a) => a.importance === "medium"),
    low: mapped.filter((a) => a.importance === "low"),
    volumeAlerts,
  };
}
