import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <img src="/brand/mark.png" alt="" className={cn("size-8 rounded-[9px] object-cover", className)} />
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
