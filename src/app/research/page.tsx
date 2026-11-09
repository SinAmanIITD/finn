"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, FileText, Loader2 } from "lucide-react";
import { PriceChip } from "@/components/PriceChip";
import { MarkdownLite } from "@/components/MarkdownLite";
import { cn } from "@/lib/cn";
import { RESEARCH_SECTIONS, type ResearchSectionType } from "@/lib/data/researchSections";

type Company = { id: number; name: string; ticker: string; sector: string; inPortfolio: boolean };
type CompanyWithPrice = Company & { price: { close: number; changePct: number } | null };

const SECTION_ORDER = Object.keys(RESEARCH_SECTIONS) as ResearchSectionType[];

type SectionState = {
  content: string;
  sourceRefs: { document: string; period: string | null; page: number | null }[];
  demo: boolean;
  loading: boolean;
};

type GuidanceItem = {
  metric: string;
  guidance: string;
  guidancePeriod: string;
  target: string;
  actual: string;
  differencePct: string;
  interpretation: string;
};

function ResearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tickerParam = searchParams.get("ticker");

  const [query, setQuery] = useState(tickerParam ?? "");
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<CompanyWithPrice | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [documents, setDocuments] = useState<{ id: number; documentType: string; period: string | null; sourceUrl: string; status: string; _count: { chunks: number } }[]>([]);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [addDocForm, setAddDocForm] = useState({ documentType: "annual_report", period: "", sourceUrl: "" });
  const [addingDoc, setAddingDoc] = useState(false);

  const [sections, setSections] = useState<Partial<Record<ResearchSectionType, SectionState>>>({});
  const [activeTab, setActiveTab] = useState<ResearchSectionType>("business_snapshot");
  const [guidance, setGuidance] = useState<{ items: GuidanceItem[]; demo: boolean; loading: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/companies?portfolio=false").then((r) => r.json()).then((d) => setAllCompanies(d.companies));
  }, []);

  const loadCompany = useCallback(async (ticker: string) => {
    if (!ticker) return;
    setLoadingCompany(true);
    setSections({});
    setGuidance(null);
    const [companiesRes, docsRes] = await Promise.all([
      fetch(`/api/companies?portfolio=false`).then((r) => r.json()),
      fetch(`/api/research/${ticker}/documents`).then((r) => r.json()),
    ]);
    const found = companiesRes.companies.find((c: CompanyWithPrice) => c.ticker === ticker.toUpperCase());
    setActiveCompany(found ?? { id: docsRes.company.id, ...docsRes.company, price: null });
    setDocuments(docsRes.documents ?? []);
    setLoadingCompany(false);
  }, []);

  useEffect(() => {
    if (tickerParam) {
      setQuery(tickerParam);
      loadCompany(tickerParam);
    }
  }, [tickerParam, loadCompany]);

  function selectTicker(ticker: string) {
    router.push(`/research?ticker=${ticker.toUpperCase()}`);
  }

  async function generateSection(section: ResearchSectionType) {
    if (!activeCompany) return;
    setSections((prev) => ({ ...prev, [section]: { content: "", sourceRefs: [], demo: false, loading: true } }));
    const res = await fetch(`/api/research/${activeCompany.ticker}?section=${section}`).then((r) => r.json());
    const result = res.sections?.[0];
    setSections((prev) => ({
      ...prev,
      [section]: {
        content: result?.content ?? "Something went wrong generating this section.",
        sourceRefs: result?.sourceRefs ?? [],
        demo: result?.demo ?? true,
        loading: false,
      },
    }));
  }

  async function generateGuidance() {
    if (!activeCompany) return;
    setGuidance({ items: [], demo: false, loading: true });
    const res = await fetch(`/api/research/${activeCompany.ticker}/guidance`).then((r) => r.json());
    setGuidance({ items: res.items ?? [], demo: res.demo ?? true, loading: false });
  }

  async function addDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany || !addDocForm.sourceUrl) return;
    setAddingDoc(true);
    await fetch(`/api/research/${activeCompany.ticker}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addDocForm),
    });
    const docsRes = await fetch(`/api/research/${activeCompany.ticker}/documents`).then((r) => r.json());
    setDocuments(docsRes.documents ?? []);
    setAddDocForm({ documentType: "annual_report", period: "", sourceUrl: "" });
    setAddingDoc(false);
    setShowAddDoc(false);
  }

  const suggestions = allCompanies.filter((c) =>
    query.length > 0 ? c.ticker.includes(query.toUpperCase()) || c.name.toLowerCase().includes(query.toLowerCase()) : false
  );

  return (
    <div className="px-4 pt-5 space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Research</h1>
        <p className="text-xs text-muted">Any NSE ticker - grounded in primary sources only.</p>
      </header>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query && selectTicker(query)}
          placeholder="Search ticker or company name"
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
        {query && suggestions.length > 0 && !activeCompany && (
          <div className="absolute inset-x-0 top-full mt-1 rounded-xl border border-border bg-surface-raised shadow-lg z-10 max-h-56 overflow-y-auto">
            {suggestions.slice(0, 8).map((c) => (
              <button
                key={c.ticker}
                onClick={() => selectTicker(c.ticker)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-surface"
              >
                <span className="font-medium">{c.ticker}</span>
                <span className="text-muted text-xs truncate ml-2">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!activeCompany && !loadingCompany && (
        <div className="flex flex-wrap gap-1.5">
          {allCompanies.slice(0, 10).map((c) => (
            <button
              key={c.ticker}
              onClick={() => selectTicker(c.ticker)}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted"
            >
              {c.ticker}
            </button>
          ))}
        </div>
      )}

      {loadingCompany && (
        <div className="flex items-center gap-2 text-sm text-muted py-8 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading company...
        </div>
      )}

      {activeCompany && !loadingCompany && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-3.5 flex items-center justify-between">
            <div>
              <p className="font-semibold">{activeCompany.ticker}</p>
              <p className="text-xs text-muted">{activeCompany.name}</p>
              <p className="text-[11px] text-muted mt-0.5">{activeCompany.sector}</p>
            </div>
            {activeCompany.price && <PriceChip close={activeCompany.price.close} changePct={activeCompany.price.changePct} />}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                <FileText size={13} /> Primary sources ({documents.length})
              </h3>
              <button
                onClick={() => setShowAddDoc((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-accent"
              >
                <Plus size={13} /> Add
              </button>
            </div>

            {documents.length === 0 && !showAddDoc && (
              <p className="text-xs text-muted">
                No annual reports or concall transcripts ingested yet. Add one (a direct PDF link from screener.in
                or the company's IR page) to ground research in primary sources.
              </p>
            )}

            <div className="space-y-1.5">
              {documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                  <span className="font-medium">
                    {d.documentType === "annual_report" ? "Annual Report" : "Concall Transcript"}
                    {d.period ? ` - ${d.period}` : ""}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold",
                      d.status === "parsed" ? "bg-positive/15 text-positive" : d.status === "failed" ? "bg-negative/15 text-negative" : "bg-medium-bg text-medium"
                    )}
                  >
                    {d.status === "parsed" ? `${d._count.chunks} chunks` : d.status}
                  </span>
                </div>
              ))}
            </div>

            {showAddDoc && (
              <form onSubmit={addDocument} className="space-y-2 rounded-xl border border-border bg-surface p-3">
                <div className="flex gap-2">
                  <select
                    value={addDocForm.documentType}
                    onChange={(e) => setAddDocForm((f) => ({ ...f, documentType: e.target.value }))}
                    className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="annual_report">Annual Report</option>
                    <option value="concall_transcript">Concall Transcript</option>
                  </select>
                  <input
                    value={addDocForm.period}
                    onChange={(e) => setAddDocForm((f) => ({ ...f, period: e.target.value }))}
                    placeholder="e.g. FY2026"
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </div>
                <input
                  value={addDocForm.sourceUrl}
                  onChange={(e) => setAddDocForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                  placeholder="https://... (direct PDF link)"
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  disabled={addingDoc}
                  className="w-full rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-50"
                >
                  {addingDoc ? "Fetching and ingesting PDF..." : "Ingest document"}
                </button>
              </form>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
              {SECTION_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveTab(s)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border",
                    activeTab === s ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted bg-surface"
                  )}
                >
                  {RESEARCH_SECTIONS[s].label}
                </button>
              ))}
              <button
                onClick={() => setActiveTab("guidance" as ResearchSectionType)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border",
                  (activeTab as string) === "guidance" ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted bg-surface"
                )}
              >
                Guidance vs actuals
              </button>
            </div>

            {(activeTab as string) === "guidance" ? (
              <GuidanceSection guidance={guidance} onGenerate={generateGuidance} />
            ) : (
              <SectionPanel
                state={sections[activeTab]}
                onGenerate={() => generateSection(activeTab)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionPanel({ state, onGenerate }: { state: SectionState | undefined; onGenerate: () => void }) {
  if (!state) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-center">
        <button onClick={onGenerate} className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground">
          Generate this section
        </button>
      </div>
    );
  }
  if (state.loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted py-8 justify-center">
        <Loader2 size={16} className="animate-spin" /> Analysing primary sources...
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      {state.demo && (
        <span className="inline-block rounded-full bg-medium-bg px-2 py-0.5 text-[10px] font-semibold text-medium">
          demo mode
        </span>
      )}
      <MarkdownLite text={state.content} />
      {state.sourceRefs.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted">Sources</p>
          {state.sourceRefs.map((s, i) => (
            <p key={i} className="text-[11px] text-muted">
              {s.document}
              {s.period ? ` (${s.period})` : ""}
              {s.page ? `, p.${s.page}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function GuidanceSection({
  guidance,
  onGenerate,
}: {
  guidance: { items: GuidanceItem[]; demo: boolean; loading: boolean } | null;
  onGenerate: () => void;
}) {
  if (!guidance) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-center space-y-2">
        <p className="text-xs text-muted">What management promised vs. what was actually delivered.</p>
        <button onClick={onGenerate} className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground">
          Compare guidance vs. actuals
        </button>
      </div>
    );
  }
  if (guidance.loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted py-8 justify-center">
        <Loader2 size={16} className="animate-spin" /> Cross-referencing transcripts and results...
      </div>
    );
  }
  if (guidance.items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        {guidance.demo
          ? "No AI configured, or no primary sources ingested yet - nothing to compare."
          : "No explicit numerical guidance found in the ingested transcripts for this period."}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {guidance.items.map((g, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-3.5 space-y-1.5">
          <p className="text-sm font-semibold">{g.metric}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <p className="text-muted">Guided ({g.guidancePeriod})</p>
            <p className="text-right font-medium">{g.target || g.guidance}</p>
            <p className="text-muted">Actual</p>
            <p className="text-right font-medium">{g.actual}</p>
            <p className="text-muted">Gap</p>
            <p className={cn("text-right font-semibold", g.differencePct?.startsWith("-") ? "text-negative" : "text-positive")}>
              {g.differencePct}
            </p>
          </div>
          <p className="text-xs text-foreground/80 pt-1 border-t border-border">{g.interpretation}</p>
        </div>
      ))}
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-5 text-sm text-muted">Loading...</div>}>
      <ResearchView />
    </Suspense>
  );
}
