import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  LAUNCH_RATE_PER_DAY,
  LAUNCH_RATE_PER_HOUR,
  clientAddress,
  clientKeyFromHeaders,
  launchRateAllows,
} from "./launch-rate.ts";

test("a real person stays inside the hour and day budgets", () => {
  assert.equal(launchRateAllows(0, 0), true);
  assert.equal(launchRateAllows(LAUNCH_RATE_PER_HOUR - 1, LAUNCH_RATE_PER_DAY - 1), true);
  assert.equal(launchRateAllows(LAUNCH_RATE_PER_HOUR, 0), false);
  assert.equal(launchRateAllows(0, LAUNCH_RATE_PER_DAY), false);
  assert.equal(LAUNCH_RATE_PER_HOUR >= 4, true);
  assert.equal(LAUNCH_RATE_PER_DAY >= 8, true);
});

test("the client key uses the platform address and ignores a rotated forwarded list", async () => {
  const headers = new Headers({
    "x-real-ip": "203.0.113.10",
    "x-forwarded-for": "198.51.100.4, 203.0.113.10",
  });
  assert.equal(clientAddress(headers), "203.0.113.10");
  const key = await clientKeyFromHeaders(headers);
  assert.equal(key, await clientKeyFromHeaders(new Headers({ "x-real-ip": "203.0.113.10" })));
  assert.notEqual(key, await clientKeyFromHeaders(new Headers({ "x-real-ip": "203.0.113.11" })));
  assert.equal(await clientKeyFromHeaders(new Headers()), null);
  assert.equal(clientAddress(new Headers({ "x-real-ip": "not an ip" })), null);
  assert.equal(
    clientAddress(new Headers({ "x-vercel-forwarded-for": "2001:db8::1" })),
    "2001:db8::1",
  );
  assert.equal(key && key.length, 32);
  assert.equal(key?.includes("203.0.113.10"), false);
});

test("hits older than an hour do not fill the hour budget", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  try {
    await pg.exec(`
      create table launch_rate_hits (
        id text primary key,
        client_key text not null,
        created_at timestamptz not null default now()
      )
    `);
    await pg.exec(`
      insert into launch_rate_hits (id, client_key, created_at) values
        ('old', 'abc', now() - interval '2 hours'),
        ('new', 'abc', now())
    `);
    const rows = await pg.query<{ hour_n: number; day_n: number }>(`
      select
        count(*) filter (where created_at > now() - interval '1 hour')::int as hour_n,
        count(*) filter (where created_at > now() - interval '1 day')::int as day_n
      from launch_rate_hits
      where client_key = 'abc'
    `);
    assert.equal(Number(rows.rows[0].hour_n), 1);
    assert.equal(Number(rows.rows[0].day_n), 2);
    assert.equal(launchRateAllows(Number(rows.rows[0].hour_n), Number(rows.rows[0].day_n)), true);
  } finally {
    await pg.close();
  }
});

test("the submit path checks the budget before insert and does not delete signups", () => {
  const source = readFileSync("src/lib/rummlee/launch-list.ts", "utf8");
  const migration = readFileSync("migrations/0059_launch_rate.sql", "utf8");
  assert.match(source, /launchRateAllows/);
  assert.match(source, /Too many submissions from this network/);
  const check = source.indexOf("if (clientKey) await assertLaunchRate");
  const insert = source.indexOf("insert into launch_signups");
  assert.equal(check > 0 && insert > check, true);
  assert.equal(/delete\s+from\s+launch_signups/i.test(source), false);
  assert.equal(/delete\s+from\s+launch_signups/i.test(migration), false);
  assert.equal(/drop\s+table\s+(if\s+exists\s+)?launch_signups/i.test(migration), false);
  assert.match(migration, /create table if not exists launch_rate_hits/);
});
