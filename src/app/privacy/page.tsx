import type { Metadata } from "next";
import { APP_NAME } from "@/lib/product";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Privacy Policy", description: `How ${APP_NAME} handles your information.` };

// A plain-language starting point. Have it reviewed for the laws of the countries you sell in
// (for example GDPR in Europe, LGPD in Brazil, CCPA in California).
export default function PrivacyPage() {
  return (
    <LegalPage path="/privacy" title="Privacy Policy" updated="November 7, 2026">
      <p>This policy explains what {APP_NAME} collects, why, and the choices you have. It covers the business owners and team members who use the app, and the pet owners who book through a business’s page.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Your account:</b> name, email, password (stored only as a secure hash), business details, language and settings.</li>
        <li><b>Your business data:</b> clients, pets, visits, services, prices, payments recorded, messages and photos you add.</li>
        <li><b>From pet owners who book:</b> name, phone, email, address, pet details and the agreement they sign.</li>
        <li><b>Usage:</b> when the app was last used and basic technical logs to keep it secure and working.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To run the service: booking, reminders, routes, checkout, receipts and reports.</li>
        <li>To support you, including the help assistant, which receives the question you type.</li>
        <li>To bill paid plans, through our payment provider.</li>
        <li>To keep the service secure and to improve it.</li>
      </ul>
      <p>We don’t sell personal information, and we don’t use your clients’ data for our own marketing.</p>
      <h2>Who we share it with</h2>
      <p>Only providers that help run the service, under contract: hosting and database, email delivery, maps and address lookup, payment processing, and the AI provider behind the help assistant. Texts to your clients go out from your own phone.</p>
      <h2>Roles</h2>
      <p>For your clients’ information, your business decides what is collected and why; {APP_NAME} processes it on your behalf. Pet owners with questions about their data should contact the business they booked with.</p>
      <h2>How long we keep it</h2>
      <p>While your account is active, and for a limited time after it is closed, unless the law requires longer.</p>
      <h2>Your choices and rights</h2>
      <ul>
        <li>See, correct, export or delete your information; export your client list anytime.</li>
        <li>Pet owners can stop texts by replying STOP and stop marketing emails with the unsubscribe link.</li>
        <li>Depending on where you live, you may have more rights; contact us to use them.</li>
      </ul>
      <h2>Security</h2>
      <p>Connections are encrypted, passwords are hashed, an optional PIN locks the app on your phone, and data is backed up.</p>
      <h2>Contact</h2>
      <p>Privacy questions: use “Talk to a person” in the app’s Help.</p>
    </LegalPage>
  );
}
