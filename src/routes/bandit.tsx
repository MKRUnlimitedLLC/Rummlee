import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { answerBandit } from "@/lib/rummlee/bandit";
import type { FeeRow } from "@/lib/rummlee/fees";
import { getFeeTable } from "@/lib/rummlee/server";

export const Route = createFileRoute("/bandit")({
  head: () => ({
    meta: [
      { title: "Bandit" },
      { name: "apple-mobile-web-app-title", content: "Bandit" },
      { name: "theme-color", content: "#e4dfd6" },
    ],
    links: [
      { rel: "manifest", href: "/bandit/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      {
        children:
          '/* This route only. Stops the site manifest from being injected. href="/__grok/manifest.webmanifest" href="/__grok/icon-180.png" */',
      },
    ],
  }),
  component: BanditPage,
});

type Phase = "wait" | "listening" | "speaking";

type BanditRecEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; 0?: { transcript: string } };
  };
};

type BanditRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BanditRecEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognitionCtor() {
  if (typeof window === "undefined") return undefined;
  const host = window as Window & {
    webkitSpeechRecognition?: new () => BanditRec;
    SpeechRecognition?: new () => BanditRec;
  };
  return host.webkitSpeechRecognition ?? host.SpeechRecognition;
}

function installedApp() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function clearEnglishVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const english = voices.filter((voice) => /^en([-_]|$)/i.test(voice.lang));
  const preferred = [/samantha/i, /google us english(?!.*compact)/i, /google uk english female/i, /karen/i, /moira/i, /serena/i];
  for (const pattern of preferred) {
    const hit = english.find((voice) => pattern.test(voice.name));
    if (hit) return hit;
  }
  return english.find((voice) => /en-US/i.test(voice.lang)) ?? english[0];
}

