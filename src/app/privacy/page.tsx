import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { APP_NAME } from "@/lib/product";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Privacy Policy", description: `How ${APP_NAME} handles your information.` };

const Mail = () => <a href={`mailto:${LEGAL.supportEmail}`} className="underline">{LEGAL.supportEmail}</a>;

// A plain-language base for a lawyer to review for the laws of the countries we sell in (for
// example GDPR in Europe, LGPD in Brazil, CCPA in California). Not legal advice. Every statement
// must match the code: the subprocessors, cookies and what the export holds were checked in it.
export default function PrivacyPage() {
  return (
    <LegalPage path="/privacy" title="Privacy Policy" updated={LEGAL.termsVersion}>
      <p>This policy explains what {APP_NAME} collects, why, who receives it and the choices you have. It covers the groomers and team members who use the app (“you”), and the pet owners who book with a business that uses {APP_NAME} (“clients”). {APP_NAME} is run by {LEGAL.company}, {LEGAL.address} (“we”).</p>

      <h2>Who controls what</h2>
      <ul>
        <li><b>Your account:</b> for the information about you and your business, and for billing, we decide how it is used. We are the controller.</li>
        <li><b>Your clients’ information:</b> the business decides what it collects about its clients and why. The business is the controller and we process that information on its behalf, only to run the service for it. Clients with questions about their data should contact the business they booked with; we will help the business answer.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li><b>Your account:</b> name, email, password (stored only as a secure hash), your optional PIN (also hashed), business details, language and settings, and your team members’ names and logins.</li>
        <li><b>Your business data:</b> clients, pets, visits, services, prices, payments you record, notes, photos, messages, campaigns and the agreements your clients sign.</li>
        <li><b>From clients who book:</b> name, phone, email, address, pet details, whether they agreed to receive texts and when, and the agreement they sign (typed name, drawn signature, date and IP address). If someone starts a booking and doesn’t finish it, the details typed so far are kept so the business can follow up.</li>
        <li><b>Billing:</b> your plan and payment status. Card details go straight to Stripe; we don’t see or store them.</li>
        <li><b>Help:</b> the questions you ask the help assistant, its answers, and messages you send with “Talk to a person”.</li>
        <li><b>Usage and security:</b> when the app was last used, login attempts, and the technical logs our hosting keeps (such as IP addresses).</li>
      </ul>

      <h2>What we use it for</h2>
      <ul>
        <li>To run the service: booking, reminders, routes, checkout, receipts, reports and email campaigns.</li>
        <li>To bill paid plans and run the referral program.</li>
        <li>To support you, including the optional help assistant. A small number of people at {LEGAL.company} can see account data when needed for support, billing or security.</li>
        <li>To keep the service secure, prevent abuse, and fix and improve it.</li>
        <li>To email you about your account: the trial, charges and renewal reminders, and important changes.</li>
      </ul>

      <h2>Legal bases (GDPR and LGPD)</h2>
      <ul>
        <li><b>Contract:</b> to provide the service and bill your plan.</li>
        <li><b>Legitimate interests:</b> security, preventing abuse, support, improving the service, and the “Online booking by Fino” line described below.</li>
        <li><b>Legal obligation:</b> keeping billing and tax records.</li>
        <li><b>Your clients’ information:</b> we process it on the business’s instructions. The business is responsible for having a legal basis for it, such as its client’s consent to receive texts.</li>
      </ul>

      <h2>The “Online booking by Fino” line</h2>
      <p>The pages a business’s clients open (booking, signing, visit reports, unsubscribe) and the emails sent to them include a small “Online booking by Fino” line, linking to {APP_NAME} with the business’s referral code, so other groomers can discover {APP_NAME}. That line is the only {APP_NAME} promotion clients see. It doesn’t add any data about the client, and we never use clients’ details to contact them on {APP_NAME}’s behalf.</p>

      <h2>Subprocessors</h2>
      <p>These providers receive personal information to help run the service, under their own terms and privacy commitments:</p>
      <ul>
        <li><b>Neon</b> (Postgres database): stores all account and business data, including photos.</li>
        <li><b>Netlify</b> (hosting): runs the app and keeps request logs, including IP addresses.</li>
        <li><b>Resend</b> or <b>Google (Gmail)</b> (email delivery): the recipient’s address and the content of each email.</li>
        <li><b>Google Maps</b> (address search, maps and routes): addresses typed into the app and on booking pages, and visit locations for routes. Use of Google Maps is subject to Google’s terms and privacy policy.</li>
        <li><b>OpenStreetMap</b> (map images, when Google’s map isn’t used): the IP address of the browser that shows the map.</li>
        <li><b>Anthropic</b> (the optional help assistant): the questions you type and the conversation so far.</li>
        <li><b>Stripe</b> (billing): your name, email, business name and payment details.</li>
        <li><b>Google Drive</b> (the optional weekly backup): if you turn it on in Settings → Backups, a copy of your data is saved to your own Google Drive.</li>
      </ul>
      <p>Texts to your clients are sent from your own phone, through its messaging app, and replies reach your phone; we don’t receive them. Emails to your clients go out from our sending address with your business’s name, so a client’s reply to one of them can reach our mailbox. If you subscribe to your calendar in Google or Apple Calendar, or turn on notifications, those services receive your visits or the notification text.</p>

      <h2>International transfers</h2>
      <p>Most of our providers are based in the United States, so your information may be processed there and in other countries with different data protection laws. Where the law requires a safeguard for these transfers, we rely on one, such as standard contractual clauses.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>While your account exists, we keep its data, including after a trial or plan ends, so you can come back to it.</li>
        <li>To close your account, email <Mail />. We delete its data within 30 days of the request. Copies in our database backups are gone within 35 days after that, as the backups rotate.</li>
        <li>We keep billing records for as long as tax and accounting laws require.</li>
      </ul>

      <h2>Children</h2>
      <p>{APP_NAME} is a tool for businesses, used by adults. It is not directed at children, and we don’t knowingly collect information from children under 13 (or under 16 in the European Union).</p>

      <h2>Cookies and browser storage</h2>
      <p>We use only what the app needs to work. There are no advertising or analytics cookies.</p>
      <ul>
        <li><b>wds_session</b> (cookie): keeps you logged in, for up to 60 days.</li>
        <li><b>lang</b> (cookie): remembers the language you picked, for up to a year.</li>
        <li><b>woofers:unlocked-at</b> (session storage): remembers when you last unlocked the app with your PIN. It is cleared when you close the tab.</li>
        <li><b>woofers-google-map-refused</b> (session storage): notes that Google’s map couldn’t load, so the app shows the OpenStreetMap map for the rest of the visit.</li>
        <li>The app also saves pages on your device so your day is available without a signal.</li>
      </ul>
      <p>Google Maps and OpenStreetMap load their maps from their own servers, under their own policies.</p>

      <h2>Your rights and how to use them</h2>
      <ul>
        <li>Depending on where you live, you can ask to see, correct, export or delete your information, to object to or limit some uses of it, and to complain to your data protection authority.</li>
        <li>You can correct most information yourself in the app, and download your data in Settings → Backups: your clients as a spreadsheet, and a file with your clients, pets, visits, payments and settings. Pet photos and drawn signatures are not in the download yet.</li>
        <li>For anything else, email <Mail />. We may need to confirm it’s you before we act.</li>
        <li>Clients: contact the business you booked with. Marketing emails have an unsubscribe link. Texts come from the groomer’s own phone: a “STOP” reply reaches the groomer, who then turns off texts for you in the app.</li>
      </ul>

      <h2>Security</h2>
      <p>Connections are encrypted, passwords and PINs are hashed, and an optional PIN locks the app on your phone. No system is perfectly secure; if a breach affects your information, we will tell you as the law requires.</p>

      <h2>Contact and data protection officer</h2>
      <p>{LEGAL.company}, {LEGAL.address}. Email: <Mail />. Data protection officer: {LEGAL.dpo}.</p>

      <h2>We don’t sell personal information</h2>
      <p>We don’t sell or rent personal information, and we don’t share it for advertising.</p>

      <h2>Changes to this policy</h2>
      <p>The date at the top shows the current version. If we make an important change, we will tell you by email or in the app before it applies.</p>
    </LegalPage>
  );
}
