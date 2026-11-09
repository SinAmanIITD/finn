"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { MarkdownLite } from "@/components/MarkdownLite";
import { cn } from "@/lib/cn";

type Company = { ticker: string; name: string };

type Message = {
  role: "user" | "assistant";
  text: string;
  sources?: { document: string; period: string | null; page: number | null }[];
  demo?: boolean;
};

const SUGGESTIONS = [
  "Why did margins change recently?",
  "Is revenue growth supported by cash flow?",
  "What did management promise last year?",
  "Give me the bull and bear case.",
];

export default function ChatPage() {
  const [ticker, setTicker] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/companies?portfolio=false").then((r) => r.json()).then((d) => setCompanies(d.companies));
    // Read directly instead of useSearchParams(): on a cold production load
    // that hook's hydration can resolve too late for a useState initializer
    // to pick up, leaving the ticker unselected - see research/page.tsx.
    const initial = new URLSearchParams(window.location.search).get("ticker");
    if (initial) setTicker(initial);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || !ticker) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setSending(true);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, question: text }),
    }).then((r) => r.json());
    setMessages((m) => [...m, { role: "assistant", text: res.answer ?? res.error ?? "Something went wrong.", sources: res.sources, demo: res.demo }]);
    setSending(false);
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-60px)] px-4 pt-5">
      <header className="mb-3">
        <h1 className="text-xl font-bold tracking-tight">Ask FINN</h1>
        <p className="text-xs text-muted">Grounded answers from primary sources, with citations.</p>
      </header>

      <select
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        className="mb-3 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
      >
        <option value="">Select a company...</option>
        {companies.map((c) => (
          <option key={c.ticker} value={c.ticker}>
            {c.ticker} - {c.name}
          </option>
        ))}
      </select>

      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {messages.length === 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-muted">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={!ticker}
                className="block w-full text-left rounded-xl border border-border bg-surface px-3 py-2.5 text-sm disabled:opacity-40"
              >
                {s}
              </button>
            ))}
            {!ticker && <p className="text-xs text-medium pt-1">Pick a company above first.</p>}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                m.role === "user" ? "bg-accent text-accent-foreground" : "bg-surface border border-border"
              )}
            >
              {m.role === "user" ? (
                m.text
              ) : (
                <>
                  {m.demo && (
                    <span className="inline-block mb-1.5 rounded-full bg-medium-bg px-2 py-0.5 text-[10px] font-semibold text-medium">
                      demo mode
                    </span>
                  )}
                  <MarkdownLite text={m.text} />
                  {m.sources && m.sources.length > 0 && (
                    <div className="border-t border-border mt-2 pt-1.5 space-y-0.5">
                      {m.sources.map((s, j) => (
                        <p key={j} className="text-[10px] text-muted">
                          {s.document}
                          {s.period ? ` (${s.period})` : ""}
                          {s.page ? `, p.${s.page}` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={14} className="animate-spin" /> Reading primary sources...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border pt-3 pb-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ticker ? "Ask about this company..." : "Select a company first"}
          disabled={!ticker}
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!ticker || !input.trim() || sending}
          className="flex items-center justify-center h-10 w-10 shrink-0 rounded-full bg-accent text-accent-foreground disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
