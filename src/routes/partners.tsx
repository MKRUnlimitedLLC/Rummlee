import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal";

export const Route = createFileRoute("/partners")({ component: Partners });

function Partners() {
  return (
    <LegalPage
      title="Official store handoff"
      lede="The one-page deal for a store that wants a Rummlee counter. A lawyer should read it before anyone signs. Updated September 22, 2026."
    >
      <LegalSection title="What this is">
        <p>
          Rummlee is a resale app. Neighbors pay in the app. They do not meet at a house. The package changes hands at
          your counter. You are not the seller and you are not the buyer.
        </p>
      </LegalSection>
      <LegalSection title="What the store does">
        <p>Scan the seller’s code. Write the number the screen shows on the package. Nothing else.</p>
        <p>When the buyer arrives, scan their code. The screen shows the same number. Hand them that package.</p>
        <p>
          Refuse anything unsafe, illegal, or obviously not a normal household item. Refuse is a button on the counter
          screen. The buyer is refunded. You do not call either person by name.
        </p>
      </LegalSection>
      <LegalSection title="What the store does not do">
        <p>No names, no prices, no cash, and no card. The screen never shows who bought or who sold.</p>
        <p>You do not decide the fee. You do not hold the payment. A payment company will, when real money is on.</p>
      </LegalSection>
      <LegalSection title="If a package is lost">
        <p>
          Tell Rummlee the same day. Rummlee refunds the buyer. You do not pay the buyer yourself. During the pilot
          there is no rent and no fee to be a handoff location.
        </p>
      </LegalSection>
      <LegalSection title="Hours and ending it">
        <p>
          You pick the hours. Either side can stop with seven days’ notice. Packages still on the shelf go back to the
          seller or the buyer is refunded.
        </p>
      </LegalSection>
      <LegalSection title="How to ask">
        <p>
          Apply on <Link to="/corporate" className="font-medium text-primary-ink">Corporate</Link>. An operator admits
          the store, then pairs the counter screen.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
