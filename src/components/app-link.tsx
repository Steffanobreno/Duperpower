import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * The app's links (not the public site's): no prefetch by default. Next.js would otherwise ask
 * the server for every link on screen as soon as it shows (Today alone has ~35: each day of the
 * week, each tab, each setting). On serverless hosting each of those wakes its own server and
 * queries the database, so a tap right after opening the app waited behind them. The tap
 * itself shows the top progress bar (NavProgress) and the screen's loading state at once.
 * Pass prefetch to opt in (the tab bar does, for its few tabs).
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
