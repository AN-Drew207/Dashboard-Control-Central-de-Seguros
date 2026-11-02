"use client";

import { Send, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RequirePermission } from "@/components/layout/AppShell";
import { Card, cn } from "@/components/ui/primitives";
import { useDb } from "@/context/DataContext";
import { answerQuestion, SUGGESTED_QUESTIONS, type AssistantReply } from "@/lib/domain/assistant";

interface Message extends AssistantReply {
  id: number;
  from: "user" | "assistant";
}

function Assistant() {
  const { db, today } = useDb();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      from: "assistant",
      text: "Hola, soy tu asistente de cartera. Pregúntame por tus números, tus clientes o qué cubre una póliza.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  function ask(question: string) {
    if (!question.trim() || thinking) return;
    nextId.current += 2;
    const id = nextId.current;
    setMessages((m) => [...m, { id, from: "user", text: question }]);
    setInput("");
    setThinking(true);
    // Simulated response latency, like a real model call.
    setTimeout(() => {
      setMessages((m) => [...m, { id: id + 1, from: "assistant", ...answerQuestion(db, today, question) }]);
      setThinking(false);
    }, 600);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-headline-md sm:text-display-lg">
          <Sparkles className="size-7 text-primary" /> Asistente de cartera
        </h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Conclusiones e ideas basadas en tus datos. En la demo responde con reglas sobre la información local.
        </p>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.from === "user" && "flex-row-reverse")}>
              <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", m.from === "user" ? "bg-surface-container-highest" : "bg-primary-container/20 text-primary")}>
                {m.from === "user" ? <UserRound className="size-4" /> : <Sparkles className="size-4" />}
              </div>
              <div className={cn("max-w-[85%] rounded-lg px-4 py-3 text-body-md", m.from === "user" ? "bg-primary-container/20 text-on-surface" : "border border-outline-variant bg-surface-container")}>
                <p className="whitespace-pre-line">{m.text}</p>
                {m.links && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.links.map((l) => (
                      <Link key={l.href} href={l.href} className="rounded border border-primary/30 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                        {l.label} →
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex items-center gap-2 pl-11 text-body-sm text-on-surface-variant">
              <span className="size-2 animate-pulse rounded-full bg-primary" /> Analizando tu cartera...
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-outline-variant p-3">
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {SUGGESTED_QUESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="whitespace-nowrap rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant hover:border-primary hover:text-primary cursor-pointer">
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ej: ¿Qué cubre la póliza de ${db.clients[0]?.name.split(" ").slice(0, 2).join(" ")}?`}
              className="input-base"
            />
            <button type="submit" disabled={!input.trim() || thinking} className="rounded bg-primary px-4 text-on-primary disabled:opacity-50 cursor-pointer" aria-label="Enviar">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <RequirePermission permission="useAssistant">
      <Assistant />
    </RequirePermission>
  );
}
