import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { publicHead } from "@/lib/rummlee/seo";

const FILMS = [
  {
    id: "rain",
    src: "/films/rummlee-15-rain.mp4",
    title: "Rain day",
    line: "You stay in. Someone else picks it up.",
  },
  {
    id: "blizzard",
    src: "/films/rummlee-15-blizzard.mp4",
    title: "Blizzard",
    line: "The door stays shut.",
  },
  {
    id: "haggle",
    src: "/films/rummlee-15-haggle.mp4",
    title: "Done with the debate",
    line: "One offer. Then it’s done.",
  },
  {
    id: "sofa",
    src: "/films/rummlee-15-sofa.mp4",
    title: "Too big for a counter",
    line: "They still pick it up. Your address stays off.",
  },
  {
    id: "apartment",
    src: "/films/rummlee-15-apartment.mp4",
    title: "No driveway",
    line: "Pickup at a store. No one comes to your house.",
  },
  {
    id: "saturday",
    src: "/films/rummlee-15-saturday.mp4",
    title: "Outgrown",
    line: "Saturday stays yours.",
  },
] as const;

export const Route = createFileRoute("/films")({
  head: () =>
    publicHead(
      "/films",
      "Rummlee films",
      "The good stuff, before Saturday. Pick it up at an official store, so no one comes to your house. Rummlee isn’t open yet.",
    ),
  component: Films,
});

function Films() {
  const [id, setId] = useState<(typeof FILMS)[number]["id"]>("rain");
  const film = FILMS.find((item) => item.id === id) ?? FILMS[0];

  return (
    <main className="py-8">
      <p className="text-sm font-medium text-primary-ink">Rummlee</p>
      <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em]">Six ways in</h1>
      <p className="mt-2 max-w-xl text-pretty text-muted">
        The good stuff, before Saturday. Pick it up at an official store, so no one comes to your house. Rummlee isn’t open yet.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {FILMS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === film.id}
            onClick={() => setId(item.id)}
            className={
              item.id === film.id
                ? "rounded-full bg-primary-ink px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-[var(--shadow-card)]"
            }
          >
            {item.title}
          </button>
        ))}
      </div>
      <figure className="mt-5">
        <video
          key={film.src}
          src={film.src}
          controls
          playsInline
          preload="metadata"
          className="mx-auto aspect-[9/16] w-full max-w-[380px] rounded-2xl bg-fg"
        />
        <figcaption className="mx-auto mt-3 max-w-[380px]">
          <p className="font-medium text-fg">{film.title}</p>
          <p className="mt-1 text-sm text-muted">{film.line}</p>
        </figcaption>
      </figure>
      <p className="mt-8 text-sm text-muted">
        <Link to="/" className="font-medium text-primary-ink underline-offset-4 hover:underline">
          Home
        </Link>
        <span className="mx-2">·</span>
        Nothing ships. No card is charged.
      </p>
    </main>
  );
}
