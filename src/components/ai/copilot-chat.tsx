"use client";

import * as React from "react";
import { ArrowUp, Bot, Loader2, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

export function CopilotChat({
  suggestions,
  available,
  modelLabel,
}: {
  suggestions: string[];
  available: boolean;
  modelLabel: string;
}) {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      role: "assistant",
      content:
        "Halo! Saya AI HR Copilot NexaHR. Saya dapat menjelaskan kebijakan, merangkum tren kehadiran, memeriksa kelengkapan data, dan membantu navigasi. Saya tidak dapat menyetujui atau mengubah data atas nama Anda.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [conversationId, setConversationId] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, conversationId }),
      });
      const payload = (await res.json()) as { data?: { reply: string; conversationId: string }; error?: { message: string } };
      if (!res.ok || !payload.data) {
        setMessages((prev) => [...prev, { role: "assistant", content: payload.error?.message ?? "Maaf, terjadi kesalahan." }]);
        return;
      }
      setConversationId(payload.data.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", content: payload.data!.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Tidak dapat menghubungi server. Coba lagi." }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[420px] flex-col rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-3.5" />
          </span>
          <div>
            <p className="text-[13px] font-semibold">AI HR Copilot</p>
            <p className="text-[10px] text-muted-foreground">{modelLabel}</p>
          </div>
        </div>
        <Badge variant={available ? "success" : "warning"} dot>
          {available ? "Model terhubung" : "Mode lokal"}
        </Badge>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div key={index} className={cn("flex gap-2.5", message.role === "user" && "flex-row-reverse")}>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md",
                message.role === "assistant" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {message.role === "assistant" ? <Bot className="size-3.5" /> : <UserRound className="size-3.5" />}
            </span>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12px] leading-relaxed",
                message.role === "assistant" ? "bg-muted/60 text-foreground" : "bg-primary text-primary-foreground",
              )}
            >
              {message.content}
            </div>
          </div>
        ))}
        {pending ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Menyusun jawaban…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
          {suggestions.slice(0, 4).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="rounded-md border border-border bg-card px-2 py-1 text-left text-[10px] text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          placeholder="Tanyakan kebijakan cuti, tren kehadiran, atau proses payroll…"
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-[12px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
          aria-label="Pesan untuk AI HR Copilot"
        />
        <Button type="submit" size="icon" disabled={pending || input.trim().length < 2} aria-label="Kirim pesan">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
