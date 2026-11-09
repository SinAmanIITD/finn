import { db } from "../../src/lib/db";
import { SEED_COMPANIES, toYahooSymbol } from "../../src/lib/data/companies";

async function main() {
  for (const c of SEED_COMPANIES) {
    await db.company.upsert({
      where: { ticker: c.ticker },
      update: {
        name: c.name,
        sector: c.sector,
        inPortfolio: c.inPortfolio,
        yahooSymbol: toYahooSymbol(c.ticker),
      },
      create: {
        name: c.name,
        ticker: c.ticker,
        sector: c.sector,
        inPortfolio: c.inPortfolio,
        yahooSymbol: toYahooSymbol(c.ticker),
        exchange: "NSE",
      },
    });
  }
  const count = await db.company.count();
  console.log(`Seeded companies. Total companies in DB: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
