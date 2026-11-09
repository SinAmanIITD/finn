import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateCompanyByTicker } from "@/lib/data/companyLookup";
import { ingestDocument } from "@/lib/data/documents";

export async function GET(_request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const company = await getOrCreateCompanyByTicker(ticker);
  const documents = await db.document.findMany({
    where: { companyId: company.id },
    include: { _count: { select: { chunks: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ company, documents });
}

export async function POST(request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const body = await request.json();
  const { documentType, period, sourceUrl } = body as { documentType?: string; period?: string; sourceUrl?: string };

  if (!documentType || !sourceUrl) {
    return NextResponse.json({ error: "documentType and sourceUrl are required" }, { status: 400 });
  }
  if (!["annual_report", "concall_transcript"].includes(documentType)) {
    return NextResponse.json({ error: 'documentType must be "annual_report" or "concall_transcript"' }, { status: 400 });
  }

  let company;
  try {
    company = await getOrCreateCompanyByTicker(ticker);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }

  const document = await db.document.create({
    data: { companyId: company.id, documentType, period: period ?? null, sourceUrl, status: "pending" },
  });

  try {
    const { chunks } = await ingestDocument(document.id);
    return NextResponse.json({ document: { ...document, status: "parsed" }, chunks });
  } catch (e) {
    return NextResponse.json({ document: { ...document, status: "failed" }, error: (e as Error).message }, { status: 502 });
  }
}
