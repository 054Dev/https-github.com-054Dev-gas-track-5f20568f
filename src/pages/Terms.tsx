import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container max-w-3xl mx-auto px-4 py-10 flex-1">
        <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: September 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. About These Terms</h2>
            <p>
              These Terms and Conditions govern your use of the Fine Gas Limited platform and your
              purchase of liquefied petroleum gas (LPG) cylinders and related delivery services from
              Fine Gas Limited ("Fine Gas", "we", "us"). By creating an account or placing an order,
              you agree to these terms, which form a binding contract under the laws of Kenya,
              including the Consumer Protection Act, 2012 (Cap. 501) and the Law of Contract Act (Cap. 23).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Accounts</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate registration details (name, phone number, email, address).</li>
              <li>Your phone number, username, and email must be unique to one account.</li>
              <li>You are responsible for keeping your password confidential and for all activity on your account.</li>
              <li>We may suspend accounts used fraudulently, abusively, or in breach of these terms. Suspended accounts may appeal via the contact channels in the footer.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Orders and Pricing</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Orders are placed through the platform and are subject to acceptance and cylinder availability.</li>
              <li>Prices are shown in Kenya Shillings (KES) and include your personalised price per kilogram where applicable.</li>
              <li>We may adjust prices, but the price confirmed on an order at the time of placement is locked for that order.</li>
              <li>Delivery charges, where applicable, are shown before you confirm an order.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Payments</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Payments are made via M-Pesa (STK Push) or recorded cash payments.</li>
              <li>You may pay an order in full or in part. Partial payments are allocated to your oldest outstanding order first (FIFO settlement).</li>
              <li>Overpayments are held as credit on your account and automatically applied to future orders.</li>
              <li>A digital receipt is issued for every confirmed payment and remains available in your Receipts page.</li>
              <li>Outstanding balances (arrears) remain payable and must be settled as agreed with the administrator.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Delivery</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Delivery timelines are estimates shown on the order tracking page; we will notify you of status changes.</li>
              <li>You (or your authorised representative) must be available at the delivery address to receive cylinders.</li>
              <li>Please inspect cylinders on delivery and report any damage or discrepancy immediately to the admin via the contact channels.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Cylinder Safety</h2>
            <p>
              LPG is flammable. You must store and use cylinders upright, in ventilated areas, away
              from heat sources, and in accordance with the safety instructions provided with the
              cylinder and applicable Kenya Bureau of Standards (KEBS) requirements. Fine Gas is not
              liable for loss arising from misuse, tampering, or unsafe storage after delivery.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Your Consumer Rights</h2>
            <p>
              Nothing in these terms limits your rights under the Consumer Protection Act, 2012,
              including the right to accurate information, fair dealing, and remedies for defective
              goods or services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Acceptable Use</h2>
            <p>
              You must not misuse the platform, attempt unauthorised access, interfere with other
              users' data, or use the platform for unlawful purposes. Breach of this section is
              grounds for immediate suspension and may be reported under the Computer Misuse and
              Cybercrimes Act, 2018.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Limitation of Liability</h2>
            <p>
              To the extent permitted by Kenyan law, Fine Gas Limited is not liable for indirect or
              consequential losses. Our aggregate liability for any claim relating to an order is
              limited to the amount you paid for that order.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Changes to These Terms</h2>
            <p>
              We may update these terms from time to time. Material changes will be announced through
              in-app notifications. Continued use after an update constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">11. Governing Law and Disputes</h2>
            <p>
              These terms are governed by the laws of Kenya. Disputes will first be resolved through
              direct engagement with the administrator; failing that, through the Kenyan courts or the
              mechanisms provided under the Consumer Protection Act, 2012.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">12. Contact</h2>
            <p>
              Questions about these terms can be sent through the Contact button in the footer, or by
              calling or messaging the administrator on the number shown there.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
