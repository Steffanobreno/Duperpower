"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n";
import { Button, Textarea } from "@/components/ui";
import { askHelpAction, rateAnswerAction, talkToPersonAction } from "./actions";

type Turn = { role: "user" | "assistant"; text: string; id?: string; rated?: boolean };

/** Ask the assistant, in the person's language; answers come from the help articles. */
export function HelpChat({ available }: { available: boolean }) {
  const { t, serverMessage } = useT();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  const ask = () => {
    const q = question.trim();
    if (q.length < 3 || pending) return;
    setError(null);
    const history = turns.map(({ role, text }) => ({ role, text }));
    setTurns((x) => [...x, { role: "user", text: q }]);
    setQuestion("");
    start(async () => {
      const res = await askHelpAction(q, history);
      if (res.answer) setTurns((x) => [...x, { role: "assistant", text: res.answer!, id: res.id }]);
      else setError(serverMessage(res.error ?? ""));
      requestAnimationFrame(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    });
  };

  return (
    <section aria-label={t("Ask the assistant")} className="card space-y-3 p-4">
      <h2 className="text-lg font-extrabold">💬 {t("Ask the assistant")}</h2>
      <p className="text-sm text-muted">
        {available ? t("Ask how to do anything in the app, in your own words and language.") : t("The assistant isn't set up yet. The articles below cover every part of the app.")}
      </p>
      {turns.length > 0 && (
        <ol className="space-y-2" aria-live="polite">
          {turns.map((m, i) => (
            <li key={i} className={m.role === "user" ? "ml-8 rounded-2xl bg-brand-soft px-3 py-2" : "mr-4 rounded-2xl border border-line bg-bg px-3 py-2"}>
              <p className="whitespace-pre-line text-sm">{m.text}</p>
              {m.role === "assistant" && m.id && !m.rated && (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                  {t("Did this help?")}
                  {[true, false].map((yes) => (
                    <button key={String(yes)} type="button" className="rounded-full border border-line px-2 py-0.5 font-semibold"
                      onClick={() => { void rateAnswerAction(m.id!, yes); setTurns((x) => x.map((y, j) => (j === i ? { ...y, rated: true } : y))); }}>
                      {yes ? `👍 ${t("Yes")}` : `👎 ${t("No")}`}
                    </button>
                  ))}
                </p>
              )}
            </li>
          ))}
          {pending && <li className="mr-4 rounded-2xl border border-line bg-bg px-3 py-2 text-sm text-muted">{t("Thinking…")}</li>}
        </ol>
      )}
      <div ref={end} />
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      {available && (
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="space-y-2">
          <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={2000}
            aria-label={t("Your question")} placeholder={t("Example: how do I charge more for big dogs?")}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
          <Button type="submit" className="w-full" disabled={pending || question.trim().length < 3}>{t("Ask")}</Button>
        </form>
      )}
    </section>
  );
}

/** "Talk to a person": a message to the app's support team, answered by email. */
export function TalkToPerson() {
  const { t, serverMessage } = useT();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(talkToPersonAction, undefined);
  if (state?.sent) return <p className="card p-4 text-sm font-semibold text-success">✓ {t("Sent. We'll answer by email, usually within a day.")}</p>;
  if (!open) return <Button kind="secondary" className="w-full" onClick={() => setOpen(true)}>🙋 {t("Talk to a person")}</Button>;
  return (
    <form action={action} className="card space-y-2 p-4">
      <label className="block space-y-1">
        <span className="font-semibold">{t("What do you need help with?")}</span>
        <Textarea name="message" rows={4} required maxLength={4000} />
      </label>
      {state?.error && <p role="alert" className="text-sm text-danger">{serverMessage(state.error)}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? t("Sending…") : t("Send")}</Button>
    </form>
  );
}
