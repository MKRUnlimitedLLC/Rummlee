import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { compressPhoto } from "@/lib/rummlee/compress-photo";
import { cn } from "@/lib/utils";

export function PhotoInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await compressPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-bg-warm text-muted shadow-[0_0_0_1px_rgba(28,25,21,0.08)]",
        )}
      >
        {value ? (
          <img src={value} alt="Your photo" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-sm">
            <Camera className="size-6" strokeWidth={1.6} />
            {busy ? "Shrinking photo…" : "Take or choose a photo"}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </button>
      {error ? <p className="mt-1 text-sm text-fg">{error}</p> : null}
    </div>
  );
}
