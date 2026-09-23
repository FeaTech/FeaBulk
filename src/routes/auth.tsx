import { createFileRoute, useRouter } from "@tanstack/react-router";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({ component: AuthPage });

type AccountType = "buyer" | "seller";

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "sign_up" | "forgot_password" | "reset_password">("sign_in");
  const [type, setType] = useState<AccountType>("buyer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [gstin, setGstin] = useState("");
  const [panLast4, setPanLast4] = useState("");
  const [cinOrLlpin, setCinOrLlpin] = useState("");
  const [udyamRegistration, setUdyamRegistration] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") setMode("reset_password");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(""); setBusy(true);
    try {
      if (mode === "forgot_password") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setMessage("If an account exists for that email, a recovery link has been sent.");
      } else if (mode === "reset_password") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Password updated. You can continue to your workspace.");
        setMode("sign_in");
      } else if (mode === "sign_up") {
        const registeredAddress = { address_line: address, city, state, pin_code: pinCode, country: "India" };
        const normalizedPhone = phone.replace(/[()\s-]/g, "");
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName.trim(), phone_e164: normalizedPhone, requested_workspace: type, legal_business_name: legalBusinessName.trim(), trading_name: tradingName.trim(), business_type: businessType, gstin: gstin.trim().toUpperCase(), pan_last4: panLast4.trim().toUpperCase(), cin_or_llpin: cinOrLlpin.trim().toUpperCase(), udyam_registration: udyamRegistration.trim().toUpperCase(), registered_address: registeredAddress, operating_address: registeredAddress } } });
        if (error) throw error;
        if (data.session) await router.navigate({ to: "/app" });
        else setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("The login completed without a session. Please try again.");
        const { data: identity, error: identityError } = await supabase.auth.getUser(data.session.access_token);
        if (identityError || !identity.user) throw identityError ?? new Error("The login session could not be verified.");
        await router.navigate({ to: "/app" });
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication failed. Try again."); }
    finally { setBusy(false); }
  }

  const heading = mode === "sign_in" ? "Sign in to your workspace" : mode === "sign_up" ? "Tell us about your business" : mode === "forgot_password" ? "Recover your account" : "Choose a new password";
  return <main className="grid min-h-screen bg-[#FDFCF8] lg:grid-cols-[.9fr_1.1fr]"><section className="hidden bg-[#102B52] p-12 text-white lg:flex lg:flex-col lg:justify-between"><a href="/" className="text-2xl font-black tracking-[-.04em]">FEA<span className="text-[#F87908]">Bulk</span></a><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#F9A453]">Verified B2B trade</p><h1 className="mt-4 max-w-md text-5xl font-black leading-tight tracking-[-.04em]">One account. Your complete business profile.</h1><p className="mt-6 max-w-md leading-7 text-[#C5D4E8]">Your organization starts pending verification. GST, legal entity details and location help us set up the correct workspace.</p></div><p className="text-sm text-[#C5D4E8]">Secure, organization-scoped access.</p></section><section className="flex items-center justify-center px-5 py-12"><div className="w-full max-w-xl"><a href="/" className="text-xl font-black tracking-[-.04em] text-[#102B52] lg:hidden">FEA<span className="text-[#F87908]">Bulk</span></a><p className="mt-10 text-xs font-black uppercase tracking-[.15em] text-[#F87908]">{mode.replaceAll("_", " ")}</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em] text-[#102B52]">{heading}</h2><form onSubmit={submit} className="mt-8 grid gap-5">{mode === "sign_up" && <><div className="grid gap-5 sm:grid-cols-2"><Field label="Full name"><input required value={fullName} onChange={e => setFullName(e.target.value)} /></Field><Field label="Mobile number"><input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} pattern="\+[1-9][0-9 ()-]{7,18}" placeholder="+91 98765 43210" /></Field></div><fieldset><legend className="text-sm font-bold text-[#405069]">I am joining as</legend><div className="mt-2 grid grid-cols-2 gap-2">{(["buyer", "seller"] as AccountType[]).map(item => <button key={item} type="button" onClick={() => setType(item)} className={`border px-3 py-3 text-sm font-extrabold capitalize ${type === item ? "border-[#102B52] bg-[#EAF2FB] text-[#102B52]" : "border-[#DDE5EE] text-[#697488]"}`}>{item}</button>)}</div></fieldset><div className="grid gap-5 sm:grid-cols-2"><Field label="Legal business name"><input required value={legalBusinessName} onChange={e => setLegalBusinessName(e.target.value)} /></Field><Field label="Trading name"><input value={tradingName} onChange={e => setTradingName(e.target.value)} /></Field></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Business type"><select required value={businessType} onChange={e => setBusinessType(e.target.value)}><option value="">Select type</option><option>Proprietorship</option><option>Partnership</option><option>Private limited company</option><option>LLP</option><option>Other</option></select></Field><Field label="GSTIN (optional)"><input value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][A-Za-z0-9]Z[A-Za-z0-9]" maxLength={15} placeholder="27AAAAA0000A1Z5" /></Field></div><div className="grid gap-5 sm:grid-cols-3"><Field label="PAN last 4 (optional)"><input value={panLast4} onChange={e => setPanLast4(e.target.value.toUpperCase())} pattern="[A-Za-z0-9]{4}" maxLength={4} /></Field><Field label="CIN or LLPIN (optional)"><input value={cinOrLlpin} onChange={e => setCinOrLlpin(e.target.value.toUpperCase())} pattern="[A-Za-z0-9-]{4,21}" maxLength={21} /></Field><Field label="Udyam registration (optional)"><input value={udyamRegistration} onChange={e => setUdyamRegistration(e.target.value.toUpperCase())} pattern="UDYAM-[A-Za-z]{2}-[0-9]{2}-[0-9]{7}" placeholder="UDYAM-KA-00-1234567" /></Field></div><Field label="Registered business address"><input required value={address} onChange={e => setAddress(e.target.value)} /></Field><div className="grid gap-5 sm:grid-cols-3"><Field label="City"><input required value={city} onChange={e => setCity(e.target.value)} /></Field><Field label="State"><input required value={state} onChange={e => setState(e.target.value)} /></Field><Field label="PIN code"><input required pattern="[0-9]{6}" value={pinCode} onChange={e => setPinCode(e.target.value)} /></Field></div></>}{mode !== "reset_password" && <Field label="Work email"><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>}{mode !== "forgot_password" && <Field label={mode === "reset_password" ? "New password" : "Password"}><input required minLength={8} type="password" autoComplete={mode === "sign_in" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} /></Field>}{message && <p className="border border-[#F2C6A0] bg-[#FFF5EC] px-3 py-3 text-sm text-[#8A4500]" role="status">{message}</p>}<button disabled={busy} className="bg-[#F87908] px-5 py-3 font-extrabold text-white disabled:opacity-60">{busy ? "Please wait…" : mode === "sign_in" ? "Sign in" : mode === "sign_up" ? "Create business account" : mode === "forgot_password" ? "Send recovery link" : "Update password"}</button></form>{mode === "sign_in" && <button className="mt-4 text-sm font-bold text-[#102B52]" onClick={() => { setMode("forgot_password"); setMessage(""); }}>Forgot password?</button>}<p className="mt-6 text-sm text-[#697488]">{mode === "sign_up" ? "Already have an account?" : "Need another option?"} <button onClick={() => { setMode(mode === "sign_in" ? "sign_up" : "sign_in"); setMessage(""); }} className="font-extrabold text-[#102B52]">{mode === "sign_in" ? "Create account" : "Sign in"}</button></p></div></section></main>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2 text-sm font-bold text-[#405069]">{label}<span className="[&>input]:w-full [&>input]:border [&>input]:border-[#C9D3DF] [&>input]:bg-white [&>input]:px-3 [&>input]:py-3 [&>select]:w-full [&>select]:border [&>select]:border-[#C9D3DF] [&>select]:bg-white [&>select]:px-3 [&>select]:py-3">{children}</span></label>; }
