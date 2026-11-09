// Thin client for NSE's public corporate-announcements API.
// NSE fronts its site with Akamai bot protection: a plain API request gets
// rejected unless it carries cookies issued by first loading nseindia.com in
// a browser-like session. We replicate that handshake here (one GET to the
// homepage to collect cookies, then the API call with those cookies attached)
// — this is the standard, widely-documented way to use NSE's own public API
// from a script, not a bypass of any paywall or private data.

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

let cachedCookie: { value: string; fetchedAt: number } | null = null;
const COOKIE_TTL_MS = 10 * 60 * 1000; // refresh every 10 minutes to stay well inside NSE's own expiry

async function getSessionCookie(): Promise<string> {
  if (cachedCookie && Date.now() - cachedCookie.fetchedAt < COOKIE_TTL_MS) {
    return cachedCookie.value;
  }
  const res = await fetch("https://www.nseindia.com/", { headers: BROWSER_HEADERS });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  cachedCookie = { value: cookie, fetchedAt: Date.now() };
  return cookie;
}

export type NseAnnouncement = {
  symbol: string;
  companyName: string;
  subject: string; // NSE's own short category label, e.g. "Board Meeting Intimation"
  description: string; // the attachment text / disclosure summary
  date: string; // ISO string
  attachmentUrl: string | null;
};

/** Fetches recent corporate announcements for a single NSE-listed symbol. */
export async function fetchNseAnnouncements(symbol: string): Promise<NseAnnouncement[]> {
  const cookie = await getSessionCookie();
  const url = `https://www.nseindia.com/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: { ...BROWSER_HEADERS, Cookie: cookie } });
  if (!res.ok) {
    throw new Error(`NSE API returned ${res.status} for ${symbol}`);
  }
  const data: Array<{
    symbol: string;
    sm_name: string;
    desc: string;
    attchmntText: string;
    an_dt: string; // "06-Nov-2026 19:10:58"
    attchmntFile: string | null;
  }> = await res.json();

  return data.map((d) => ({
    symbol: d.symbol,
    companyName: d.sm_name,
    subject: d.desc,
    description: d.attchmntText,
    date: parseNseDate(d.an_dt).toISOString(),
    attachmentUrl: d.attchmntFile || null,
  }));
}

function parseNseDate(s: string): Date {
  // "06-Nov-2026 19:10:58" -> Date (IST, treated as UTC+5:30)
  const [datePart, timePart] = s.split(" ");
  const [day, monStr, year] = datePart.split("-");
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const [hh, mm, ss] = (timePart ?? "00:00:00").split(":").map(Number);
  // Construct as IST then convert to a true UTC instant.
  const istMs = Date.UTC(Number(year), months[monStr], Number(day), hh, mm, ss);
  return new Date(istMs - 5.5 * 60 * 60 * 1000);
}
