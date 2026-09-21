import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--color-primary)" />
      <path
        d="M10 8.2h7.6c3.4 0 5.6 2 5.6 5.1 0 2.5-1.4 4.2-3.6 4.9L24.2 24h-3.6l-4.2-5.5H13.2V24H10V8.2Zm3.2 2.5v4.8h4.2c1.7 0 2.7-1 2.7-2.4s-1-2.4-2.7-2.4h-4.2Z"
        fill="var(--color-primary-fg)"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className="size-8" />
      <span className="font-display text-xl font-semibold tracking-[-0.04em] text-fg">Rummlee</span>
    </span>
  );
}
