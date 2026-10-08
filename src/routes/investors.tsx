import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { OwnershipForm } from "@/components/launch-forms";
import { LegalPage, LegalSection } from "@/components/legal";

const TITLE = "Rummlee for investors — pre-launch local marketplace";
const DESCRIPTION =
  "Rummlee Corp is a consumer marketplace getting ready to launch. Official store handoff first, and nothing ships. Background for venture and private equity research. Not an offer of stock.";

export const Route = createFileRoute("/investors")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      {
        name: "keywords",
        content:
          "Rummlee, pre-launch marketplace, local commerce, consumer marketplace, North Dakota, patent pending, venture research, private equity research",
      },
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
      title="A local marketplace where the package changes hands at a store."
      lede="Rummlee isn’t open yet. This page is background for people who invest in marketplaces, local retail, or consumer apps, including venture and private equity research. It’s not an offer to sell stock, a solicitation, or a commitment to take money. October 2, 2026."
    >
      <LegalSection title="The company">
        <p>
          Neighbors sell used household items to other neighbors, and the buyer pays in the app. The handoff happens at an official store first, with a public place as the backup. Meeting person to person is optional, and only after payment. Nothing ships. Home addresses stay off the public card, and people go by a handle, not a legal name.
        </p>
        <p>
          The company is Rummlee Corp, a North Dakota corporation. Questions about this page? Write to{" "}
          <a className="font-medium text-primary-ink" href="mailto:investors@rummlee.com">
            investors@rummlee.com
          </a>
          . Writing to that address isn’t an offer of stock.
        </p>
      </LegalSection>
      <LegalSection title="The problem">
        <p>
          A driveway sale hangs on the weather, a free Saturday, and strangers at your door. Local listing sites often show a home address, or they push the conversation out of the app. Shipping marketplaces add a carrier and a fee, and that doesn’t work for a couch or a closet clean-out.
        </p>
      </LegalSection>
      <LegalSection title="The product">
        <p>Official store handoff first. The store just holds the package. It isn’t the buyer or the seller.</p>
        <p>The money is meant to stay on hold until both sides confirm pickup. For now that hold is simulated, since the product is still in testing.</p>
        <p>The seller sets an asking price and a private lowest price. The buyer can pay the asking price or make one offer.</p>
        <p>
          Patent pending. A U.S. provisional application has been filed on the handoff method. It is not an issued
          patent. The application is assigned to Rummlee Corp.
        </p>
      </LegalSection>
      <LegalSection title="How the company expects to make money">
        <p>
          On a real sale, there’s a seller fee, a buyer fee, and a fee for each sale day. Memberships change those fees and what’s included. The public rate card is on{" "}
          <Link to="/fees" className="font-medium text-primary-ink">
            Fees
          </Link>
          . Rates can change. This page isn’t a quote, and test activity isn’t revenue.
        </p>
      </LegalSection>
      <LegalSection title="Where it stands">
        <p>We haven’t launched. The product is still in testing and the marketplace isn’t open, so people use test credits and no card is charged.</p>
        <p>No official store has signed. Stores can apply, but an application isn’t a signed store.</p>
        <p>You won’t find a user count, a revenue figure, a round size, or a valuation on this page.</p>
        <p>
          Neighbors can{" "}
          <Link to="/" className="font-medium text-primary-ink">
            sign up for updates and the launch
          </Link>
          . A store can{" "}
          <Link to="/handoff" className="font-medium text-primary-ink">
            apply to be an official store
          </Link>
          .
        </p>
      </LegalSection>
      <LegalSection title="Risks">
        <p>There’s no operating history, and there’s no revenue on this page to show. A private investment can be a total loss.</p>
        <p>The model needs a store, buyers, and sellers in the same city, and none of that is guaranteed.</p>
        <p>Real card payments aren’t turned on. The plan is for a payments company to hold funds, but that isn’t live.</p>
        <p>Sales-tax and marketplace rules differ from state to state, and they aren’t worked out on this page.</p>
        <p>There’s no public market for the shares. This page doesn’t state any later round, price, or percent.</p>
      </LegalSection>
      <LegalSection title="At a glance">
        <p>Category: consumer marketplace in beta. Nothing is for sale. Official store handoff first. Nothing ships.</p>
        <p>Entity: Rummlee Corp, a North Dakota corporation. Intended as a national product.</p>
        <p>Stage: test only. No card is charged. No store is signed. No user count, revenue, round size, or valuation is published.</p>
        <p>
          Patent: a U.S. provisional application is on file for the handoff method. It is not an issued patent. The application is assigned to Rummlee Corp.
        </p>
      </LegalSection>
      <Request />
      <LegalSection title="Important notice">
        <p>
          This page is general information as of October 2, 2026. It is not an offer to sell, or a solicitation of an
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
        Leave your email if you’d like to hear more when there’s something to share. A firm name is optional. We don’t sell your email, and writing to you isn’t an offer of stock.
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
