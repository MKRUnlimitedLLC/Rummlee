import { cn } from "@/lib/utils";

/** Circular peek badge — used as a compact mark where wordmark text is separate. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/badge-peek-128.png"
      alt=""
      width={32}
      height={32}
      className={cn("size-8 rounded-full object-cover", className)}
      aria-hidden
      decoding="async"
    />
  );
}

/**
 * Header / login wordmark. Uses the leaping puppy + arched RUMMLEE art
 * (image already includes the name — no extra text to avoid a double wordmark).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <img
        src="/brand/wordmark-leap-header.png"
        alt="Rummlee"
        width={205}
        height={160}
        className="h-10 w-auto max-w-[11rem] object-contain object-left"
        decoding="async"
      />
    </span>
  );
}
