import type { Metadata } from "next";
import { APP_NAME } from "@/lib/product";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Terms of Service", description: `The terms for using ${APP_NAME}.` };

// A plain-language starting point. Have it reviewed by a lawyer for the countries you sell in.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="November 7, 2026">
      <p>These terms are an agreement between you (the business that signs up, and the people you invite) and {APP_NAME} (“we”). By creating an account you agree to them.</p>
      <h2>1. The service</h2>
      <p>{APP_NAME} is software for pet grooming businesses: scheduling, an online booking page for your clients, routes, messages, checkout, receipts and reports. Features can change as we improve the product; we will tell you before removing anything you rely on.</p>
      <h2>2. Your account</h2>
      <ul>
        <li>You must give accurate information and keep your password and PIN private.</li>
        <li>You are responsible for what happens in your account, including by team members you give a login to.</li>
        <li>You must be old enough to form a contract where you live.</li>
      </ul>
      <h2>3. Free trial, plans and payment</h2>
      <p>New accounts start with a free trial. After it, using the service needs a paid plan, billed monthly or yearly in advance through our payment provider. Plans renew automatically until you cancel. You can cancel anytime; you keep access until the end of the period you paid for. Except where the law says otherwise, payments are not refundable. If a payment fails, we may pause the account until it is paid; your data is kept.</p>
      <h2>4. Your data and your clients’ data</h2>
      <p>The information you put in {APP_NAME} (your clients, pets, visits, payments and messages) belongs to you. You are the one who collects it from your clients, so you are responsible for having the right to use it, including their consent to receive texts and emails. We process it only to run the service for you, as described in our Privacy Policy. You can export your client list at any time.</p>
      <h2>5. Messages to your clients</h2>
      <p>You choose which texts and emails are sent and their wording. You agree to follow the laws about messages where you work (for example, only texting clients who agreed to it, and honoring “STOP” and unsubscribe requests, which the app does for you).</p>
      <h2>6. Acceptable use</h2>
      <ul>
        <li>No unlawful, fraudulent or abusive use, and no spam.</li>
        <li>No attempts to break, overload, copy or resell the service.</li>
        <li>No uploading of content you don’t have the right to use.</li>
      </ul>
      <h2>7. Payments you take</h2>
      <p>{APP_NAME} records the payments you take from your clients (cash, card, transfers and others). It does not hold your money. Any card processing is between you and the processor you use.</p>
      <h2>8. Availability</h2>
      <p>We work to keep the service running and your data backed up, but we can’t promise it will never be interrupted. The app keeps your day available on your phone when there is no signal.</p>
      <h2>9. Ending the agreement</h2>
      <p>You can close your account anytime. We may suspend or close accounts that break these terms. After an account is closed we delete its data within a reasonable time, except what the law requires us to keep.</p>
      <h2>10. Liability</h2>
      <p>The service is provided “as is”. To the extent the law allows, we are not liable for indirect or lost-profit damages, and our total liability is limited to what you paid us in the 12 months before the claim.</p>
      <h2>11. Changes</h2>
      <p>We may update these terms. If a change is important, we will tell you in the app or by email before it applies.</p>
      <h2>12. Contact</h2>
      <p>Questions about these terms: use “Talk to a person” in the app’s Help.</p>
    </LegalPage>
  );
}
