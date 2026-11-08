import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, ApiError, findKey, setToken, syncSupabaseUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

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
  const [retryAction, setRetryAction] = useState<"request" | "verify" | null>(null);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const valid = /^[6-9]\d{9}$/.test(phone);

  async function requestOtp() {
    setErr(""); setRetryAction(null); setBusy(true);
    try {
      await api("/auth/request-otp", { method: "POST", body: JSON.stringify({ phone_number: phone, country_code: "+91" }) });
      void syncSupabaseUser(phone, { raw: { otp_requested_at: new Date().toISOString() } }).catch((syncError) => console.error("Could not save mobile number", syncError));
      setStep("otp"); setTimer(45);
    } catch (e) { setErr((e as Error).message); if (e instanceof ApiError && e.retryable) setRetryAction("request"); } finally { setBusy(false); }
  }

  async function verify() {
    setErr(""); setRetryAction(null); setBusy(true);
    try {
      const res = await api("/auth/login", { method: "POST", body: JSON.stringify({ phone_number: phone, otp }) });
      const token = findKey(res, /^(access_?token|token|accessToken|jwt)$/i) ?? findKey(res, /token/i);
      if (!token) throw new Error("Login succeeded but no token was returned");
      setToken(String(token));
      void syncSupabaseUser(phone, { auth: res, raw: res, authToken: String(token) }).catch((syncError) => console.error("Could not save user data", syncError));
      navigate({ to: "/", replace: true });
    } catch (e) { setErr((e as Error).message); if (e instanceof ApiError && e.retryable) setRetryAction("verify"); } finally { setBusy(false); }
  }

  const input = "h-12 w-full rounded-md border border-[#d8dee8] bg-white px-4 text-base text-[#172a4d] outline-none transition placeholder:text-[#97a1b2] focus:border-[#4466ff] focus:ring-2 focus:ring-[#4466ff]/15";
  const btn = "h-12 w-full rounded-md bg-[#131b63] font-semibold text-white shadow-[0_8px_24px_rgba(19,27,99,0.18)] transition hover:bg-[#202d7c] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#172a4d]">
      <div className="mx-auto flex min-h-screen max-w-[1180px] items-center justify-center px-5 py-8 md:px-8">
        <div className="grid w-full overflow-hidden rounded-lg bg-white shadow-[0_16px_50px_rgba(19,27,99,0.12)] md:min-h-[620px] md:grid-cols-[1.08fr_0.92fr]">
          <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#eef7ff_0%,#ffffff_58%,#fff5fb_100%)] md:flex md:flex-col md:justify-between md:p-12">
            <div className="absolute inset-y-0 right-0 w-32 bg-[linear-gradient(180deg,rgba(68,102,255,.08),rgba(230,9,177,.06))]" />
            <div className="relative flex items-center gap-3">
              <img src="/nprep-logo.jpg" alt="NPrep" className="h-11 w-11 rounded-md object-cover" />
              <span className="text-xl font-bold text-[#131b63]">NPrep</span>
            </div>
            <div className="relative max-w-md">
              <div className="mb-7 h-1 w-14 rounded-full bg-[#4466ff]" />
              <h1 className="text-4xl font-bold leading-[1.15] text-[#131b63] lg:text-5xl">Prepare smarter.<br />Practice better.</h1>
              <p className="mt-5 max-w-sm text-base leading-7 text-[#64748b]">Your complete nursing preparation platform for lectures, QBank, PYQs, and test series.</p>
              <div className="mt-9 grid grid-cols-3 gap-3">
                {["Lectures", "QBank", "PYQs"].map((label) => (
                  <div key={label} className="border-l border-[#dce3ef] pl-3 text-sm font-semibold text-[#344054]">{label}</div>
                ))}
              </div>
            </div>
            <p className="relative text-xs font-medium text-[#7b8798]">India's Nursing Preparation Platform</p>
          </section>

          <section className="flex items-center justify-center px-6 py-10 sm:px-10 md:px-12">
            <div className="w-full max-w-sm">
              <div className="mb-9 text-center md:hidden">
                <img src="/nprep-logo.jpg" alt="NPrep" className="mx-auto h-14 w-14 rounded-md object-cover" />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#4466ff]">Student login</p>
                <h2 className="text-3xl font-bold text-[#131b63]">{step === "phone" ? "Welcome back" : "Verify your number"}</h2>
                <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                  {step === "phone" ? "Enter your mobile number to continue." : `Enter the OTP sent to +91 ${phone}`}
                </p>
              </div>
              <div className="mt-5 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-semibold text-destructive">Website access not approved</p>
                <p className="text-muted-foreground">NPrep authorization has not been verified. Do not enter an OTP until access is approved.</p>
                <Button asChild variant="outline"><Link to="/api-configuration">Review API setup</Link></Button>
              </div>

              {step === "phone" ? (
                <form className="mt-8 space-y-5" onSubmit={(e) => { e.preventDefault(); if (valid) requestOtp(); }}>
                  <label className="block text-sm font-semibold text-[#344054]">
                    Mobile number
                    <div className="mt-2 flex gap-2">
                      <span className="flex h-12 min-w-16 items-center justify-center rounded-md border border-[#d8dee8] bg-[#f8fafc] text-sm font-semibold text-[#344054]">+91</span>
                      <input className={input} inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile number" value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                    </div>
                  </label>
                  {phone.length === 10 && !valid && <p className="text-sm text-red-600">Enter a valid Indian mobile number</p>}
                  <button className={btn} disabled={!valid || busy}>{busy ? "Sending OTP…" : "Continue"}</button>
                </form>
              ) : (
                <form className="mt-8 space-y-5" onSubmit={(e) => { e.preventDefault(); if (otp.length >= 4) verify(); }}>
                  <label className="block text-sm font-semibold text-[#344054]">
                    One-time password
                    <input className={input + " mt-2 text-center text-xl tracking-[0.55em]"} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="••••••"
                      value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  </label>
                  <button className={btn} disabled={otp.length < 4 || busy}>{busy ? "Verifying…" : "Verify & sign in"}</button>
                  <div className="flex items-center justify-between text-sm">
                    <button type="button" className="text-[#5f6b7a] hover:text-[#131b63]" onClick={() => { setStep("phone"); setOtp(""); }}>Change number</button>
                    <button type="button" disabled={timer > 0 || busy} onClick={requestOtp} className="font-semibold text-[#4466ff] disabled:text-[#98a2b3]">
                      {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
                    </button>
                  </div>
                </form>
              )}
              {err && <div className="mt-5 space-y-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm text-destructive" role="alert">
                <p>{err}</p>
                {retryAction && <Button type="button" variant="outline" disabled={busy} onClick={() => { void (retryAction === "verify" ? verify() : requestOtp()); }}><RefreshCw />Retry</Button>}
              </div>}
              <p className="mt-9 text-center text-xs leading-5 text-[#98a2b3]">By continuing, you agree to NPrep's terms and privacy policy.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
