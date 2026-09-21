import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Wordmark } from "@/components/logo";
import { toast } from "sonner";
import { peekAfterLogin, takeAfterLogin } from "@/lib/rummlee/draft";
import { errMessage } from "@/lib/rummlee/errors";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({ email, password, name: email.split("@")[0] ?? "Neighbor" });
        if (res.error) throw new Error(res.error.message ?? "Could not create account");
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message ?? "Could not sign in");
      }
      window.location.assign(takeAfterLogin());
    } catch (err) {
      toast.error(errMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm py-10">
      <Wordmark className="mb-8 justify-center" />
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Sign in or create account</h1>
      <p className="mt-2 text-pretty text-muted">
        Browse free. Sign in to offer, list, or pay. You deal as a handle. Meet at a partner store — never a home address.
      </p>

      <div className="mt-8 space-y-2">
        {authEnabled ? (
          GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => signIn(p.providerId, { callbackURL: peekAfterLogin() })}
            >
              Continue with {p.label}
            </Button>
          ))
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
      </div>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-subtle">
        <span className="h-px flex-1 bg-border" />
        or email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onEmail} className="space-y-3">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in with email"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 w-full text-sm text-muted underline-offset-4 hover:underline"
        onClick={() => setMode(mode === "up" ? "in" : "up")}
      >
        {mode === "up" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>

      <p className="mt-8 text-center text-sm text-subtle">
        <Link to="/" className="underline-offset-4 hover:underline">
          Keep peeking
        </Link>
        <span className="mx-2">·</span>
        <Link to="/privacy" className="underline-offset-4 hover:underline">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link to="/terms" className="underline-offset-4 hover:underline">
          Terms
        </Link>
      </p>
    </main>
  );
}
