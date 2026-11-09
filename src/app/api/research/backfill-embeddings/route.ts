import { NextResponse } from "next/server";
import { backfillMissingEmbeddings } from "@/lib/data/documents";

/** One-off migration helper: embeds any document chunks ingested before OPENAI_API_KEY was set. */
export async function POST() {
  const result = await backfillMissingEmbeddings();
  return NextResponse.json(result);
}
