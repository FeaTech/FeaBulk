import { createFileRoute, useRouter } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({ component: AuthPage });

type AccountType = "buyer" | "seller" | "admin";

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [type, setType] = useState<AccountType>("buyer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(""); setBusy(true);
    try {
      if (mode === "sign_up") {
        if (type === "admin") { setMessage("Admin accounts are provisioned by an existing FEA administrator."); return; }
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, requested_workspace: type } } });
        if (error) throw error;
        if (data.session) await router.navigate({ to: "/app" });
        else setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await router.navigate({ to: "/app" });
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication failed. Try again."); }
    finally { setBusy(false); }
  }

  return <main className="grid min-h-screen bg-[#FDFCF8] lg:grid-cols-[.9fr_1.1fr]"><section className="hidden bg-[#102B52] p-12 text-white lg:flex lg:flex-col lg:justify-between"><a href="/" className="text-2xl font-black tracking-[-.04em]">FEA<span className="text-[#F87908]">Bulk</span></a><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#F9A453]">Verified B2B trade</p><h1 className="mt-4 max-w-md text-5xl font-black leading-tight tracking-[-.04em]">One account. The right business workspace.</h1><p className="mt-6 max-w-md leading-7 text-[#C5D4E8]">Buyers and sellers operate through their organization. FEA operations access is assigned by a platform administrator.</p></div><p className="text-sm text-[#C5D4E8]">Secure, organization-scoped access.</p></section><section className="flex items-center justify-center px-5 py-12"><div className="w-full max-w-md"><a href="/" className="text-xl font-black tracking-[-.04em] text-[#102B52] lg:hidden">FEA<span className="text-[#F87908]">Bulk</span></a><p className="mt-10 text-xs font-black uppercase tracking-[.15em] text-[#F87908]">{mode === "sign_in" ? "Welcome back" : "Create an account"}</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em] text-[#102B52]">{mode === "sign_in" ? "Sign in to your workspace" : "Start with your business role"}</h2><form onSubmit={submit} className="mt-8 grid gap-5">{mode === "sign_up" && <><label className="grid gap-2 text-sm font-bold text-[#405069]">Full name<input required value={fullName} onChange={e => setFullName(e.target.value)} className="border border-[#C9D3DF] bg-white px-3 py-3 outline-none focus:border-[#102B52]" /></label><fieldset><legend className="text-sm font-bold text-[#405069]">I am joining as</legend><div className="mt-2 grid grid-cols-3 gap-2">{(["buyer", "seller", "admin"] as AccountType[]).map(item => <button key={item} type="button" onClick={() => setType(item)} className={`border px-3 py-3 text-sm font-extrabold capitalize ${type === item ? "border-[#102B52] bg-[#EAF2FB] text-[#102B52]" : "border-[#DDE5EE] text-[#697488]"}`}>{item}</button>)}</div></fieldset></>}<label className="grid gap-2 text-sm font-bold text-[#405069]">Work email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="border border-[#C9D3DF] bg-white px-3 py-3 outline-none focus:border-[#102B52]" /></label><label className="grid gap-2 text-sm font-bold text-[#405069]">Password<input required minLength={8} type="password" autoComplete={mode === "sign_in" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} className="border border-[#C9D3DF] bg-white px-3 py-3 outline-none focus:border-[#102B52]" /></label>{message && <p className="border border-[#F2C6A0] bg-[#FFF5EC] px-3 py-3 text-sm text-[#8A4500]" role="status">{message}</p>}<button disabled={busy} className="bg-[#F87908] px-5 py-3 font-extrabold text-white disabled:opacity-60">{busy ? "Please wait…" : mode === "sign_in" ? "Sign in" : type === "admin" ? "Request admin access" : "Create account"}</button></form><p className="mt-6 text-sm text-[#697488]">{mode === "sign_in" ? "New to FEA Bulk?" : "Already have an account?"} <button onClick={() => { setMode(mode === "sign_in" ? "sign_up" : "sign_in"); setMessage(""); }} className="font-extrabold text-[#102B52]">{mode === "sign_in" ? "Create account" : "Sign in"}</button></p></div></section></main>;
}
