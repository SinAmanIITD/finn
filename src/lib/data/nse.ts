// Thin client for NSE's public corporate-announcements API.
// NSE fronts its site with Akamai bot protection: a plain API request gets
// rejected unless it carries cookies issued by first loading the site in a
// browser-like session. We replicate that handshake here (one GET to the
// homepage to collect cookies, then the API call with those cookies attached)
// — this is the standard, widely-documented way to use NSE's own public API
// from a script, not a bypass of any paywall or private data.
//
// NSE migrated this API from nseindia.com to nseindia.in sometime after
// this was first built (nseindia.com now 301s there) - verified it's the
// same organization's real site, not a lookalike, before switching. The
// .com redirect itself was also triggering an HTTP/2 stream error in
// Node's fetch, so targeting .in directly sidesteps that too.
const NSE_BASE = "https://www.nseindia.in";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: `${NSE_BASE}/`,
};

let cachedCookie: { value: string; fetchedAt: number } | null = null;
const COOKIE_TTL_MS = 10 * 60 * 1000; // refresh every 10 minutes to stay well inside NSE's own expiry

async function getSessionCookie(): Promise<string> {
  if (cachedCookie && Date.now() - cachedCookie.fetchedAt < COOKIE_TTL_MS) {
    return cachedCookie.value;
  }
  const res = await fetch(`${NSE_BASE}/`, { headers: BROWSER_HEADERS });
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

function formatNseDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/**
 * Fetches corporate announcements for a single NSE-listed symbol within a
 * date window (default: the last 30 days). Without explicit from/to params,
 * NSE's API returns that symbol's ENTIRE announcement history - for a company
 * with a long listing history that's tens of thousands of rows, almost all
 * irrelevant to a "what changed recently" push digest.
 */
export async function fetchNseAnnouncements(symbol: string, windowDays = 30): Promise<NseAnnouncement[]> {
  try {
    return await fetchOnce(symbol, windowDays, false);
  } catch (e) {
    // One retry with a forced-fresh cookie: a long-lived dev server can hold a
    // cached session that NSE has since invalidated, and transient connection
    // resets are common enough against a third-party API we don't control.
    try {
      return await fetchOnce(symbol, windowDays, true);
    } catch (retryError) {
      const first = describeError(e);
      const second = describeError(retryError);
      throw new Error(`NSE fetch failed twice for ${symbol}: [1] ${first} | [2] ${second}`);
    }
  }
}

async function fetchOnce(symbol: string, windowDays: number, forceFreshCookie: boolean): Promise<NseAnnouncement[]> {
  if (forceFreshCookie) cachedCookie = null;
  const cookie = await getSessionCookie();
  const toDate = new Date();
  const fromDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const url =
    `${NSE_BASE}/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(symbol)}` +
    `&from_date=${formatNseDate(fromDate)}&to_date=${formatNseDate(toDate)}`;
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

function describeError(e: unknown): string {
  const err = e as Error & { cause?: unknown };
  const cause = err.cause ? ` (cause: ${String(err.cause)})` : "";
  return `${err.message}${cause}`;
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
