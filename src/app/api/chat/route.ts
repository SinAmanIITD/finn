import { NextResponse } from "next/server";
import { getOrCreateCompanyByTicker } from "@/lib/data/companyLookup";
import { answerQuestion } from "@/lib/ai/research";

export async function POST(request: Request) {
  const body = await request.json();
  const { ticker, question } = body as { ticker?: string; question?: string };

  if (!ticker || !question) {
    return NextResponse.json({ error: "ticker and question are required" }, { status: 400 });
  }

  let company;
  try {
    company = await getOrCreateCompanyByTicker(ticker);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }

  const result = await answerQuestion(company.id, question);
  return NextResponse.json({ company, question, ...result });
}
