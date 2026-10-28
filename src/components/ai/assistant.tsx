"use client";

import { useState } from "react";
import { Bot, Lock, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/forms/fields";
import { DemoOutputView, type DemoOutput } from "./demo-output";

/** Operational Assistant demo: suggested questions answered from deterministic fixtures. Free text needs the model, so it is off. */
export function Assistant({ answers }: { answers: (DemoOutput & { question: string; questionId: string })[] }) {
  const [asked, setAsked] = useState<string[]>([]);
  const ask = (id: string) => setAsked((xs) => [id, ...xs.filter((x) => x !== id)]);
  const latest = answers.find((a) => a.questionId === asked[0]);
  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 text-label text-ink-3">Suggested questions</p>
        <div className="flex flex-wrap gap-2">
          {answers.map((a) => (
            <button key={a.questionId} type="button" onClick={() => ask(a.questionId)} aria-pressed={asked[0] === a.questionId}
              className={cn("rounded-full px-3.5 py-1.5 text-label transition-colors", asked[0] === a.questionId ? "bg-pill text-pill-ink" : "bg-surface-2 text-ink-2 ring-1 ring-line hover:text-ink")}>
              {a.question}
            </button>
          ))}
        </div>
      </div>
      <div aria-live="polite">
        {latest ? (
          <div key={latest.questionId} className="animate-enter grid gap-3">
            <p className="ml-auto max-w-[85%] rounded-[18px] rounded-br-[6px] bg-pill px-4 py-2.5 text-body text-pill-ink">{latest.question}</p>
            <div className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 ring-1 ring-line" aria-hidden><Bot className="size-4" /></span>
              <div className="min-w-0 flex-1 rounded-[18px] rounded-tl-[6px] border border-line bg-surface p-4"><DemoOutputView output={latest} /></div>
            </div>
          </div>
        ) : (
          <p className="rounded-tile border border-dashed border-line-strong px-4 py-6 text-center text-label text-ink-3">Pick a question to see the answer and the records it is based on.</p>
        )}
      </div>
      <form className="flex gap-2" onSubmit={(e) => e.preventDefault()} aria-describedby="assistant-off">
        <Input disabled placeholder="Ask anything about stock, orders or invoices…" aria-label="Ask the assistant (not available)" />
        <Button disabled aria-label="Send"><SendHorizontal /></Button>
      </form>
      <p id="assistant-off" className="-mt-2 flex items-center gap-1.5 text-[12px] text-ink-3"><Lock className="size-3.5" aria-hidden />Free-text questions need the AI model, which is not connected. Nothing you type would leave this app.</p>
    </div>
  );
}
