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
          Pickup is at an official partner store unless you choose a public place or person to person. Nothing ships. Addresses are
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
          to transfer where you live. Photos should match the item. Meet at the listed partner store, or a public place
          or person to person if you both opt in. Confirm pickup with the code so the hold can release.
        </p>
      </LegalSection>

      <LegalSection title="Money">
        <p>
          Offers and buy-now use an in-app wallet. Credits are held until both of you confirm pickup. The service fee is
          10% of the item price, or 5% with Rummlee Premium ($4 in-app). Wallet top-ups in this version credit your
          balance inside Rummlee; they are not a bank transfer or a card charge through Apple.
        </p>
        <p>
          If we later take real payments, digital extras such as Premium would go through the platform’s required
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
