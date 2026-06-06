import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What service fits my business?",
  "How much does branding cost?",
  "Can you manage my social media?",
  "How long does a project take?",
];

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Hi 👋 I'm SADA's AI assistant. Tell me about your business and I'll help you figure out the right service, ballpark pricing, and next steps.",
};

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last !== WELCOME && prev.length > next.length) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: next.filter((m) => m !== WELCOME).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        upsert(`⚠️ ${err.error || "Sorry, I couldn't reply right now."}`);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch {
      upsert("⚠️ Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open SADA AI assistant"
        className={`fixed bottom-5 right-5 z-50 size-14 rounded-full bg-gradient-primary text-white shadow-lg hover:scale-110 transition-all grid place-items-center neon-glow ${open ? "opacity-0 pointer-events-none scale-90" : "opacity-100"}`}
      >
        <MessageCircle className="size-6" />
        <span className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
      </button>

      {/* Panel */}
      <div
        className={`fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[400px] max-h-[640px] origin-bottom-right transition-all duration-300 ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
        }`}
      >
        <div className="rounded-3xl border border-border bg-card elevated-shadow flex flex-col overflow-hidden h-[640px] max-h-[80vh]">
          <header className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-primary/10 to-accent/10">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-gradient-primary grid place-items-center text-white">
                <Sparkles className="size-4" />
              </div>
              <div>
                <div className="text-sm font-bold">SADA Assistant</div>
                <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Online
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg hover:bg-muted"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </header>

          <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-gradient-primary text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-3 inline-flex items-center gap-2 text-sm">
                  <Loader2 className="size-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-5 pb-2 grid grid-cols-2 gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs text-left px-3 py-2 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border p-3 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about services, pricing, timelines…"
              className="flex-1 bg-muted/60 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="size-10 rounded-xl bg-gradient-primary text-white grid place-items-center disabled:opacity-50 hover:scale-105 transition-transform"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
