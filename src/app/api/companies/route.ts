import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPriceSnapshotsForCompanies } from "@/lib/data/stockPrices";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const portfolioOnly = searchParams.get("portfolio") !== "false";

  const companies = await db.company.findMany({
    where: portfolioOnly ? { inPortfolio: true } : undefined,
    orderBy: { name: "asc" },
  });

  const snapshots = await getPriceSnapshotsForCompanies(companies.map((c) => c.id));
  const withSnapshots = companies.map((c) => ({ ...c, price: snapshots.get(c.id) ?? null }));

  return NextResponse.json({ companies: withSnapshots });
}
