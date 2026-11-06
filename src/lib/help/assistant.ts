import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { APP_NAME } from "../product";
import { helpAsText } from "./articles";

// The help assistant: answers how-to questions about the groomer's app from the help articles,
// in the person's language. Needs ANTHROPIC_API_KEY in the server settings; without it the
// help center still works (articles and "talk to a person"), the chat box just says so.

export const assistantOn = () => !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

// The same text on every request, so the API serves it from the prompt cache.
const instructions = () => `You are the in-app help assistant of ${APP_NAME}, an app for mobile dog groomers: scheduling, a
booking page for clients, the day's route, checkout and receipts, automatic texts and email, team and reports.

Answer the groomer's question using only the help articles below. Give the exact screen and button names as they appear
in the articles (Settings → …), in short numbered steps, and nothing else. Two to six steps is usually right.
If the articles don't cover it, say plainly that you aren't sure and suggest the "Talk to a person" button on this page.
Never invent features, prices of the app, or settings that are not in the articles. Don't ask for passwords or card numbers.
Plain text only (no Markdown headings, tables or bold); numbered steps are fine.

# Help articles
${helpAsText()}`;

export type Turn = { role: "user" | "assistant"; text: string };

export async function askAssistant(question: string, history: Turn[], lang: string): Promise<string | null> {
  if (!assistantOn()) return null;
  const language = new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? "English";
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(-6).map((t) => ({ role: t.role, content: t.text.slice(0, 2000) })),
    { role: "user", content: question.slice(0, 2000) },
  ];
  try {
    const response = await anthropic().beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: instructions(), cache_control: { type: "ephemeral" } },
        { type: "text", text: `Answer in ${language}.` },
      ],
      messages,
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    return text || null;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.warn("help assistant: rate limited");
    else if (e instanceof Anthropic.APIError) console.error(`help assistant: API error ${e.status}`, e.message);
    else console.error("help assistant:", e);
    return null;
  }
}
