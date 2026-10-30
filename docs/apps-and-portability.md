# App Store, Google Play and other platforms

How Woofers gets onto phones as a real app, and how it can move off Node.js later.

## Where it is today

- **It's an installable web app (PWA).** On iPhone: Safari → Share → *Add to Home Screen*. On Android: Chrome → *Install app*. It opens full screen with its own icon. Notifications already work, because the app has a manifest, push notifications and the app lock (PIN).
- **One code base.** The owner app, the booking page, the client links and receipts are a single Next.js project.
- **The data is plain Postgres.** All of it lives in Postgres and is defined by the SQL files in `db/migrations`. No ORM and no vendor lock-in.

## Getting into the App Store and Google Play

The recommended path is **Capacitor**, a native shell around the same app. The steps are:

1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`, then `npx cap init "Woofers" com.woofersdogspa.app`.
2. Point the shell at the live site (`server.url` in `capacitor.config.ts`). The store app then always shows the latest version, with no store update for each change.
3. Add the native pieces Apple asks for. Apple's guideline 4.2 rejects apps that are "just a website", so the app needs real native features:
   - Native push (APNs on iPhone, FCM on Android), with the `@capacitor/push-notifications` plugin, sent from `src/lib/push.ts` next to web push.
   - Face ID / fingerprint for the app lock (a biometric plugin) instead of only the PIN.
   - The camera for pet photos, and the share sheet for receipts and the QR code (already used by the web app).
4. Build:
   - iOS: `npx cap add ios && npx cap open ios`, archive in Xcode, then upload to App Store Connect.
   - Android: `npx cap add android`, build the bundle in Android Studio, then upload to the Play Console.

What you need:
- A Mac with Xcode (or a cloud Mac).
- An Apple Developer account at $99 a year.
- A Google Play developer account, a one-time $25.
- A privacy policy page.
- Screenshots.

The booking page stays on the web. Clients don't install anything: they book from the link, the QR code or the website.

## Selling it to other businesses

Every table already carries `business_id`, and every query filters by it, so the data model is multi-business. Still missing:

- **Sign-up for a new business.** Today, `/setup` creates only the first owner.
- **Billing.** For example a monthly Stripe subscription per business.
- **The business picked from the address.** The booking page, `/intake` and the cron jobs read "the first business". They need to pick it from the domain or the booking link (`businesses.booking_slug` already exists).
- **The rest of the Woofers name.** The default logo artwork and the client-page footer text still say Woofers. The name, logo and links are already per business (Settings → Business).

## Moving off Node.js

The parts are separable:

- **Database.** These are standard SQL migrations. Any language (Go, Python, Rust, Elixir…) can use the same Postgres.
- **Business rules.**
  - Each rule lives in one small module under `src/lib`: online booking times in `booking.ts`, messages in `messaging.ts`, receipts in `receipt-pdf.ts` and permissions in `permissions.ts`.
  - Each module is a few hundred lines, so it can be ported one at a time.
- **Screens.** The pages call the database through server actions. The next step is a small JSON API (`/api/v1/...`) over the same modules. Native apps or another back end can then talk to it, and the web pages keep working as they are.
- **Hosting.** The app runs anywhere Node runs: Netlify today, or Vercel, Fly.io, Render, a VPS or Docker. Postgres can be any host: Neon, Supabase, RDS…
