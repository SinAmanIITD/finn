# FINN — Financial Investment Agent

A mobile-first AI research assistant for the Indian stock market, built for ENAM's AI Engineer Build
Challenge. FINN works in two modes: **Push** (a prioritised daily digest of what changed across your
portfolio) and **Pull** (on-demand, citation-backed research on any NSE ticker, grounded only in that
company's own primary documents).

## Scope: narrow and deep, on purpose

The brief is explicit that it grades judgment and architecture, not completeness — "thin-but-working
beats broad-but-broken." Rather than building six shallow features, this submission goes deep on two:

1. **Push — the prioritised announcement digest.** Fetches real NSE corporate announcements for the
   portfolio, classifies them (rules first, AI for the ambiguous remainder), ranks them high/medium/low,
   collapses routine ones, and flags unusual-volume days. Configurable windows (24h/3d/7d).
2. **Pull — primary-source research, including guidance vs. actuals.** Ingests a company's annual
   reports / concall transcripts (PDF), retrieves the relevant passages for a question or section, and
   has an LLM answer strictly from that evidence with page citations — never from its own background
   knowledge. Includes the brief's favourite worked example: comparing what management explicitly
   guided on against what was actually delivered.

**Deliberately left out of this build** (see "Where I'd take it next"): configurable alert thresholds,
the five remaining Pull sections (balance sheet, trajectory, bull vs. bear — the same pipeline that
powers the four built sections would power these too), the "pull a LinkedIn bio for a new CFO"
enrichment, and extracting headline Revenue/EBITDA/PBT/PAT straight out of a results PDF for the push
digest (financial figures currently come from documents you ingest on the Research tab, not auto-parsed
out of every results filing).

## Stack

A single Next.js/TypeScript app, not a separate frontend+backend — the simplest shape that's still
honest about the problem, and the right call for a ~1-week solo build (one language, one deploy target,
no service-to-service plumbing to debug).

- **Next.js 16 (App Router) + TypeScript + Tailwind v4** — frontend and API routes together.
- **SQLite via Prisma** — zero-setup locally; swap `provider` to `postgresql` and point `DATABASE_URL`
  at Supabase (or any Postgres) for production with no schema changes.
- **yahoo-finance2** — real end-of-day price/volume for NSE tickers (`.NS`).
- **NSE's own public corporate-announcements API** — real filings, not mocked.
- **pdf-parse (pdfjs-dist)** — per-page text extraction from annual reports / transcripts, so every
  claim can cite a page number.
- **Groq + OpenAI, multi-provider routing** (`src/lib/ai/provider.ts`) — **no restriction on models**
  was in the brief, so routing is split across providers, not just within one:
  - **Groq** (`llama-3.1-8b-instant`) for the cheap/bulk tier — announcement classification, one-line
    summaries. Groq's free tier is fast and effectively free, which is the point for high-volume,
    low-ambiguity work.
  - **OpenAI** (`gpt-4o`) for the reasoning tier — research synthesis, guidance-vs-actuals, chat, where
    answer quality actually matters.
  - Both speak the OpenAI-compatible chat-completions API, so one SDK (`openai`) covers both; only the
    `baseURL` differs.
- **Retrieval with a built-in upgrade path** (`src/lib/ai/retrieval.ts`): OpenAI embeddings
  (`text-embedding-3-small`) + cosine similarity when `OPENAI_API_KEY` is set and chunks have been
  embedded, falling back automatically to a hand-rolled BM25 ranker otherwise. BM25 isn't a placeholder
  — it's what keeps the app fully functional with zero API keys configured — but the moment an OpenAI
  key is added, retrieval quality upgrades with no other code changes.

## Data honesty

- Every announcement and price point in the UI is live, not seeded — `isMock` exists on the schema for
  exactly the "label demo data clearly" requirement in the brief, but the default path never sets it.
- Every research/chat answer either comes from real retrieved evidence + a real LLM call, or says
  explicitly "demo mode (no OPENAI_API_KEY set)" — it never fabricates confident-sounding analysis
  from nothing.
- Classification never guesses: if a rule doesn't match and the AI response doesn't parse to one of the
  17 allowed categories, the announcement is left `unclassified` rather than assigned something invented.

## Getting started

```bash
npm install
cp .env.example .env   # already done for local dev; this is the template
npx prisma db push     # creates prisma/dev.db from the schema
npm run seed            # seeds the 18-company portfolio + 5 ad-hoc tickers
npm run sync-prices     # pulls 180 days of real EOD price/volume for all of them
npm run dev              # http://localhost:3000
```

Open `/` for the digest, tap **Refresh** to pull live NSE announcements for the whole portfolio (takes
~30–60s for 23 companies — NSE's API is one call per symbol, with a small delay between calls to be a
polite client of a public API we don't control).

### Adding AI (optional but recommended)

Without keys, the app runs end-to-end in a clearly-labelled demo mode: real data in, real BM25
retrieval, but no LLM synthesis. Add either or both, in `.env`, yourself:

```
GROQ_API_KEY=...     # https://console.groq.com/keys — cheap/bulk tier (classification, summaries)
OPENAI_API_KEY=...   # https://platform.openai.com/api-keys — reasoning tier (research, chat) + embeddings
```

Adding only `OPENAI_API_KEY` still gets you real classification (it's just not routed to the cheap
tier) plus real research/chat/embeddings — Groq is an optimisation, not a hard dependency. If you add
`OPENAI_API_KEY` after documents are already ingested, backfill their embeddings once:
`curl -X POST localhost:3000/api/research/backfill-embeddings`.

### Adding primary-source documents (Pull side)

On the Research tab, search a ticker → **Add** under "Primary sources" → paste a direct PDF link (an
annual report or concall transcript from screener.in or the company's own IR page) → it downloads,
extracts text per-page, chunks it, and is immediately retrievable.

**One real constraint worth knowing:** BSE's and some companies' newer filing hosts sit behind Akamai
bot protection that blocks plain server-side HTTP clients outright (not something header-spoofing
fixes — it's TLS/JS-fingerprint based). Older BSE filings on the legacy `bseplus/AnnualReport/` path,
and most concall transcript links, aren't gated this way and ingest fine — that's what's used for the
worked INFY example already in the seeded data. If a document add fails, try an older filing or a
different host for the same company.

## API reference

| Endpoint | Method | What it does |
| --- | --- | --- |
| `/api/companies?portfolio=false` | GET | List companies (+ latest price snapshot). `portfolio=false` includes ad-hoc tickers. |
| `/api/digest?hours=24` | GET | Windowed, prioritised announcement digest + volume alerts. |
| `/api/announcements?ticker=INFY` | GET | Raw announcement list, optionally filtered. |
| `/api/refresh` (POST) `?ticker=INFY` | POST | Syncs prices + NSE announcements for one ticker, or the whole portfolio if omitted. |
| `/api/research/[ticker]?section=cash_quality` | GET | Generates (or regenerates) one research section. Omit `section` for all four. |
| `/api/research/[ticker]/guidance` | GET | Guidance-vs-actuals comparison. |
| `/api/research/[ticker]/documents` | GET / POST | List / ingest primary-source PDFs for a company. |
| `/api/chat` (POST, `{ticker, question}`) | POST | Free-form grounded Q&A ("Ask FINN"). |

`[ticker]` accepts **any** NSE symbol, not just the seeded portfolio — unseen tickers are resolved
on the fly via a live Yahoo Finance lookup, which is what makes the research engine generalise rather
than being hard-wired to the demo set.

## Where I'd take it next

1. **The other four Pull sections** (trajectory, balance sheet, guidance, bull vs. bear) — same
   pipeline, just more section prompts; left out to keep the built ones genuinely polished rather than
   spreading thin.
2. **Headline-number extraction for the results push card** — parse the actual results PDF when a
   `results` announcement lands, extract Revenue/EBITDA/PBT/PAT via structured AI extraction (reusing
   the PDF pipeline already built for Pull), and show QoQ/YoY inline in the digest card, per the brief's
   own loved example.
3. **Configurable alert thresholds** — the volume-anomaly signal (>2x average) is currently a fixed
   heuristic; making it per-user-configurable (and adding a price-move threshold) is a small UI + schema
   addition on top of what's already computed in `getPriceSnapshot`.
4. **Vector retrieval** once document volume grows past what BM25 handles comfortably — swap
   `retrieval.ts` for pgvector + an embeddings model.
5. **Management-change enrichment** (a short bio for an incoming CEO/CFO) — deliberately left out here
   since the only free way to do it well is scraping LinkedIn, which is both ToS-fragile and a
   meaningfully different trust/safety shape than reading NSE's own public API. A general web-search
   call (rather than LinkedIn-specific scraping) is the more defensible version of this.
6. **Postgres in production** — swap the Prisma `provider` and point `DATABASE_URL` at Supabase; no
   other code changes needed.
