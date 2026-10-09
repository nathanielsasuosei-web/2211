"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/auth";
import { useActionToast } from "./Toast";
import { IconCheck, IconShield, IconUser } from "./icons";

type Profile = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  email_opt_in: boolean;
};

export default function ProfileForm({ user }: { user: Profile }) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfileAction, undefined);
  const [pwState, pwAction, pwPending] = useActionState(changePasswordAction, undefined);
  const [showPw, setShowPw] = useState(false);
  useActionToast(profileState);
  useActionToast(pwState);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <form action={profileAction} className="panel pad-lg stack" style={{ gap: 16 }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">
            <IconUser size={12} /> Profile
          </span>
          <h2 className="display h-sm">Your artist details</h2>
          <p className="tiny muted" style={{ margin: 0 }}>
            Used on licences, receipts and payment prompts. Email is the address your beats are delivered to.
          </p>
        </div>

        <div className="field">
          <label htmlFor="p-email">Email (delivery address)</label>
          <input id="p-email" className="input" value={user.email} disabled />
          <span className="hint">Contact the producer if you need to change your delivery email.</span>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="p-name">Artist / full name</label>
            <input id="p-name" name="name" className="input" defaultValue={user.name} required minLength={2} />
          </div>
          <div className="field">
            <label htmlFor="p-phone">Phone (mobile money)</label>
            <input id="p-phone" name="phone" className="input" defaultValue={user.phone ?? ""} placeholder="+233 24 000 0000" />
          </div>
          <div className="field">
            <label htmlFor="p-country">Country</label>
            <input id="p-country" name="country" className="input" defaultValue={user.country ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="p-city">City</label>
            <input id="p-city" name="city" className="input" defaultValue={user.city ?? ""} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="p-bio">Short bio / what you are working on</label>
          <textarea id="p-bio" name="bio" className="textarea" defaultValue={user.bio ?? ""} maxLength={600} />
        </div>

        <label className="check">
          <input type="checkbox" name="email_opt_in" defaultChecked={user.email_opt_in} />
          <span>Email me new beats, discounts and producer updates</span>
        </label>

        {profileState?.error && <div className="form-error">{profileState.error}</div>}

        <button type="submit" className="btn btn--primary" disabled={profilePending}>
          <IconCheck size={15} /> {profilePending ? "Saving…" : "Save profile"}
        </button>
      </form>

      <div className="panel panel--flat pad stack" style={{ gap: 12 }}>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => setShowPw((v) => !v)} style={{ alignSelf: "flex-start" }}>
          <IconShield size={14} /> {showPw ? "Hide password form" : "Change password"}
        </button>

        {showPw && (
          <form action={pwAction} className="stack" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="p-current">Current password</label>
              <input id="p-current" name="current" type="password" className="input" required autoComplete="current-password" />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="p-next">New password</label>
                <input id="p-next" name="next" type="password" className="input" required minLength={8} autoComplete="new-password" />
              </div>
              <div className="field">
                <label htmlFor="p-confirm">Confirm new password</label>
                <input id="p-confirm" name="confirm" type="password" className="input" required minLength={8} autoComplete="new-password" />
              </div>
            </div>
            {pwState?.error && <div className="form-error">{pwState.error}</div>}
            {pwState?.ok && pwState.message && <div className="form-ok">{pwState.message}</div>}
            <button type="submit" className="btn btn--primary btn--sm" disabled={pwPending} style={{ alignSelf: "flex-start" }}>
              {pwPending ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
