import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPriceSnapshot } from "@/lib/data/stockPrices";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const portfolioOnly = searchParams.get("portfolio") !== "false";

  const companies = await db.company.findMany({
    where: portfolioOnly ? { inPortfolio: true } : undefined,
    orderBy: { name: "asc" },
  });

  const withSnapshots = await Promise.all(
    companies.map(async (c) => ({
      ...c,
      price: await getPriceSnapshot(c.id),
    }))
  );

  return NextResponse.json({ companies: withSnapshots });
}
