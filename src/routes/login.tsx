import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, findKey, setToken, syncSupabaseUser } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sign in — NPrep" },
      { name: "description", content: "Sign in to NPrep with your mobile number." },
      { property: "og:title", content: "Sign in — NPrep" },
      { property: "og:description", content: "Sign in to NPrep with your mobile number." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [timer, setTimer] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const valid = /^[6-9]\d{9}$/.test(phone);

  async function requestOtp() {
    setErr(""); setBusy(true);
    try {
      await api("/auth/request-otp", { method: "POST", body: JSON.stringify({ phone_number: phone, country_code: "+91" }) });
      void syncSupabaseUser(phone, { raw: { otp_requested_at: new Date().toISOString() } }).catch((syncError) => console.error("Could not save mobile number", syncError));
      setStep("otp"); setTimer(45);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function verify() {
    setErr(""); setBusy(true);
    try {
      const res = await api("/auth/login", { method: "POST", body: JSON.stringify({ phone_number: phone, otp }) });
      const token = findKey(res, /^(access_?token|token|accessToken|jwt)$/i) ?? findKey(res, /token/i);
      if (!token) throw new Error("Login succeeded but no token was returned");
      setToken(String(token));
      void syncSupabaseUser(phone, { auth: res, raw: res }).catch((syncError) => console.error("Could not save user data", syncError));
      navigate({ to: "/", replace: true });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const input = "w-full rounded-lg border border-input bg-background px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-ring";
  const btn = "w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50";

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground md:flex">
        <div className="flex items-center gap-3 font-display text-3xl font-bold">
          <img src="/nprep-logo.jpg" alt="" className="h-12 w-12 rounded-lg object-cover" />
          <span>NPrep</span>
        </div>
        <div>
          <h1 className="font-display text-5xl font-bold leading-tight">Prepare smarter for your nursing exams.</h1>
          <p className="mt-4 text-lg opacity-80">Lectures, notes, PYQs and test series — all in one place.</p>
        </div>
        <div className="text-sm opacity-70">Medical & nursing preparation</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="font-display text-3xl font-bold">{step === "phone" ? "Welcome back" : "Enter OTP"}</h2>
            <p className="mt-1 text-muted-foreground">
              {step === "phone" ? "Sign in with your mobile number" : `Sent to +91 ${phone}`}
            </p>
          </div>
          {step === "phone" ? (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) requestOtp(); }}>
              <div className="flex gap-2">
                <span className="flex items-center rounded-lg border border-input bg-muted px-3 text-lg">+91</span>
                <input className={input} inputMode="numeric" placeholder="10-digit mobile" value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
              </div>
              {phone.length === 10 && !valid && <p className="text-sm text-destructive">Enter a valid Indian mobile number</p>}
              <button className={btn} disabled={!valid || busy}>{busy ? "Sending…" : "Get OTP"}</button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (otp.length >= 4) verify(); }}>
              <input className={input + " text-center tracking-[0.5em]"} inputMode="numeric" autoFocus placeholder="••••••"
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              <button className={btn} disabled={otp.length < 4 || busy}>{busy ? "Verifying…" : "Verify & sign in"}</button>
              <div className="flex justify-between text-sm">
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep("phone"); setOtp(""); }}>Change number</button>
                <button type="button" disabled={timer > 0 || busy} onClick={requestOtp} className="font-medium text-primary disabled:text-muted-foreground">
                  {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}
          {err && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
        </div>
      </div>
    </div>
  );
}
