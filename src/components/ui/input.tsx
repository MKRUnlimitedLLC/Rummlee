import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg bg-surface px-3.5 text-[15px] text-fg shadow-[0_0_0_1px_rgba(28,25,21,0.1)] outline-none transition-[box-shadow] duration-150 placeholder:text-subtle focus:shadow-[0_0_0_2px_var(--color-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg bg-surface px-3.5 py-2.5 text-[15px] text-fg shadow-[0_0_0_1px_rgba(28,25,21,0.1)] outline-none transition-[box-shadow] duration-150 placeholder:text-subtle focus:shadow-[0_0_0_2px_var(--color-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-fg", className)} {...props} />
  );
}
