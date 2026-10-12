"use client";

import Link from "next/link";
import { useActionState } from "react";
import { subscribeToSms } from "./actions";
import { SMS_CONSENT_TEXT } from "@/lib/sms-consent";

export function SmsSignupForm() {
  const [state, action, pending] = useActionState(subscribeToSms, { success: false, message: "" });
  if (state.success) return <p role="status">{state.message}</p>;
  return (
    <form action={action} className="stack">
      <label htmlFor="sms-name">Name</label>
      <input className="input" id="sms-name" name="name" autoComplete="name" maxLength={120} required />
      <label htmlFor="sms-phone">Mobile number</label>
      <input className="input" id="sms-phone" name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="(806) 555-0123" required />
      <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <input type="checkbox" name="consent" value="yes" required style={{ width: "auto", marginTop: "0.3rem" }} />
        <span>{SMS_CONSENT_TEXT}</span>
      </label>
      <p><Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">SMS Terms &amp; Conditions</Link></p>
      <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Subscribe to church texts"}</button>
      {state.message && <p role="alert">{state.message}</p>}
    </form>
  );
}
