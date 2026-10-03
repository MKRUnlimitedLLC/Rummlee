import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <img src="/brand/mark.png" alt="" className={cn("size-8 rounded-[9px] object-cover", className)} />
  );
}

export function Wordmark({ className }: { className?: string }) {
  const larger = className?.includes("justify-center");
  return (
    <img
      src="/brand/leaping.jpg"
      alt="Rummlee"
      className={cn("w-auto object-contain", larger ? "h-16" : "h-11", className)}
    />
  );
}
