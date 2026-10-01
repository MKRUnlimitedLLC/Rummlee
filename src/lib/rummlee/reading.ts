export type Reading = "simple" | "full";

const ASKED = "rummlee.readingAsked";
const MODE = "rummlee.reading";
const LEGACY = "rummlee.largeType";

export function currentReading(): Reading {
  if (typeof localStorage === "undefined") return "full";
  const mode = localStorage.getItem(MODE);
  if (mode === "simple" || mode === "full") return mode;
  return localStorage.getItem(LEGACY) === "1" ? "simple" : "full";
}

export function readingWasAsked() {
  if (typeof localStorage === "undefined") return true;
  if (localStorage.getItem(ASKED) === "1") return true;
  const mode = localStorage.getItem(MODE);
  if (mode === "simple" || mode === "full") return true;
  return localStorage.getItem(LEGACY) != null;
}

export function paintReading(mode: Reading) {
  const simple = mode === "simple";
  document.documentElement.classList.toggle("rummlee-large", simple);
  document.documentElement.classList.toggle("rummlee-simple", simple);
}

export function applyReading(mode: Reading) {
  paintReading(mode);
  localStorage.setItem(MODE, mode);
  localStorage.setItem(LEGACY, mode === "simple" ? "1" : "0");
  localStorage.setItem(ASKED, "1");
  window.dispatchEvent(new Event("rummlee-reading"));
}
