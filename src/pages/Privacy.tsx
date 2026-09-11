import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container max-w-3xl mx-auto px-4 py-10 flex-1">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: September 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Who We Are</h2>
            <p>
              Fine Gas Limited ("Fine Gas", "we", "us") is the data controller for personal data
              processed through this platform. This policy is prepared in accordance with the Kenya
              Data Protection Act, 2019 (No. 24 of 2019) and the Data Protection (General)
              Regulations, 2021.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Personal Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Identity and contact data:</strong> full name, shop name, username, email address, phone number, and delivery address.</li>
              <li><strong>Account data:</strong> login credentials (passwords are stored only in hashed form), role, and account status.</li>
              <li><strong>Transaction data:</strong> orders, cylinder sizes and quantities, prices, payments (including M-Pesa transaction references), balances, and receipts.</li>
              <li><strong>Communication data:</strong> messages you send to the administrator and notifications we send you.</li>
              <li><strong>Usage data:</strong> if you accept analytics cookies, anonymised interaction data collected by Microsoft Clarity (see Cookies below).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Why We Process Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To create and manage your account (performance of our contract with you).</li>
              <li>To process orders, deliveries, payments, and issue receipts (contract and legal obligations).</li>
              <li>To track balances and apply payments to your orders (legitimate interest in accurate accounting).</li>
              <li>To send service notifications about orders and payments (contract).</li>
              <li>To improve the platform through analytics, only with your consent.</li>
              <li>To keep the platform secure and prevent fraud (legitimate interest and legal obligation).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Who We Share Data With</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Safaricom (M-Pesa / Daraja):</strong> your phone number and payment amount, solely to initiate and confirm payments you request.</li>
              <li><strong>Microsoft Clarity:</strong> anonymised usage data, only if you accept analytics cookies.</li>
              <li><strong>Hosting and infrastructure providers</strong> who process data on our behalf under contractual safeguards.</li>
              <li>We do not sell your personal data to anyone.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Data Retention</h2>
            <p>
              We keep account and transaction records for as long as your account is active and
              thereafter as required by Kenyan tax and commercial record-keeping laws. When you
              request account deletion, your personal data is removed or anonymised except where the
              law requires retention (for example, payment records).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Your Rights Under the Data Protection Act, 2019</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To be informed of how your data is used.</li>
              <li>To access the personal data we hold about you.</li>
              <li>To correct inaccurate or incomplete data (you can edit most details in Settings).</li>
              <li>To request deletion of your data (account deletion options are in your dashboard).</li>
              <li>To object to or restrict certain processing, including analytics.</li>
              <li>To data portability for data you provided.</li>
              <li>To withdraw consent at any time where processing is based on consent (e.g. via the cookie settings).</li>
            </ul>
            <p className="mt-2">
              To exercise any right, contact the administrator through the footer contact options.
              You also have the right to lodge a complaint with the Office of the Data Protection
              Commissioner (ODPC), Kenya.
            </p>
          </section>

          <section id="cookies">
            <h2 className="text-xl font-semibold mb-2">7. Cookies and How We Use Them</h2>
            <p className="mb-2">This platform uses the following categories of cookies and similar storage:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Strictly necessary (always on):</strong> authentication session tokens and
                your cookie-consent choice, stored in your browser's local storage. The platform
                cannot function without these.
              </li>
              <li>
                <strong>Preference:</strong> your theme (light/dark) and dashboard card visibility
                choices, stored locally on your device.
              </li>
              <li>
                <strong>Analytics (consent required):</strong> Microsoft Clarity cookies that record
                anonymised usage patterns and heatmaps to help us improve the platform. These are
                only set if you tap <em>Accept</em> on the cookie banner. Declining keeps Clarity off
                entirely.
              </li>
            </ul>
            <p className="mt-2">
              You can change your choice at any time by clearing the site's stored data in your
              browser; the consent banner will then reappear.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Data Security</h2>
            <p>
              We apply technical and organisational measures including encrypted transport (HTTPS),
              hashed password storage, row-level access controls on the database, role-based access,
              and OTP rate limiting. No method of transmission over the internet is 100% secure, but
              we continually review our safeguards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Children</h2>
            <p>
              This platform is a business-to-business service for shop operators and is not directed
              at children under 18. We do not knowingly collect children's data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be announced through
              in-app notifications and the "Last updated" date above will change.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">11. Contact</h2>
            <p>
              For any privacy question or request, use the Contact button in the footer or call the
              administrator on the number shown there.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
