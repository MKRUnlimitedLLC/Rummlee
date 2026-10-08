import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PatentPending } from "@/components/patent-pending";

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
        One sale can be online during the week and in person for a few hours. Neighbors see the neighborhood and the hours, never a home address.
      </p>
      <PatentPending className="mt-3 max-w-2xl text-xs text-subtle" />

      <ol className="mt-8 max-w-2xl space-y-6">
        <Step n="1" title="Set the dates">
          <p>
            When you start a new listing, pick a start date and an end date. Each day has a fee. You’ll see the amount on the form, and on{" "}
            <Link to="/fees" className="font-medium text-primary-ink">
              Fees
            </Link>
            . Plus covers 5 days a month, and sale days on +++ are free. A sale can run up to 14 days.
          </p>
          <p>
            The online window is when people can make offers or pay your asking price. It starts out as Tuesday through Thursday, but you can change the days.
          </p>
        </Step>
        <Step n="2" title="Turn on live hours">
          <p>Tap Add live in-person hours, then pick the days and times. Saturday 9:00 to 3:00 is pretty typical.</p>
          <p>
            Write a short meetup note. Name a spot in the neighborhood, not a house number. The note stays hidden until someone pays for an in-person handoff, and an official store pickup never shows it.
          </p>
        </Step>
        <Step n="3" title="List the items">
          <p>Add a photo, your asking price, and the lowest you’ll take. That lowest price stays hidden.</p>
          <p>
            Official store handoff stays on, since that’s the main way. You can also offer a public place, and in person during your live hours. It’s up to you which ones to offer.
          </p>
          <p>
            Put the item in an outer box when you can, and say so. A couch, anything over 50 lb, or anything not in a box is in person only, because a store counter won’t take it. You meet as handles. Nothing ships.
          </p>
        </Step>
        <Step n="4" title="Let people pay before they come">
          <p>
            During the online window, a buyer can pay your asking price or make one offer under it. You can say yes, send one counteroffer, or decline. A decline ends it, so there’s no long back-and-forth.
          </p>
          <p>
            Once someone pays for an item in the app, don’t sell it to a cash walk-up. If you sell it somewhere else, mark it Sold outside app. That ends the listing, and no Rummlee payment moves.
          </p>
        </Step>
        <Step n="5" title="During your hours">
          <p>
            The public card shows the hours and “In person · hours only,” but no street. Once someone pays for an in-person handoff, they see your meetup note.
          </p>
          <p>
            Boxed items can still go to the official store. You and the buyer each get your own code for the same sale. The store scans yours, then theirs, and names stay off the counter.
          </p>
          <p>The sale isn’t done until you both confirm, with the scan or the 6-character code.</p>
        </Step>
        <Step n="6" title="Afterward">
          <p>
            You each give a thumbs up or a thumbs down. A comment and a photo are optional, and the comment stays private. How it was packed counts toward that rating.
          </p>
        </Step>
        <Step n="7" title="Keep it up, or put it first">
          <p>
            The day before your sale closes, Rummlee asks if you want more days. You can add 1, 3, or 7, up to 14 days total, and Plus free days still apply.
          </p>
          <p>
            You can feature one item, or the whole sale, so those listings show up first until the sale ends. Prices are on{" "}
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
          Online Tuesday through Thursday, then in person Saturday from 9:00 to 3:00. Official store is on for anything in a box. In person is on for the Saturday hours, and for anything too big for a counter.
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
