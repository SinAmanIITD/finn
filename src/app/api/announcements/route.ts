import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const category = searchParams.get("category") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 50);

  const announcements = await db.announcement.findMany({
    where: {
      company: ticker ? { ticker } : undefined,
      category,
    },
    include: { company: { select: { name: true, ticker: true } } },
    orderBy: { announcementDate: "desc" },
    take: Number.isFinite(limit) ? limit : 50,
  });

  return NextResponse.json({ announcements });
}
