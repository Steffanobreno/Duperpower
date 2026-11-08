import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { APP_NAME } from "@/lib/product";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Terms of Service", description: `The terms for using ${APP_NAME}.` };

const Mail = () => <a href={`mailto:${LEGAL.supportEmail}`} className="underline">{LEGAL.supportEmail}</a>;

// A plain-language base for a lawyer to review for the countries we sell in. Not legal advice.
// Every promise here must match what the code does. The bracketed placeholders come from
// src/lib/legal.ts and stay visible until the company exists.
export default function TermsPage() {
  return (
    <LegalPage path="/terms" title="Terms of Service" updated={LEGAL.termsVersion}>
      <p>These terms are an agreement between the business that signs up for {APP_NAME} (“you”) and {LEGAL.company} (“we”, “us”). By creating an account, or by choosing a paid plan, you agree to them and to our <a href="/privacy" className="underline">Privacy Policy</a>.</p>

      <h2>1. Who we are</h2>
      <p>{APP_NAME} is run by {LEGAL.company}, {LEGAL.address}. You can reach us at <Mail />. {APP_NAME} is software for pet grooming businesses: scheduling, an online booking page for your clients, routes, reminders, checkout, receipts, reports and email campaigns.</p>

      <h2>2. Business use only</h2>
      <p>{APP_NAME} is sold to businesses and self-employed groomers for use in their work, not for personal or household use. The person who signs up confirms that they are old enough to form a contract where they live and that they can accept these terms for the business.</p>

      <h2>3. Your account and your team</h2>
      <ul>
        <li>Give accurate information and keep your password and PIN private.</li>
        <li>You can give team members their own login. You are responsible for what happens in your account, including what your team members do.</li>
        <li>To close your account, email <Mail /> from the account’s email address. Before you do, you can download your data in Settings → Backups (see “Your clients’ data”).</li>
        <li>We may suspend or close an account that breaks these terms. Where we reasonably can, we will tell you first and give you a chance to fix the problem.</li>
      </ul>

      <h2>4. Free trial, plans, renewal and cancellation</h2>
      <ul>
        <li><b>Free trial.</b> New accounts get a 14-day free trial. No card is needed to start it.</li>
        <li><b>Plans.</b> After the trial, using the app needs a paid plan for the whole business: US$29 a month or US$290 a year, charged in US dollars in advance through our payment provider, Stripe. When you choose a plan, you are asked to accept these terms and the automatic renewal.</li>
        <li><b>Choosing a plan during the trial.</b> If more than 48 hours of the trial are left when you choose a plan, the first charge is on the day the trial ends. If 48 hours or less are left, the first charge is on the day you choose the plan. If you chose a plan during the trial, we email you a reminder before the first charge, with its date and amount.</li>
        <li><b>Automatic renewal.</b> Plans renew automatically at the end of each month or year, at the price of your plan, until you cancel. Before a yearly plan renews, we email you a reminder with the renewal date and amount.</li>
        <li><b>Cancelling.</b> You can cancel anytime on the Plan page (“Manage billing”), without contacting us. You keep access until the end of the period you already paid for, and the plan does not renew after that.</li>
        <li><b>When the trial or a plan ends.</b> If no plan is active, the app opens only the Plan page and your online booking page pauses. Your data stays saved and comes back when you choose a plan.</li>
        <li><b>Failed payments.</b> If a payment fails, our payment provider retries it and we ask you to update your card. If it can’t be collected after the retries, the plan may be cancelled, and the app then opens only the Plan page.</li>
      </ul>

      <h2>5. Refunds</h2>
      <ul>
        <li><b>Monthly plans:</b> no refunds. When you cancel, the plan runs to the end of the month you paid for.</li>
        <li><b>Yearly plans:</b> if you ask within 14 days of a yearly charge, we refund a prorated amount for the unused part of the year. To ask, email <Mail /> from the account’s email address. Refunds are handled by hand, so allow a few business days.</li>
        <li>After those 14 days, a yearly plan is not refunded and runs to the end of the year you paid for.</li>
        <li>Where a law gives you a right to a refund that these terms don’t, that law applies.</li>
      </ul>

      <h2>6. Referrals and discount codes</h2>
      <ul>
        <li>Every business has a referral link and code. A business that signs up with your link, or types your code on the Plan page before it has a plan, gets its first month free: US$29 off its first bill, once.</li>
        <li>When the business you referred makes its first payment, you get US$29 of credit, once per referred business. The credit is taken off your next bills by our payment provider. It has no cash value, can’t be transferred and isn’t paid out.</li>
        <li>You can’t refer your own business, and a business can only be referred once.</li>
        <li>Discount codes can have an end date and a limit on how many times they can be used. One code applies per plan; a discount code you type replaces the referral discount, and they don’t add up.</li>
        <li>We may change or end the referral program or a discount code at any time. Credit you already earned stays on your account.</li>
      </ul>

      <h2>7. Taxes</h2>
      <p>Prices don’t include taxes. Where the law requires us to charge sales tax, VAT or a similar tax, we add it to the bill. You are responsible for your own taxes.</p>

      <h2>8. Price changes</h2>
      <p>We may change our prices. We will email you at least 30 days before a new price applies to you, and it applies from your next renewal after that notice. If you don’t want to pay the new price, you can cancel before the renewal.</p>

      <h2>9. Your clients’ data</h2>
      <ul>
        <li>The information you put in {APP_NAME} about your clients (names, contact details, addresses, pets, visits, payments, notes, photos and messages) is yours. You decide what is collected and why; we process it only to run the service for you, as our Privacy Policy describes. For that data you are the controller and we are your processor.</li>
        <li>You collect this data from your clients, so you are responsible for having the right to use it, including their permission to receive texts and emails.</li>
        <li>Your booking page, the other pages your clients open and the emails sent to your clients show a small line, “Online booking by Fino · free trial for groomers”, with your referral link. It tells other groomers about {APP_NAME}; it doesn’t share your clients’ details with anyone.</li>
        <li>You can download your data while your account is open, in Settings → Backups: your clients as a spreadsheet, and a backup file with your clients, pets, visits, payments, services, settings and the last year of messages. Pet photos and drawn signatures are not in the download yet (the typed name and date of each signature are). If you can’t reach the app, email us and we will send you a copy.</li>
      </ul>

      <h2>10. Agreement and message templates</h2>
      <p>{APP_NAME} comes with example texts: a service agreement for your clients to sign, reminders, emails and campaign templates. They are only examples to start from, not legal advice. You are responsible for their content and for checking that they fit the laws where you work.</p>

      <h2>11. Messaging laws</h2>
      <ul>
        <li>You choose who gets texts and emails and what they say, and you must follow the laws about messages where you work (in the US, for example, the TCPA for texts and CAN-SPAM for emails). Only text clients who agreed to it.</li>
        <li>Texts go out from your own phone, so replies, including “STOP”, reach your phone and not the app. The app does not read replies. When a client asks to stop getting texts, you must turn on “Block messages” on that client’s page in the app; the app then stops its automatic texts to them.</li>
        <li>Marketing emails include an unsubscribe link, and the app stops sending campaigns to clients who use it. Campaigns need your business’s mailing address.</li>
      </ul>

      <h2>12. Acceptable use</h2>
      <ul>
        <li>No unlawful, fraudulent or abusive use, and no spam.</li>
        <li>No attempts to break, overload, copy, reverse-engineer or resell the service.</li>
        <li>No uploading of content you don’t have the right to use.</li>
      </ul>

      <h2>13. Payments you take from your clients</h2>
      <p>{APP_NAME} records the payments you take from your clients (cash, card, transfers and others). It does not hold your money or process your clients’ cards. Any card processing is between you and the processor you use.</p>

      <h2>14. Availability</h2>
      <p>We work to keep the service running, but we can’t promise it will never be interrupted or free of errors. The app keeps your day on your phone when there is no signal, but changes made offline can be lost if the phone is lost or its data is cleared. We improve the product over time, so features can change; we will make reasonable efforts to tell you before important changes.</p>

      <h2>15. Disclaimer of warranties and limitation of liability</h2>
      <p><b>To the extent the law allows, the service is provided “as is” and “as available”, without warranties of any kind, express or implied, including fitness for a particular purpose.</b> We are not responsible for the messages you send, for routes, drive times or addresses from map providers, or for decisions you make based on the app.</p>
      <p><b>To the extent the law allows, we are not liable for indirect, incidental or consequential damages or lost profits, and our total liability for any claim is limited to the greater of what you paid us in the 12 months before the claim and US$100.</b></p>

      <h2>16. Indemnification</h2>
      <p>You agree to defend and compensate us for claims, losses and costs (including reasonable legal fees) that come from your use of the service in breach of these terms or of the law, including texts or emails you send, the data you collect from your clients, and content you upload.</p>

      <h2>17. Changes to these terms</h2>
      <p>We may update these terms. The date at the top shows the current version. If a change is important, we will tell you by email or in the app before it applies. If you keep using the service after that, the new terms apply; if you don’t agree, you can cancel.</p>

      <h2>18. Governing law and venue</h2>
      <p>These terms are governed by the law of {LEGAL.jurisdiction}, and disputes go to the courts of {LEGAL.jurisdiction}, except where the law where you are says otherwise.</p>

      <h2>19. Assignment, entire agreement and severability</h2>
      <p>You may not transfer this agreement without our written consent. We may transfer it as part of a merger, acquisition or sale of our business, and we will tell you if we do. These terms and the Privacy Policy are the whole agreement between you and us about the service. If a court finds part of these terms unenforceable, the rest still applies.</p>

      <h2>20. Notices</h2>
      <p>We send notices to the email address of the account owner, or show them in the app. Notices by email count as received when sent. You send notices to us at <Mail />.</p>

      <h2>21. Contact</h2>
      <p>{LEGAL.company}, {LEGAL.address}. Email: <Mail />. You don’t need an account to write to us.</p>
    </LegalPage>
  );
}
