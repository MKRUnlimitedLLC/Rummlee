import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <LegalPage
      title="Terms"
      lede="The house rules for listing, offering, and picking up on Rummlee. Updated September 21, 2026."
    >
      <LegalSection title="The short version">
        <p>
          Rummlee is a local pre-sale for neighborhood, moving, and home clear-out sales. You deal under a handle.
          Pickup is at a handoff location the seller offers — official store, public place, and/or in person. Nothing ships. Addresses are
          not posted. You are responsible for what you list and what you buy.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <p>
          You need an account to offer, message, list, or pay. Peeking is free. Keep your login to yourself. You may
          delete the account from You at any time.
        </p>
      </LegalSection>

      <LegalSection title="Listings and pickup">
        <p>
          List only items you have the right to sell. No stolen goods, weapons, explosives, drugs, or anything illegal
          to transfer where you live. Photos should match the item. Meet at the listed handoff location. Confirm pickup
          with the code so the hold can release.
        </p>
      </LegalSection>

      <LegalSection title="Money">
        <p>
          Offers and buy-now use an in-app wallet of <strong>test credits</strong>. This is a beta. Nothing is a real
          card charge, bank transfer, or cash. Credits are held until both of you confirm pickup. Every Rummlee fee
          lives on the Fees page and is applied at checkout from that live table — not as a surprise on a listing card.
          Wallet top-ups add more test credits. They are not money.
        </p>
        <p>
          If we later take real payments, digital extras such as Rummlee Plus would go through the platform’s required
          billing (including In-App Purchase on iOS). Physical-item proceeds stay between neighbors.
        </p>
      </LegalSection>

      <LegalSection title="Be decent">
        <p>
          No harassment, scams, fake listings, or showing up uninvited. We may hide listings or close accounts that
          break these terms or local law. Rummlee is a venue — the deal is between you and the other neighbor.
        </p>
      </LegalSection>

      <LegalSection title="The app as-is">
        <p>
          The product is provided as-is. We are not liable for items that disappoint, no-shows, or disputes beyond
          holding credits until pickup is confirmed. North Dakota law governs, except where Apple’s standard EULA
          applies to an App Store download.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
