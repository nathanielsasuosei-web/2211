"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction, signupAction } from "@/lib/actions/auth";
import { useActionToast } from "./Toast";
import { IconBolt, IconCheck, IconUser } from "./icons";

export default function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const action = mode === "signup" ? signupAction : loginAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  useActionToast(state);
  const router = useRouter();

  useEffect(() => {
    if (state?.redirect) router.push(state.redirect);
  }, [router, state]);

  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="panel pad-lg stack" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">{isSignup ? "Create account" : "Sign in"}</span>
        <h2 className="display h-sm">{isSignup ? "Join the roster" : "Back to your studio"}</h2>
      </div>

      {next && <input type="hidden" name="next" value={next} />}

      <div className="stack" style={{ gap: 14 }}>
        {isSignup && (
          <div className="field">
            <label htmlFor="a-name">Artist / full name</label>
            <input id="a-name" name="name" className="input" required minLength={2} maxLength={80} placeholder="Kwame Ace" autoComplete="name" />
          </div>
        )}

        <div className="field">
          <label htmlFor="a-email">Email</label>
          <input
            id="a-email"
            name="email"
            type="email"
            className="input"
            required
            placeholder="you@email.com"
            autoComplete="email"
          />
          <span className="hint">Licences, receipts and beat files are delivered here.</span>
        </div>

        {isSignup && (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="a-phone">Phone (mobile money)</label>
              <input id="a-phone" name="phone" className="input" placeholder="+233 24 000 0000" autoComplete="tel" />
            </div>
            <div className="field">
              <label htmlFor="a-country">Country</label>
              <input id="a-country" name="country" className="input" placeholder="Ghana" autoComplete="country-name" />
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="a-password">Password</label>
          <input
            id="a-password"
            name="password"
            type="password"
            className="input"
            required
            minLength={isSignup ? 8 : 1}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
        </div>

        {isSignup && (
          <label className="check">
            <input type="checkbox" name="terms" value="on" required />
            <span>
              I accept the <Link href="/licensing" className="red">licence terms</Link> and want product updates by email.
            </span>
          </label>
        )}
      </div>

      {state?.error && <div className="form-error">{state.error}</div>}
      {state?.ok && state.message && <div className="form-ok">{state.message}</div>}

      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
        {pending ? (
          "Please wait…"
        ) : isSignup ? (
          <>
            <IconBolt size={16} /> Create my account
          </>
        ) : (
          <>
            <IconUser size={16} /> Sign in
          </>
        )}
      </button>

      {isSignup ? (
        <div className="stack" style={{ gap: 7 }}>
          {[
            "No card needed to browse and preview",
            "Files delivered by email the second payment clears",
            "Message the producer directly from your Studio",
          ].map((line) => (
            <span key={line} className="tiny muted row" style={{ gap: 8 }}>
              <IconCheck size={12} className="red" /> {line}
            </span>
          ))}
          <span className="tiny dim">
            Already have an account? <Link href="/login" className="red">Sign in</Link>
          </span>
        </div>
      ) : (
        <span className="tiny dim">
          New here? <Link href="/signup" className="red">Create a free artist account</Link>
        </span>
      )}
    </form>
  );
}
