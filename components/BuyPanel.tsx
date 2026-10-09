"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOrderAction, claimFreeBeatAction } from "@/lib/actions/checkout";
import { useActionToast, useToast } from "./Toast";
import { usePlayer, type Track } from "./player-context";
import { IconBolt, IconCheck, IconDownload, IconPause, IconPlay, IconShield } from "./icons";
import { licensePerks } from "@/lib/view";
import { moneyLabel } from "@/lib/money";
import type { License } from "@/lib/types";

type Props = {
  beatId: string;
  beatSlug: string;
  beatTitle: string;
  currency: string;
  isFree: boolean;
  exclusiveSold: boolean;
  licenses: License[];
  track: Track;
  signedIn: boolean;
  owned: boolean;
  initialLicenseId?: string;
};

export default function BuyPanel({
  beatId,
  beatTitle,
  currency,
  isFree,
  exclusiveSold,
  licenses,
  track,
  signedIn,
  owned,
  initialLicenseId,
}: Props) {
  const router = useRouter();
  const { push } = useToast();
  const { toggle, isPlaying, track: current } = usePlayer();
  const [selected, setSelected] = useState<string>(
    initialLicenseId && licenses.some((l) => l.id === initialLicenseId)
      ? initialLicenseId
      : (licenses[1]?.id ?? licenses[0]?.id ?? ""),
  );
  const [state, action, pending] = useActionState(isFree ? claimFreeBeatAction : createOrderAction, undefined);
  useActionToast(state);

  const playing = current?.id === track.id && isPlaying;
  const license = licenses.find((l) => l.id === selected) ?? null;

  useEffect(() => {
    if (state?.redirect) router.push(state.redirect);
  }, [router, state]);

  if (exclusiveSold) {
    return (
      <div className="panel panel--flat pad-lg stack" style={{ gap: 12 }}>
        <span className="chip chip--bad">Sold exclusively</span>
        <h3 className="h-sm display">This beat has been bought out</h3>
        <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
          “{beatTitle}” is no longer available for licence. Browse similar instrumentals below or request a custom
          production built around the same vibe.
        </p>
        <span className="row" style={{ gap: 10 }}>
          <Link href="/beats" className="btn btn--primary btn--sm">
            Find a similar beat
          </Link>
          <Link href="/contact" className="btn btn--outline btn--sm">
            Request custom production
          </Link>
        </span>
      </div>
    );
  }

  return (
    <div className="panel pad-lg stack" style={{ gap: 18 }}>
      <div className="row row--between row--wrap" style={{ gap: 10 }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Choose your licence</span>
          <h3 className="display h-sm">
            License “{beatTitle}”
          </h3>
        </div>
        <button
          type="button"
          className="btn-play"
          onClick={() => toggle(track)}
          data-playing={playing}
          aria-label={playing ? "Pause preview" : "Play preview"}
        >
          {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
        </button>
      </div>

      {owned && (
        <div className="form-ok row" style={{ gap: 10 }}>
          <IconCheck size={16} />
          <span>
            You already own a licence for this beat — download it again any time from{" "}
            <Link href="/studio?tab=vault" className="red">
              your Vault
            </Link>
            .
          </span>
        </div>
      )}

      {isFree ? (
        <div className="panel panel--red pad stack" style={{ gap: 10 }}>
          <span className="chip chip--ok">Free download</span>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            This instrumental is free for non-commercial use with producer credit. Sign in and the files are emailed to
            you instantly.
          </p>
        </div>
      ) : licenses.length === 0 ? (
        <p className="muted">Licences are being updated for this beat — message the producer for pricing.</p>
      ) : (
        <div className="license-grid">
          {licenses.map((l) => {
            const perks = licensePerks(l);
            return (
              <button
                key={l.id}
                type="button"
                className="license-card"
                data-selected={selected === l.id}
                onClick={() => setSelected(l.id)}
                aria-pressed={selected === l.id}
              >
                <span className="row row--between" style={{ gap: 8 }}>
                  <strong style={{ fontSize: 14.5, letterSpacing: "0.01em" }}>{l.name}</strong>
                  {l.allows_exclusive ? <span className="chip chip--red">Exclusive</span> : null}
                </span>
                <span className="price">{moneyLabel(l.price_cents, l.currency || currency)}</span>
                {l.description && (
                  <span className="tiny muted" style={{ lineHeight: 1.55 }}>
                    {l.description}
                  </span>
                )}
                {perks.length > 0 && (
                  <ul>
                    {perks.slice(0, 4).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </button>
            );
          })}
        </div>
      )}

      <form action={action} className="stack" style={{ gap: 12 }}>
        <input type="hidden" name="beat_id" value={beatId} />
        <input type="hidden" name="license_id" value={isFree ? (licenses[0]?.id ?? "") : selected} />

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
          {pending ? "Preparing your order…" : <><IconBolt size={17} /> {isFree ? "Get this beat free" : `Buy ${license?.name ?? "licence"} — ${license ? moneyLabel(license.price_cents, license.currency || currency) : ""}`}</>}
        </button>

        {!signedIn && (
          <p className="tiny muted center" style={{ margin: 0 }}>
            You will be asked to{" "}
            <Link href="/signup" className="red">
              create a free artist account
            </Link>{" "}
            first — it takes 30 seconds and keeps your licences in one place.
          </p>
        )}

        <div className="row row--wrap" style={{ gap: 8, justifyContent: "center" }}>
          <span className="chip">
            <IconShield size={13} /> Secure checkout
          </span>
          <span className="chip">MTN MoMo · M-Pesa · Card · Bank</span>
          <span className="chip">
            <IconDownload size={13} /> Delivered by email
          </span>
        </div>

        {state?.error && <div className="form-error">{state.error}</div>}
      </form>

      {!isFree && (
        <p className="tiny dim center" style={{ margin: 0 }}>
          Need stems, a custom arrangement or an exclusive buy-out?{" "}
          <button type="button" className="red" style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }} onClick={() => push("Use the contact page to reach the producer directly.", "info")}>
            Ask the producer
          </button>{" "}
          or open <Link href="/contact" className="red">contact</Link>.
        </p>
      )}
    </div>
  );
}
