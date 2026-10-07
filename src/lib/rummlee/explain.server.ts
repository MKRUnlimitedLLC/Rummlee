import QRCode from "qrcode";
import { TEST_MODE, TEST_PAY_NOTE } from "./constants.ts";

/** The page Tricia opens. Edit this file. The next publish replaces what her phone shows. */
export const TESTFLIGHT_URL = "https://testflight.apple.com/join/QHP23ejR";
export const EXPLAIN_PATH = "/bandit/explain";

function esc(value: string): string {
  return value
    .replaceAll("&", "\u0026amp;")
    .replaceAll("<", "\u0026lt;")
    .replaceAll(">", "\u0026gt;")
    .replaceAll('"', "\u0026quot;");
}

export async function renderExplainPage(): Promise<string> {
  const qr = TEST_MODE
    ? await QRCode.toDataURL(TESTFLIGHT_URL, { margin: 1, width: 280, errorCorrectionLevel: "H" })
    : "";
  const beta = TEST_MODE
    ? `<section class="slide">
    <p class="kicker">Right now</p>
    <h2>This build is a test.</h2>
    <p>${esc(TEST_PAY_NOTE)}</p>
    <p>The items are samples. A store will not actually take a package. Don’t enter a real card, and don’t say a shop has signed.</p>
  </section>
  <section class="slide">
    <p class="kicker">Try it</p>
    <h2>iPhone, TestFlight, then Rummlee.</h2>
    <div class="qr-wrap">
      <img alt="QR code for the current TestFlight link" src="${qr}" />
      <div>
        <p>Install TestFlight from the App Store. Then open this link in Safari, on the iPhone, or scan the code with the camera.</p>
        <p><a href="${esc(TESTFLIGHT_URL)}">${esc(TESTFLIGHT_URL.replace("https://", ""))}</a></p>
        <p class="muted">The first screen lets you pick simple or advanced, text size, and light or dark.</p>
      </div>
    </div>
  </section>`
    : `<section class="slide">
    <p class="kicker">Try it</p>
    <h2>Get it on your iPhone.</h2>
    <p>Rummlee is open for real listings. Pay happens in the app. Nothing ships.</p>
  </section>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<title>Rummlee — for new people</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root { --bg:#f4f1ed; --ink:#161412; --muted:#6e6964; --rose:#7a3140; --soft:#f6e8eb; --card:#fff; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #1c1917; color: var(--ink); font-family: Outfit, system-ui, sans-serif; }
  .deck { height: 100dvh; overflow-y: auto; scroll-snap-type: y mandatory; }
  .slide { min-height: 100dvh; scroll-snap-align: start; background: var(--bg); padding: max(28px, env(safe-area-inset-top)) 28px max(28px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; justify-content: center; }
  .kicker { margin: 0 0 12px; color: var(--rose); font-size: 13px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
  h1 { margin: 0; font-size: clamp(40px, 8vw, 72px); font-weight: 500; letter-spacing: -0.04em; line-height: 0.98; max-width: 16ch; }
  h2 { margin: 0 0 16px; font-size: clamp(32px, 5vw, 48px); font-weight: 500; letter-spacing: -0.03em; line-height: 1.05; max-width: 18ch; }
  p { margin: 0 0 12px; font-size: 18px; line-height: 1.45; max-width: 38rem; }
  .lede { font-size: 22px; }
  .muted { color: var(--muted); }
  ul { margin: 8px 0 0; padding: 0; list-style: none; max-width: 40rem; }
  li { margin: 0 0 10px; padding: 14px 16px; background: var(--card); border-radius: 16px; box-shadow: 0 0 0 1px rgba(22,20,18,.05), 0 10px 28px -16px rgba(22,20,18,.14); font-size: 17px; line-height: 1.4; }
  .row { display: grid; gap: 10px; max-width: 44rem; }
  @media (min-width: 800px) { .row.three { grid-template-columns: 1fr 1fr 1fr; } }
  .card { background: var(--card); border-radius: 20px; padding: 18px 16px; box-shadow: 0 0 0 1px rgba(22,20,18,.05), 0 10px 28px -16px rgba(22,20,18,.14); }
  .card h3 { margin: 0 0 6px; font-size: 18px; }
  .card p { margin: 0; font-size: 15px; color: var(--muted); }
  .card.first { background: var(--soft); }
  .card.first p { color: var(--ink); }
  .foot { margin-top: 28px; color: var(--muted); font-size: 13px; }
  .qr-wrap { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
  .qr-wrap img { width: 168px; height: 168px; background: white; border-radius: 16px; }
  a { color: var(--rose); }
  .say { border-left: 3px solid var(--rose); padding-left: 14px; }
</style>
</head>
<body>
<div class="deck">
  <section class="slide">
    <p class="kicker">Rummlee</p>
    <h1>The good stuff, before Saturday.</h1>
    <p class="lede">Neighborhood finds, in the city and the suburbs. You pay in the app. You pick it up. Nothing ships.</p>
    <p class="foot">Scroll. This page is the current version.</p>
  </section>
  <section class="slide">
    <p class="kicker">What it is</p>
    <h2>A sale you can join before you go.</h2>
    <p>Someone nearby is ready to let things go. You see them in the app, you pay, and you collect them at a handoff. You do not have to wander a driveway to find out what is left.</p>
    <p>It is for anyone. The people we talk to most live in cities and suburbs. The app is the same for everyone.</p>
  </section>
  <section class="slide">
    <p class="kicker">What it is not</p>
    <h2>Read this before you promise anything.</h2>
    <ul>
      <li><strong>Nothing ships.</strong> There is no box in the mail.</li>
      <li><strong>It is not a garage-sale app.</strong> We don’t put a street on a public listing, and we don’t ask people to meet at a house.</li>
      <li><strong>A store has not agreed</strong> just because the app talks about an official store.</li>
    </ul>
  </section>
  <section class="slide">
    <p class="kicker">Privacy</p>
    <h2>Your name stays off the listing.</h2>
    <p>Other people see a handle. They do not see your legal name.</p>
    <p>A public listing never shows a home address. It shows how far the pickup is, not where the item started.</p>
    <p>If you choose an in-person handoff, the meetup note appears only after someone has paid.</p>
  </section>
  <section class="slide">
    <p class="kicker">Handoff</p>
    <h2>Three ways. One of them comes first.</h2>
    <div class="row three">
      <article class="card first"><h3>Official store</h3><p>The main way. The store counter holds a boxed item. You and the other person stay anonymous there.</p></article>
      <article class="card"><h3>Public place</h3><p>The backup. A public spot, not a house.</p></article>
      <article class="card"><h3>In person</h3><p>Only if the seller offers it, and only after you pay. Over 50 lb, or not in a box, is in person only.</p></article>
    </div>
  </section>
  <section class="slide">
    <p class="kicker">If you sell</p>
    <h2>Asking price, and a lowest price.</h2>
    <ul>
      <li>Add a photo. Put in what you are asking. Put in the lowest you will take. Buyers never see that lowest number.</li>
      <li>Pack it in an outer box when you can, and say so.</li>
      <li>A neighborhood sale can be online in the week and in person for a few hours. The public card shows the hours, not a street.</li>
      <li>If you sell it somewhere else, mark it sold outside the app.</li>
    </ul>
  </section>
  <section class="slide">
    <p class="kicker">If you buy</p>
    <h2>Pay the asking price, or make one offer.</h2>
    <p>You can pay what they asked. Or you can offer less, once.</p>
    <p>The seller can say yes, send one counteroffer, or decline. A decline ends it.</p>
    <p>The total is what you see first. You can open it to see the fees. Sales tax stays visible when it applies.</p>
  </section>
  <section class="slide">
    <p class="kicker">When it is done</p>
    <h2>Both people confirm.</h2>
    <p>You and the seller each get a different code for the same sale. Names are not on the counter screen.</p>
    <p>The sale is finished only when both of you confirm, with the scan or a 6-character code.</p>
    <p>Afterward you each give a thumbs up or a thumbs down. A comment is optional, and it stays private.</p>
  </section>
  ${beta}
  <section class="slide">
    <p class="kicker">For you, before you send them off</p>
    <h2>What you can say.</h2>
    <p class="say">“It’s neighborhood stuff, paid in the app, picked up in person. Nothing is mailed.”</p>
    <ul>
      <li>Don’t promise a job, a city, or a payment.</li>
      <li>Don’t say a store has signed.</li>
      <li>Don’t post the TestFlight link on the public website.</li>
      <li>If a public screen shows a street address, stop and send that screen back.</li>
    </ul>
    <p class="foot">Private. Not an offer. Served from the current site, not from a saved file.</p>
  </section>
</div>
</body>
</html>`;
}
