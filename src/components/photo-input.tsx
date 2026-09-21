import { useRef, useState } from "react";
import { Camera } from "lucide-react";
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

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await compressImage(file);
      onChange(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={cn(
        "relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-bg-warm text-muted shadow-[0_0_0_1px_rgba(28,25,21,0.08)]",
      )}
    >
      {value ? (
        <img src={value} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex flex-col items-center gap-2 text-sm">
          <Camera className="size-6" strokeWidth={1.6} />
          {busy ? "Preparing photo…" : "Take or choose a photo"}
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
  );
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not read photo"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read photo"));
    };
    img.src = objectUrl;
  });
}
