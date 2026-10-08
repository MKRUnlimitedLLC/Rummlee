import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal";
import { publicHead } from "@/lib/rummlee/seo";

export const Route = createFileRoute("/partners")({
  head: () => publicHead("/partners", "Become an official Rummlee store", "We’re in beta, so nothing is for sale and no card is charged. Official store handoff comes first. Nothing ships, and no home address goes on a listing."),
  component: Partners,
});

function Partners() {
  return (
    <LegalPage
      title="Official store handoff"
      lede="Everything a store needs to know about hosting a Rummlee counter, on one page. Have a lawyer read it before anyone signs. Handoff method patent pending. A U.S. provisional application is on file. It is not an issued patent. Updated October 2, 2026."
    >
      <LegalSection title="What this is">
        <p>
          Rummlee is a resale app. Neighbors pay in the app, and they don’t meet at anyone’s house. The package changes hands at your counter. You’re not the seller, and you’re not the buyer.
        </p>
      </LegalSection>
      <LegalSection title="What the store does">
        <p>Scan the seller’s code and write the number the screen shows on the package. That’s it.</p>
        <p>When the buyer shows up, scan their code. The screen shows the same number, so you hand them that package.</p>
        <p>
          Refuse anything unsafe, illegal, or clearly not a normal household item. There’s a Refuse button on the counter screen, and the buyer gets refunded. You don’t call either person by name.
        </p>
      </LegalSection>
      <LegalSection title="What the store doesn’t do">
        <p>No names, no prices, no cash, and no card. The screen never shows who bought or who sold.</p>
        <p>You don’t set the fee, and you don’t hold the payment. A payment company will do that once real money is on.</p>
      </LegalSection>
      <LegalSection title="If a package is lost">
        <p>
          Let Rummlee know the same day. Rummlee refunds the buyer, so you don’t pay them yourself. During the pilot, there’s no rent and no fee to be an official store.
        </p>
      </LegalSection>
      <LegalSection title="Hours and ending it">
        <p>
          You pick the hours. Either side can stop with seven days’ notice. Any packages still on the shelf go back to the seller, or the buyer is refunded.
        </p>
      </LegalSection>
      <LegalSection title="How to ask">
        <p>
          Apply on <Link to="/corporate" className="font-medium text-primary-ink">Corporate</Link>. Someone on the Rummlee team admits the store, then pairs the counter screen.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
