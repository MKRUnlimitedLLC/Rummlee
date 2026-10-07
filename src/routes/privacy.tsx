import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal";
import { publicHead } from "@/lib/rummlee/seo";

export const Route = createFileRoute("/privacy")({
  head: () => publicHead("/privacy", "Rummlee privacy", "A handle, not your name. Your home address stays off the listing and out of messages."),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy" lede="Privacy is the product. What we keep, who sees it, and how you erase it. Updated October 4, 2026.">
      <LegalSection title="The short version">
        <p>
          Neighbors see a handle, a neighborhood you pick, and the listing. They do not see your legal name, email, or
          home address. Pickup is at a handoff location the seller offers: official store, public place, and/or in person.
        </p>
      </LegalSection>

      <LegalSection title="Who this covers">
        <p>
          Rummlee is a neighborhood-sale marketplace for cities and suburbs across the U.S. This policy applies to the
          web app, the Home Screen version on iPhone, and any App Store listing of the same product.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account.</strong> Email if you sign up that way, or the name and email your Google or X account
            shares when you continue with those. We generate an anonymous handle. Your legal first and last name, and
            your phone, stay on the account. They are never shown to other neighbors.
          </li>
          <li>
            <strong>Profile.</strong> City and neighborhood you pick, optional zip, Rummlee Plus status, and in-app
            test-credit wallet. Legal name and phone are private account fields. Beta pay is simulated. We do not take
            card numbers. We never ask for a street or home address.
          </li>
          <li>
            <strong>Listings.</strong> Titles, descriptions, prices, photos you upload, sale dates, and how you want to
            hand off (an official partner store, a public place, or optional person to person). The lowest price stays
            off the public listing. A Rummlee +++ member can use a limited Reveal to see it. Photo fill, when it is
            on, sends that photo to suggest a title and category. It is off during beta. It does not set your price.
          </li>
          <li>
            <strong>Research.</strong> If you ask a researcher, we keep the photos, the product type, and your note.
            Approved researchers in that area see those. They do not see your legal name, email, phone, or address.
            If you apply to be a researcher, we keep the city and the areas you selected. We do not store a Social
            Security number.
          </li>
          <li>
            <strong>Deals.</strong> Offers, messages, pickup codes, and whether both of you confirmed the handoff.
          </li>
          <li>
            <strong>Device.</strong> A session cookie (or a short-lived sign-in token in preview) so you stay signed in.
            We do not collect precise GPS. Neighborhood is something you choose.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>
          To run the marketplace: show your listings, hold an offer, message the other neighbor, and confirm pickup.
          Wallet credits are in-app balances for those deals — not a bank account, and not sent to a card network from
          this app today.
        </p>
        <p>We do not sell personal information, and we do not run third-party ads in the app.</p>
      </LegalSection>

      <LegalSection title="Who sees what">
        <p>
          Other people see your handle, the neighborhood you chose, your listings, and messages you send them. They do
          not see your email, legal name, or wallet. Listings show an official partner store or a public place, not a home address.
          An in-person meetup note is shown only after you pay. Accepting an offer does not show it. Pickup codes are only for the
          two people on that order. The store counter sees a package number, not a name. If you leave a rejected package, the resale does not
          show your handle. A listing note is public once other neighbors
          mark it helpful. Don’t put a name, phone, or address in a note or in a message. A missing detail shows, with the neighbor’s
          handle, only after the seller approves it. Your lowest price is visible to you, and to a +++ member who spends
          a Reveal on that item.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          Account and listing data stay until you close the account. Closing it hides your handle and your messages.
          Orders, fees, and tax amounts stay, because a closed sale is a record. We do not store a photo of your ID
          or a tax number. The ID-verified badge is off during beta. If it turns on, a verification company compares
          the name. We would keep the result, not the document. A payment company would collect a tax form if real
          payouts turn on.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You can edit neighborhood on You and sign out at any time. Download my data, on that same page, gives you a
          JSON file of your account, listings, offers, messages, and orders, including your own lowest prices. Other
          people are handles only. To close the login, open You → Delete account. The sale record is not erased. Email
          support@rummlee.com to reopen a closed login.
        </p>
      </LegalSection>

      <LegalSection title="Who operates this">
        <p>
          Rummlee Corp, a North Dakota corporation, operates the app. This page does not publish a street address, a
          legal name, or a personal mailbox. Privacy questions go to{" "}
          <a className="font-medium text-primary-ink" href="mailto:privacy@rummlee.com">
            privacy@rummlee.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Essential cookies keep you signed in, and one cookie on this device remembers whether you allowed
          measurement. Those are not advertising. If you choose Allow measurement, we count the page and a signup
          or handoff application, including the short ad tags on the link you clicked. We do not send your email
          or your phone. After that choice, and only when an id is set, the page loads Google Analytics, a Google
          Ads tag, and a Meta pixel. Essential only means those tags are not loaded. Nothing is measured before
          you choose. The choice lasts 180 days.
        </p>
        <p>
          Google Analytics receives the page and the event. Google Ads can receive a conversion for a waitlist
          signup or a handoff application. Ads personalization stays off, and we do not send user data to Google
          for advertising. The Meta pixel receives a page view, and a lead or handoff event, with no email and no
          phone. Google and Meta can use those events to measure advertising on their own sites and apps.
        </p>
      </LegalSection>

      <LegalSection title="Companies that process it for us">
        <p>
          The company that hosts the app stores the account, the listings, and the photos so the product can run. A
          backup kept by that host can hold a copy until the backup ages out. During beta we do not send card numbers
          to a payments company. If you allow measurement, a count also stays on our server. When the ids are set,
          Google Analytics, Google Ads, and Meta receive the page and the event described above. They do not receive
          your name, email, or phone. We do not send your legal name to a store counter. Photo fill and ID verification are
          off. If either one, or real card payments, is turned on, this page will name that company before we send it
          anything.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Pickup codes are not a name. The counter is not sent one. Public waitlist and handoff forms keep a
          short-lived hash of the network address, for up to two days, so one network cannot flood the list. That
          hash is not your email or phone, and it is not sent to Google or Meta. No method of storage is perfect. If we learn that
          account data was taken, we will say so on Support and, where the law requires a notice, write to the email
          on the account.
        </p>
      </LegalSection>

      <LegalSection title="State privacy rights">
        <p>
          You can download your data and delete the account from You, in any state. You can correct your neighborhood,
          alerts, and listings while the account is open. We do not sell personal information. If you allow
          measurement, the page and event data described above is shared with Google and Meta so they can measure
          advertising. Essential only means that data is not sent. Orders, fees, tax, and payout lines still stay for 7 years after the sale, under a
          closed id, as the retention section says. The product is for people in the United States. If you write from
          somewhere else, the same choices on this page still apply.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If this page changes, the date at the top changes. If we start collecting something we do not list here, the
          page will say so before we collect it.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>Rummlee is not directed at children under 13. Do not create an account for someone that young.</p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          Privacy questions go to{" "}
          <a className="font-medium text-primary-ink" href="mailto:privacy@rummlee.com">
            privacy@rummlee.com
          </a>
          . Beta pay is test credits only. If we add real card payments or a new
          sign-in method later, this page will say so before we collect anything extra.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
