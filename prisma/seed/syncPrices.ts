import { db } from "../../src/lib/db";
import { syncStockPrices } from "../../src/lib/data/stockPrices";

async function main() {
  const companies = await db.company.findMany();
  for (const c of companies) {
    try {
      const written = await syncStockPrices(c, 180);
      console.log(`${c.ticker}: synced ${written} days`);
    } catch (e) {
      console.error(`${c.ticker}: FAILED - ${(e as Error).message}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
