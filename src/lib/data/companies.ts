// The demo portfolio (15-20 holdings) + a handful of ad-hoc tickers to prove the
// research engine generalises beyond the portfolio, per the brief. The research
// API itself is NOT hard-wired to this list - see /api/research/[ticker], which
// accepts any NSE ticker and falls back to an on-the-fly Yahoo Finance lookup.

export type SeedCompany = {
  name: string;
  ticker: string; // NSE symbol, no suffix
  sector: string;
  inPortfolio: boolean;
};

export const SEED_COMPANIES: SeedCompany[] = [
  { name: "Reliance Industries", ticker: "RELIANCE", sector: "Conglomerate", inPortfolio: true },
  { name: "Tata Consultancy Services", ticker: "TCS", sector: "IT Services", inPortfolio: true },
  { name: "Infosys", ticker: "INFY", sector: "IT Services", inPortfolio: true },
  { name: "HDFC Bank", ticker: "HDFCBANK", sector: "Banking", inPortfolio: true },
  { name: "ICICI Bank", ticker: "ICICIBANK", sector: "Banking", inPortfolio: true },
  { name: "State Bank of India", ticker: "SBIN", sector: "Banking", inPortfolio: true },
  { name: "ITC", ticker: "ITC", sector: "FMCG", inPortfolio: true },
  { name: "Hindustan Unilever", ticker: "HINDUNILVR", sector: "FMCG", inPortfolio: true },
  // Tata Motors demerged in 2025 into separate CV and PV listings; PV (passenger
  // vehicles) is the more recognisable "Tata Motors" to a retail investor.
  { name: "Tata Motors Passenger Vehicles", ticker: "TMPV", sector: "Automobile", inPortfolio: true },
  { name: "Maruti Suzuki", ticker: "MARUTI", sector: "Automobile", inPortfolio: true },
  { name: "Bharti Airtel", ticker: "BHARTIARTL", sector: "Telecom", inPortfolio: true },
  { name: "Sun Pharmaceutical", ticker: "SUNPHARMA", sector: "Pharma", inPortfolio: true },
  { name: "Dr. Reddy's Laboratories", ticker: "DRREDDY", sector: "Pharma", inPortfolio: true },
  { name: "Larsen & Toubro", ticker: "LT", sector: "Engineering", inPortfolio: true },
  { name: "Asian Paints", ticker: "ASIANPAINT", sector: "Paints", inPortfolio: true },
  { name: "Titan Company", ticker: "TITAN", sector: "Consumer", inPortfolio: true },
  { name: "UltraTech Cement", ticker: "ULTRACEMCO", sector: "Cement", inPortfolio: true },
  { name: "NTPC", ticker: "NTPC", sector: "Power", inPortfolio: true },

  // Ad-hoc research demo set - deliberately outside the portfolio
  { name: "Wipro", ticker: "WIPRO", sector: "IT Services", inPortfolio: false },
  { name: "Eternal (Zomato)", ticker: "ETERNAL", sector: "Internet/Consumer", inPortfolio: false },
  { name: "Bajaj Finance", ticker: "BAJFINANCE", sector: "NBFC", inPortfolio: false },
  { name: "Hindalco Industries", ticker: "HINDALCO", sector: "Metals", inPortfolio: false },
  { name: "Coal India", ticker: "COALINDIA", sector: "Mining", inPortfolio: false },
];

export function toYahooSymbol(ticker: string, exchange: "NSE" | "BSE" = "NSE") {
  return `${ticker}.${exchange === "NSE" ? "NS" : "BO"}`;
}
