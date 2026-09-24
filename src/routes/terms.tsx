import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <LegalPage
      title="Terms"
      lede="The house rules for listing, offering, and picking up on Rummlee. Updated September 23, 2026."
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
          You need an account to offer, message, list, or pay. You must be 18. Peeking is free. Keep your login to yourself.
          One person, one account. A new account does not reset ratings. You may delete the account from You at any
          time. An ID-verified badge is off during this beta. When it is on, a verification company checks that the
          name matches the ID. We do not keep the ID image.
        </p>
      </LegalSection>

      <LegalSection title="Listings and pickup">
        <p>
          List only items you have the right to sell. No stolen goods, weapons, explosives, drugs, or anything illegal
          to transfer where you live. Photos should match the item. You set an asking price and a lowest price. The
          lowest price is not on the public listing. A buyer can pay asking or make one offer. Each side gets one
          counteroffer. A decline ends it. There is no back-and-forth after that.
        </p>
        <p>
          A sale can be online on some days and in person on others. The public card shows the hours, not a street
          address. If you offer an in-person handoff, the meetup note is shown only after the buyer pays or an offer
          is accepted. An item over 50 pounds, or not in an outer box, is in person only. It does not go to an official
          store. The seller says whether a boxed item is packed as-is or in an outer box.
        </p>
        <p>
          Meet at the handoff location the seller offered. Confirm pickup with the code so the hold can release. At an
          official store, the seller has 2 days to drop the package off. After the counter scans it in, the buyer has
          5 days to pick it up. Miss either window and the buyer is refunded. The counter sees a package number, not
          a name.
        </p>
      </LegalSection>

      <LegalSection title="Money">
        <p>
          Offers and buy-now use an in-app wallet of <strong>test credits</strong>. This is a beta. Nothing is a real
          card charge, bank transfer, or cash. Rummlee does not hold real money and is not a bank. If real payments
          turn on, a payment company holds the charge and pays the seller. Rummlee records the fee.
        </p>
        <p>
          Every Rummlee fee lives on the Fees page and is applied at checkout from that live table. The seller fee is
          the same for an official store, a public place, or in person. There is no separate official-store charge.
          Sales tax, when a state requires it, is separate and is not Rummlee revenue. A sale day, a featured item, or
          a featured sale can be taken from the seller’s next payout if the wallet does not cover it.
        </p>
        <p>
          Rummlee Plus and Rummlee +++ are their own charges. They are never added onto an item. Amounts are on the Fees
          page. On an iPhone app, those plans are digital subscriptions billed by Apple. The physical item is a
          different payment. +++ includes unlimited sale days, 5 researcher requests, and 5 Rummlee Reveals each
          month. Unused researches and Reveals do not roll over. Extra researcher requests are the ask fee, one at a time.
        </p>
        <p>
          A Rummlee Reveal shows that seller’s lowest price to the member who uses it. It does not show the price to
          everyone else. By listing, the seller agrees that a +++ member may use a Reveal, up to the monthly limit on
          the Fees page.
        </p>
        <p>
          After a handoff, the seller is not paid for 48 hours. In that window the buyer can report a problem and
          support decides who is paid. A counter can refuse a package. If the hold is cancelled before the counter
          takes it, the buyer is refunded and the listing goes live again. If the package is already at an official
          store and the handoff does not finish, the seller can hold it for pickup or leave it. Leave-it is open in
          Fargo–Moorhead first, where Rummlee can store it. A left package becomes Rummlee’s. Rummlee may resell it
          on an always-on shelf. The first seller’s handle is not on that listing, and the first seller is not paid.
          Half of what Rummlee receives as the seller, after the usual seller fee, is set aside for charity. That
          split is not a buyer fee. Test credits follow the same rule.
        </p>
      </LegalSection>

      <LegalSection title="Researchers">
        <p>
          Asking a researcher sends the photos, the product type, and your note. It does not send your name. The
          researcher suggests what it is and a price range. That range is not an appraisal, not your asking price, and
          not your lowest price. You accept or pass. Pay is on the Fees page. The researcher is paid only if you accept,
          and may receive the bonuses on that page if the item later sells.
        </p>
        <p>
          Researchers apply, pick the product types they know, and are independent contractors on a 1099-NEC. This is
          not a job, and Rummlee does not set their hours. Research now starts 15 minutes. They hold one item at a
          time. They may request one hold, for 15 more minutes. If the clock ends, the ask goes back to someone else.
        </p>
        <p>
          Anyone Rummlee pays for a service is a 1099-NEC contractor, not an employee. Rummlee does not withhold
          payroll taxes for that work. A neighbor who is paid for their own item is not a contractor. If real payouts
          turn on, the payment company reports those sales on a 1099-K when that form’s threshold is met.
        </p>
      </LegalSection>

      <LegalSection title="Be decent">
        <p>
          No harassment, scams, fake listings, or showing up uninvited. We may hide listings or close accounts that
          break these terms or local law. The item is between you and the other person. Once Rummlee settles a
          payment, Rummlee decides refunds and the 48-hour payout. A clerk may refuse a package that is unsafe,
          illegal, or not the item listed. A listing note is hidden until other neighbors mark it helpful. A helpful
          note does not by itself remove a listing. A note marked not helpful lowers the writer’s Rummlee Rep.
          A neighbor can suggest a missing detail. It shows only if the seller approves it. Rep is a score, not
          money, and it is not a background check. The scoreboard is not a cash contest. A researcher’s price
          range is a suggestion. It is not an appraisal, and you still set the asking price.
        </p>
      </LegalSection>

      <LegalSection title="The app as-is">
        <p>
          The product is provided as-is during beta. We are not a bank. We do not pay real money out of test credits.
          North Dakota law governs, except where Apple’s standard EULA applies to an App Store download.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
