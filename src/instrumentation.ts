import type { Instrumentation } from "next";

// Every server error (pages, server actions, API routes) goes to /admin → Erros and, the first
// time, an email to the app owner. See src/lib/error-log.ts.
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : null;
  // "Not found" and redirects travel as errors inside Next.js; they aren't problems.
  if (digest?.startsWith("NEXT_")) return;
  try {
    const { logServerError } = await import("./lib/error-log");
    await logServerError(message, request.path, digest);
  } catch (e) {
    console.error("could not log the error", e);
  }
};