function BanditPage() {
  const [standalone, setStandalone] = useState(false);
  const [phase, setPhase] = useState<Phase>("wait");
  const [line, setLine] = useState("");
  const [needsType, setNeedsType] = useState(false);
  const [draft, setDraft] = useState("");
  const phaseRef = useRef<Phase>("wait");
  const loopRef = useRef(false);
  const leftRef = useRef(false);
  const heardRef = useRef(false);
  const typeRef = useRef(false);
  const recRef = useRef<BanditRec | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const askRef = useRef<(question: string) => void>(() => {});

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    typeRef.current = needsType;
  }, [needsType]);

  useEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = "#e4dfd6";
    setStandalone(installedApp());
    if (!recognitionCtor()) setNeedsType(true);
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      clearEnglishVoice();
    };
    loadVoices();
    synth?.addEventListener("voiceschanged", loadVoices);
    return () => {
      leftRef.current = true;
      loopRef.current = false;
      document.body.style.background = previous;
      synth?.cancel();
      synth?.removeEventListener("voiceschanged", loadVoices);
      try {
        recRef.current?.abort();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  function stopHearing() {
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  }

  function beginListen() {
    if (leftRef.current || typeRef.current || phaseRef.current === "speaking") return;
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setNeedsType(true);
      return;
    }
    if (!recRef.current) {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (event) => {
        let said = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const piece = event.results[i];
          if (piece?.isFinal) said += piece[0]?.transcript ?? "";
        }
        said = said.trim();
        if (!said || phaseRef.current === "speaking") return;
        heardRef.current = true;
        phaseRef.current = "speaking";
        setPhase("speaking");
        try {
          rec.stop();
        } catch {
          /* stopped before speech */
        }
        askRef.current(said);
      };
      rec.onerror = (event) => {
        if (heardRef.current) return;
        if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
          setNeedsType(true);
          loopRef.current = false;
          phaseRef.current = "wait";
          setPhase("wait");
        }
      };
      rec.onend = () => {
        if (leftRef.current || !loopRef.current || phaseRef.current !== "listening") return;
        window.setTimeout(() => {
          if (leftRef.current || phaseRef.current !== "listening") return;
          try {
            rec.start();
          } catch {
            /* already listening */
          }
        }, 300);
      };
      recRef.current = rec;
    }
    phaseRef.current = "listening";
    setPhase("listening");
    try {
      recRef.current.start();
    } catch {
      /* start raced a stop */
    }
  }

  function resumeListen() {
    if (leftRef.current || !loopRef.current || typeRef.current) {
      phaseRef.current = "wait";
      setPhase("wait");
      return;
    }
    beginListen();
  }

  function speak(text: string) {
    const synth = window.speechSynthesis;
    if (!synth) {
      resumeListen();
      return;
    }
    synth.cancel();
    const voice = clearEnglishVoice();
    const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [text];
    parts.forEach((part, index) => {
      const utter = new SpeechSynthesisUtterance(part);
      utter.lang = voice?.lang || "en-US";
      if (voice) utter.voice = voice;
      utter.rate = 0.96;
      if (index === parts.length - 1) {
        utter.onend = () => resumeListen();
        utter.onerror = () => resumeListen();
      }
      synth.speak(utter);
    });
  }

  askRef.current = (question: string) => {
    phaseRef.current = "speaking";
    setPhase("speaking");
    stopHearing();
    void (async () => {
      let table: FeeRow[] | null = null;
      try {
        const data = await getFeeTable();
        table = data.fees?.length ? data.fees : null;
      } catch {
        table = null;
      }
      if (leftRef.current) return;
      const answer = answerBandit(question, table);
      setLine(answer);
      speak(answer);
    })();
  };

  function onDog() {
    if (phaseRef.current === "speaking") return;
    if (typeRef.current || !recognitionCtor()) {
      setNeedsType(true);
      fieldRef.current?.focus();
      return;
    }
    loopRef.current = true;
    const synth = window.speechSynthesis;
    if (synth) {
      const unlock = new SpeechSynthesisUtterance(" ");
      unlock.volume = 0;
      unlock.lang = "en-US";
      synth.speak(unlock);
    }
    beginListen();
  }

  function onTyped(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || phaseRef.current === "speaking") return;
    setDraft("");
    askRef.current(question);
  }

  const bob = phase === "speaking" ? "bandit-speak" : "bandit-idle";

  return (
    <main className={`flex min-h-full flex-col bg-[#e4dfd6] text-[#161412] ${standalone ? "bandit-app" : ""}`}>
      <style>{`
        @keyframes bandit-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .bandit-idle { animation: bandit-bob 2.8s ease-in-out infinite; }
        .bandit-speak { animation: bandit-bob 1.05s ease-in-out infinite; }
        .bandit-tap { display: none; }
        @media (display-mode: standalone) {
          .bandit-install { display: none; }
          .bandit-tap { display: block; }
        }
        .bandit-app .bandit-install { display: none; }
        .bandit-app .bandit-tap { display: block; }
        @media (prefers-reduced-motion: reduce) {
          .bandit-idle, .bandit-speak { animation: none; }
        }
      `}</style>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onDog}
          aria-label="Bandit"
          className="border-0 bg-transparent p-0"
        >
          <img
            src="/brand/mark.png"
            alt=""
            width={256}
            height={256}
            className={`bandit-mark w-[min(78vw,320px)] max-w-full ${bob}`}
            style={{ outline: "none" }}
          />
        </button>
        {phase === "wait" ? <p className="bandit-tap mt-8 text-center text-lg">Tap him to talk.</p> : null}
        {line ? (
          <p id="bandit-said" className="mt-8 max-w-sm text-center text-base leading-relaxed" aria-live="polite">
            {line}
          </p>
        ) : (
          <p className="sr-only" aria-live="polite">
            {phase === "listening" ? "Listening" : ""}
          </p>
        )}
        {needsType ? (
          <form onSubmit={onTyped} className="mt-8 w-full max-w-sm">
            <label htmlFor="bandit-ask" className="sr-only">
              Ask Bandit
            </label>
            <input
              id="bandit-ask"
              ref={fieldRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about a fee"
              autoComplete="off"
              enterKeyHint="send"
              className="w-full border-0 border-b border-[#161412]/30 bg-transparent px-1 py-3 text-center text-base outline-none"
            />
          </form>
        ) : null}
      </div>
      <div className="bandit-install space-y-1 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-base">
        <p>Share</p>
        <p>Add to Home Screen</p>
        <p>Add</p>
      </div>
    </main>
  );
}
