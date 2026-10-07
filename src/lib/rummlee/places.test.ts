import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NEIGHBORHOODS } from "./constants.ts";
import { cityForQuery, isListedCity, nearestSampleCity, placeSuggestions, SAMPLE_POINT } from "./places.ts";

test("sample points are the neighborhoods we already have, and no others", () => {
  assert.deepEqual(Object.keys(SAMPLE_POINT).sort(), [...NEIGHBORHOODS].sort());
});

test("place search stays empty until it cannot be the whole city catalog", () => {
  assert.deepEqual(placeSuggestions(""), []);
  assert.deepEqual(placeSuggestions("a"), []);
  assert.deepEqual(placeSuggestions(" z "), []);
});

test("place search matches sample neighborhoods and does not invent a city", () => {
  assert.deepEqual(placeSuggestions("fargo"), ["West Fargo, Fargo–Moorhead"]);
  assert.deepEqual(placeSuggestions("chicago"), ["Lincoln Park, Chicago", "Naperville, Chicago"]);
  assert.deepEqual(placeSuggestions("zzzz-no-such-place"), []);
  assert.equal(cityForQuery("fargo"), null);
  assert.equal(cityForQuery("Fargo–Moorhead"), "Fargo–Moorhead");
  assert.equal(cityForQuery("Park Slope, Brooklyn"), "Brooklyn");
  assert.equal(isListedCity("Brooklyn"), true);
  assert.equal(isListedCity("Atlantis"), false);
});

test("near you uses a sample city only when the viewer is actually close", () => {
  assert.equal(nearestSampleCity(46.877, -96.9), "Fargo–Moorhead");
  assert.equal(nearestSampleCity(44.948, -93.298), "Minneapolis");
  assert.equal(nearestSampleCity(0, 0), null);
  assert.equal(nearestSampleCity(46.9, -96.9, 1), null);
  assert.equal(nearestSampleCity(Number.NaN, -96.9), null);
});

test("browse does not lead with a city chip list", () => {
  const home = readFileSync(new URL("../../routes/index.tsx", import.meta.url), "utf8");
  const listing = readFileSync(new URL("../../routes/listings.$id.tsx", import.meta.url), "utf8");
  assert.equal(home.includes("Nationwide"), false);
  assert.equal(home.includes("CITIES.map"), false);
  assert.equal(home.includes("Show every city"), false);
  assert.match(home, /Search a city or neighborhood/);
  assert.match(home, /Use my location/);
  assert.equal(listing.includes("City chips"), false);
});
