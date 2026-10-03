import { Moon } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "rummlee.theme.v1";

function paintChrome(dark: boolean) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#1c1917" : "#C8101E");
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const on = document.documentElement.classList.contains("rummlee-dark");
    setDark(on);
    paintChrome(on);
  }, []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Dark mode on" : "Dark mode off"}
      className={
        dark
          ? "grid size-11 shrink-0 place-items-center rounded-full bg-fg text-primary-fg"
          : "grid size-11 shrink-0 place-items-center rounded-full text-fg"
      }
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("rummlee-dark", next);
        paintChrome(next);
        try {
          localStorage.setItem(KEY, next ? "dark" : "light");
        } catch {
          /* ignore */
        }
        setDark(next);
      }}
    >
      <Moon className="size-5" strokeWidth={1.8} fill={dark ? "currentColor" : "none"} />
    </button>
  );
}