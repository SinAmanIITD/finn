import { NextResponse } from "next/server";
import { getOrCreateCompanyByTicker } from "@/lib/data/companyLookup";
import { generateResearchSection, RESEARCH_SECTIONS, type ResearchSectionType } from "@/lib/ai/research";

export async function GET(request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") as ResearchSectionType | null;

  let company;
  try {
    company = await getOrCreateCompanyByTicker(ticker);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }

  const sectionTypes = section
    ? [section]
    : (Object.keys(RESEARCH_SECTIONS) as ResearchSectionType[]);

  const invalid = sectionTypes.find((s) => !(s in RESEARCH_SECTIONS));
  if (invalid) {
    return NextResponse.json(
      { error: `Unknown section "${invalid}". Valid: ${Object.keys(RESEARCH_SECTIONS).join(", ")}` },
      { status: 400 }
    );
  }

  const results = await Promise.all(sectionTypes.map((s) => generateResearchSection(company.id, s)));

  return NextResponse.json({ company, sections: results });
}
