import { defineTask } from "nitro/task";
import { getSql } from "../../src/lib/db";
import { runNightly } from "../../src/lib/rummlee/books";
import { stripeSdkLoads, stripeStatus } from "../../src/lib/rummlee/stripe-status";

export default defineTask({
  meta: {
    name: "rummlee:nightly",
    description: "Release due payouts and close expired official-store holds",
  },
  async run() {
    const sql = await getSql();
    const result = await runNightly(sql);
    const stripe = stripeStatus();
    if (stripe.mode === "key-present") await stripeSdkLoads();
    return { result: { ...result, stripe } };
  },
});
