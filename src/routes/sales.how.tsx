import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sales/how")({
  component: InPersonHowTo,
});

function InPersonHowTo() {
  return (
    <main className="py-8">
      <p className="text-sm font-medium text-primary-ink">Neighborhood sale</p>
      <h1 className="mt-1 max-w-2xl font-display text-3xl font-semibold tracking-[-0.03em]">
        How to run it in person
      </h1>
      <p className="mt-2 max-w-2xl text-pretty text-muted">
        One sale can be online during the week and in person for a few hours. Neighbors see the neighborhood and the
        hours. They never see a home address.
      </p>

      <ol className="mt-8 max-w-2xl space-y-6">
        <Step n="1" title="Set the dates">
          <p>
            On a new listing, pick a start and an end. Each date has a fee. The amount is on the form, and on{" "}
            <Link to="/fees" className="font-medium text-primary-ink">
              Fees
            </Link>
            . Plus covers 5 dates each month. +++ sale days are free. A sale can run 14 days.
          </p>
          <p>
            The online window is when people can offer and pay asking. It starts at Tuesday through Thursday. Change the
            days if you want.
          </p>
        </Step>
        <Step n="2" title="Turn on live hours">
          <p>Tap Add live in-person hours. Pick the days and the clock times. Saturday 9:00 to 3:00 is a normal one.</p>
          <p>
            Write an in-person meetup note. Say the neighborhood spot, not a house number. That note stays hidden until
            someone pays for in-person handoff. An official store pickup never shows it.
          </p>
        </Step>
        <Step n="3" title="List the items">
          <p>Add a photo. Put in your asking price, and your lowest price. The lowest price is not shown.</p>
          <p>
            Official store handoff stays on. That is the main way. You can also offer a public place, and in-person
            during the live hours. You choose which of those to offer.
          </p>
          <p>
            Put the item in an outer box when you can, and say so. A couch, anything over 50 lb, or anything not in a
            box is in person only. A store counter will not take it. The buyer can offer to haul it, or you arrange the
            pickup.
          </p>
        </Step>
        <Step n="4" title="Let people pay before they come">
          <p>
            During the online window a buyer can pay asking, or make one offer under it. You can say yes, send one
            counteroffer, or decline. A decline ends it. There is no long back-and-forth.
          </p>
          <p>
            An item that is paid in the app is not for a cash walk-up. If you sell it somewhere else, mark Sold outside
            the app. That ends the listing and does not move a Rummlee payment.
          </p>
        </Step>
        <Step n="5" title="The hours themselves">
          <p>
            The public card says the hours and “In person · hours only.” No street. After someone pays for in-person
            handoff, they see your meetup note.
          </p>
          <p>
            Boxed items can still go to the official store. You and the buyer each get a different code for the same
            sale. The store scans yours, then theirs. Names stay off the counter.
          </p>
          <p>The sale is done only when both of you confirm, with the scan or the 6-character code.</p>
        </Step>
        <Step n="6" title="Afterward">
          <p>
            You each give a thumbs up or a thumbs down. A comment and a photo are optional, and the comment stays
            private. Packaging is part of that rating.
          </p>
        </Step>
        <Step n="7" title="Keep it up, or put it first">
          <p>
            The day before the sale closes, Rummlee asks if you want more days. Add 1, 3, or 7, up to 14 days total.
            Plus free days still apply.
          </p>
          <p>
            Feature one item, or the whole sale, so those listings show first until the sale ends. The prices are on{" "}
            <Link to="/fees" className="font-medium text-primary-ink">
              Fees
            </Link>
            . If test credits don’t cover the days or the feature, the rest comes out of your next payout.
          </p>
        </Step>
      </ol>

      <div className="mt-8 max-w-2xl rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
        <p className="font-medium">A simple weekend</p>
        <p className="mt-1 text-sm text-muted">
          Online Tuesday through Thursday. In person Saturday, 9:00 to 3:00. Official store on for anything in a box.
          In person on for the Saturday hours, and for anything that will not fit a counter.
        </p>
      </div>

      <Button asChild className="mt-6">
        <Link to="/listings/new">Start a listing</Link>
      </Button>
    </main>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wider text-primary-ink">Step {n}</p>
      <h2 className="mt-1 font-display text-xl font-medium tracking-[-0.02em]">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-pretty text-fg">{children}</div>
    </li>
  );
}
