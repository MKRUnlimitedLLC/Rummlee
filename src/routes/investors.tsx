import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { OwnershipForm } from "@/components/launch-forms";
import { LegalPage, LegalSection } from "@/components/legal";

const TITLE = "Rummlee for investors";
const DESCRIPTION =
  "Pre-launch local marketplace. Pickup at an official handoff location. Nothing ships. This page is not an offer of stock.";

export const Route = createFileRoute("/investors")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://rummlee.com/investors" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Investors,
});

function Investors() {
  return (
    <LegalPage
      title="A local marketplace. The package changes hands at a store."
      lede="Rummlee is not open. This page is for people who invest in marketplaces, local retail, or consumer apps. It is not an offer to sell stock, not a solicitation, and not a commitment to take money. October 1, 2026."
    >
      <LegalSection title="The company">
        <p>
          Neighbors sell used household items to other neighbors. The buyer pays in the app. Pickup is at an official
          handoff location first. A public place is the backup. A private handoff is optional, and only after payment.
          Nothing ships. The home address stays off the public card. People deal by a handle, not a legal name.
        </p>
        <p>
          The company is Rummlee Corp. Three Pillars Holdings LLC owns Rummlee Corp and MKR-UNLIMITED LLC. MKR-UNLIMITED
          LLC owns MKR Connect LLC. A founder is in Fargo, North Dakota.
        </p>
      </LegalSection>
      <LegalSection title="The problem">
        <p>
          A driveway sale depends on weather, a Saturday, and strangers at the door. Local online listings often publish
          a home address, or they push the conversation out of the app. Shipping marketplaces add a carrier and a fee
          that does not fit a couch or a closet clean-out.
        </p>
      </LegalSection>
      <LegalSection title="The product">
        <p>Official handoff location first. The store holds the package. It is not the buyer or the seller.</p>
        <p>Money is meant to stay held until both sides confirm pickup. That hold is simulated while the product is in test.</p>
        <p>The seller sets an asking price and a private floor. The buyer can pay the ask or make one offer path.</p>
        <p>A U.S. provisional patent application has been filed on the handoff method. It is not an issued patent.</p>
      </LegalSection>
      <LegalSection title="How the company expects to make money">
        <p>
          On a live transaction: a seller fee, a buyer fee, and a fee for each sale date. Memberships change what those
          fees are and what is included. The public rate card is on{" "}
          <Link to="/fees" className="font-medium text-primary-ink">
            Fees
          </Link>
          . Rates can change. This page is not a quote, and test activity is not revenue.
        </p>
      </LegalSection>
      <LegalSection title="Where it stands">
        <p>Pre-launch. The product is in test. It is not an open marketplace. No card is charged. People use test credits.</p>
        <p>No official handoff location is signed. A store can apply. An application is not a signed location.</p>
        <p>This page does not state a user count, a revenue figure, a round size, or a valuation.</p>
        <p>
          Neighbors can{" "}
          <Link to="/" className="font-medium text-primary-ink">
            sign up for updates and the launch
          </Link>
          . A store can{" "}
          <Link to="/handoff" className="font-medium text-primary-ink">
            apply to be an official handoff location
          </Link>
          .
        </p>
      </LegalSection>
      <LegalSection title="Risks">
        <p>There is no operating history and no revenue on this page to show. A private investment can be a total loss.</p>
        <p>The model needs a store, buyers, and sellers in the same city. None of those is guaranteed.</p>
        <p>Real card payments are not on. A payments company is planned to hold funds. It is not live.</p>
        <p>Sales-tax and marketplace rules differ by state. They are not finished on this page.</p>
        <p>There is no public market for the shares. Any later round, price, or percent is not stated here.</p>
      </LegalSection>
      <Request />
      <LegalSection title="Important notice">
        <p>
          This page is general information as of October 1, 2026. It is not an offer to sell, or a solicitation of an
          offer to buy, any security. Nothing here is a commitment to raise money or to accept an investor. It is not
          investment, legal, or tax advice. Forward-looking statements are plans, not promises. Any real discussion
          would use confidential materials and would have to fit the securities laws that apply. Do not rely on this
          page to make an investment decision.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

function Request() {
  const [done, setDone] = useState<string | null>(null);
  return (
    <LegalSection title="Request information">
      <p>
        Leave an email if you want to hear more, if there is something to say. A firm name is optional. We do not sell
        the address. Writing you is not an offer of stock.
      </p>
      {done ? (
        <p role="status" className="rounded-2xl bg-bg p-4 text-pretty">
          {done}
        </p>
      ) : (
        <OwnershipForm
          idPrefix="investor"
          onSuccess={(message) => {
            setDone(message);
            toast.success(message);
          }}
        />
      )}
    </LegalSection>
  );
}
