import { NextResponse } from "next/server";
import { getDigest } from "@/lib/data/digest";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hours = Number(searchParams.get("hours") ?? 24);
  const digest = await getDigest(Number.isFinite(hours) && hours > 0 ? hours : 24);
  return NextResponse.json(digest);
}
