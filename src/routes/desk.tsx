import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errMessage } from "@/lib/rummlee/errors";
import { getCounterHome, scanAtCounter, type CounterHit } from "@/lib/rummlee/desk";

export const Route = createFileRoute("/desk")({
  component: DeskPage,
});

const SECRET_KEY = "rummlee.counter";

function readSecret() {
  try {
    return localStorage.getItem(SECRET_KEY) ?? "";
  } catch {
    return "";
  }
}

function DeskPage() {
  const qc = useQueryClient();
  const [secret, setSecret] = useState("");
  const [draft, setDraft] = useState("");
  const [code, setCode] = useState("");
  const [hit, setHit] = useState<CounterHit | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    setSecret(readSecret());
  }, []);

  const home = useQuery({
    queryKey: ["counter", secret],
    queryFn: () => getCounterHome({ data: { deviceSecret: secret || undefined } }),
  });

  const scan = useMutation({
    mutationFn: (value: string) => scanAtCounter({ data: { code: value.trim(), deviceSecret: secret || undefined } }),
    onSuccess: (res) => {
      setHit(res);
      setCode("");
      void qc.invalidateQueries({ queryKey: ["counter", secret] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const scanRef = useRef(scan.mutate);
  scanRef.current = scan.mutate;

  useEffect(() => {
    if (!cameraOn) return;
    let stop = false;
    let stream: MediaStream | null = null;
    const video = videoRef.current;
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!video || !Detector || !navigator.mediaDevices) {
      setCameraOn(false);
      toast.message("This browser can’t scan. Type the code instead.");
      return;
    }
    const detector = new Detector({ formats: ["qr_code"] });
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((media) => {
      if (stop) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = media;
      video.srcObject = media;
      void video.play();
    }).catch(() => {
      setCameraOn(false);
      toast.message("Camera blocked. Type the code instead.");
    });
    const last = useRef("");
    const timer = window.setInterval(() => {
      if (!video || video.readyState < 2) return;
      void detector.detect(video).then((codes) => {
        const raw = codes[0]?.rawValue;
        if (raw && raw !== last.current) {
          last.current = raw;
          scanRef.current(raw);
        }
      }).catch(() => undefined);
    }, 900);
    return () => {
      stop = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraOn]);

  function saveSecret(value: string) {
    const next = value.trim();
    localStorage.setItem(SECRET_KEY, next);
    setSecret(next);
    setDraft("");
  }

  const ready = Boolean(secret && home.data?.ready);

  return (
    <main className="mx-auto max-w-md py-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-primary-ink">Rummlee counter</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.03em]">
        {ready ? home.data?.spotName : "Pair this screen"}
      </h1>
      <p className="mt-2 text-muted">
        {ready
          ? `${home.data?.area}. ${home.data?.holding ?? 0} packages waiting. No names on this screen.`
          : "This is the software a store counter runs. Pair it once. Then it only scans in and scans out."}
      </p>

      {!ready ? (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveSecret(draft);
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Pairing code" className="text-center font-mono" />
          <Button type="submit" className="w-full">
            Pair
          </Button>
          <p className="text-sm text-muted">Corporate creates the pairing code. It stays on this device.</p>
        </form>
      ) : (
        <>
          {hit ? (
            <div className="mt-6 rounded-[28px] bg-surface px-4 py-8 shadow-[var(--shadow-card)]">
              <p className="text-sm font-medium uppercase tracking-wider text-primary-ink">
                {hit.kind === "in" ? "Tag the package" : hit.kind === "out" ? "Hand off this tag" : hit.kind === "wait" ? "Not checked in" : "Already handed off"}
              </p>
              <p className="mt-2 font-display text-7xl font-semibold tracking-[-0.04em]">
                {hit.packageNo ?? "—"}
              </p>
              <p className="mt-2 text-sm text-muted">Write the number on the package. Nothing else.</p>
            </div>
          ) : null}
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) scan.mutate(code);
            }}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Scan or type a code"
              className="text-center font-mono"
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={scan.isPending}>
              {scan.isPending ? "Checking…" : "Scan"}
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setCameraOn((on) => !on)}>
              {cameraOn ? "Stop camera" : "Use camera"}
            </Button>
          </form>
          {cameraOn ? <video ref={videoRef} className="mt-4 aspect-square w-full rounded-2xl bg-fg object-cover" muted playsInline /> : null}
          <button
            type="button"
            className="mt-6 text-sm text-muted"
            onClick={() => {
              localStorage.removeItem(SECRET_KEY);
              setSecret("");
              setHit(null);
            }}
          >
            Unpair this screen
          </button>
        </>
      )}
    </main>
  );
}
