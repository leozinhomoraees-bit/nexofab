"use client";

import { useState } from "react";
import { Building2, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AcceptInvitation({ token, email }: { token: string; email: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/organizations/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      window.location.replace("/gestao");
    } catch (caught) { setError((caught as Error).message); setLoading(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-[#07111d] px-5 py-12 text-white"><section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[.06] p-8 text-center shadow-2xl backdrop-blur md:p-11"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#c6f054] text-[#07111d]"><Building2 className="size-8"/></div><p className="mt-7 text-xs font-bold tracking-[.18em] text-[#c6f054]">CONVITE DE EQUIPE</p><h1 className="mt-3 text-3xl font-bold">Entrar nesta empresa</h1><p className="mt-4 text-sm leading-6 text-white/65">O acesso será vinculado à conta <b className="text-white">{email}</b>. Seus outros espaços continuarão isolados.</p><div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/70"><ShieldCheck className="size-5 text-[#c6f054]"/>O convite só pode ser utilizado uma vez.</div>{error && <p role="alert" className="mt-6 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<Button onClick={() => void accept()} disabled={loading} className="mt-7 h-12 w-full bg-[#c6f054] font-bold text-[#07111d] hover:bg-[#d8ff70]">{loading ? <LoaderCircle className="animate-spin"/> : <Building2/>}{loading ? "Validando convite..." : "Aceitar e entrar"}</Button></section></main>;
}
