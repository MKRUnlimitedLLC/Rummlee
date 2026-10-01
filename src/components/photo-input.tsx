import { useRef, useState, type RefObject } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";
import { compressPhoto } from "@/lib/rummlee/compress-photo";
import { cn } from "@/lib/utils";

export function PhotoInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined, input: HTMLInputElement | null) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await compressPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that photo.");
    } finally {
      setBusy(false);
      if (input) input.value = "";
    }
  }

  return (
    <div>
      <div
        className={cn(
          "relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-bg-warm text-muted shadow-[0_0_0_1px_rgba(28,25,21,0.08)]",
        )}
      >
        {value ? (
          <img src={value} alt="Your photo" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-4 text-center text-sm">
            <Camera className="size-6" strokeWidth={1.6} />
            {busy ? "Shrinking photo…" : "Add a photo of this item"}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Pick
          label={value ? "Retake" : "Take a photo"}
          icon={Camera}
          inputRef={cameraRef}
          capture
          busy={busy}
          onFile={(file) => void onFile(file, cameraRef.current)}
        />
        <Pick
          label={value ? "Choose another" : "Photo library"}
          icon={ImageIcon}
          inputRef={libraryRef}
          busy={busy}
          onFile={(file) => void onFile(file, libraryRef.current)}
        />
      </div>
      {error ? <p className="mt-1 text-sm text-fg">{error}</p> : null}
    </div>
  );
}

function Pick({
  label,
  icon: Icon,
  inputRef,
  capture,
  busy,
  onFile,
}: {
  label: string;
  icon: typeof Camera;
  inputRef: RefObject<HTMLInputElement | null>;
  capture?: boolean;
  busy: boolean;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <label className="relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface px-3 text-sm font-medium text-fg shadow-[0_0_0_1px_rgba(28,25,21,0.1)]">
      <Icon className="size-4" strokeWidth={1.8} />
      {busy ? "Working…" : label}
      <input
        ref={inputRef}
        type="file"
        accept={capture ? "image/*" : "image/*,.heic,.heif"}
        capture={capture ? "environment" : undefined}
        disabled={busy}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  );
}
