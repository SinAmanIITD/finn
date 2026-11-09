import { NextResponse } from "next/server";
import { getOrCreateCompanyByTicker } from "@/lib/data/companyLookup";
import { generateGuidanceVsActuals } from "@/lib/ai/research";

export async function GET(_request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  let company;
  try {
    company = await getOrCreateCompanyByTicker(ticker);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }

  const result = await generateGuidanceVsActuals(company.id);
  return NextResponse.json({ company, ...result });
}
