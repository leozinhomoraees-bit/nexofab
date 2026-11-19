"use client";

import { FormEvent, useState } from "react";
import { Building2, CheckCircle2, LoaderCircle, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Organization = { id: string; trade_name: string };

export function OnboardingForm({ userName, organizations }: { userName: string; organizations: Organization[] }) {
  const [tradeName, setTradeName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function activate(organizationId: string) {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/organizations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      window.location.replace("/gestao?secao=empresa");
    } catch (caught) { setError((caught as Error).message); setLoading(false); }
  }

  async function create(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/organizations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tradeName }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      window.location.replace("/gestao?secao=empresa");
    } catch (caught) { setError((caught as Error).message); setLoading(false); }
  }

  return <main className="min-h-screen bg-[#07111d] px-5 py-12 text-white"><div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_.9fr]">
    <section className="flex min-h-[620px] flex-col justify-between rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_20%_10%,rgba(198,240,84,.18),transparent_30%),linear-gradient(145deg,#0b2531,#07111d)] p-8 md:p-12">
      <div><div className="text-3xl font-extrabold tracking-[-.07em]"><span className="text-[#c6f054]">Nexo</span>Fab</div><p className="mt-20 text-xs font-bold tracking-[.18em] text-[#c6f054]">PRIMEIRO ACESSO</p><h1 className="mt-4 max-w-xl text-4xl font-bold leading-tight md:text-5xl">Sua operação começa por uma empresa isolada.</h1><p className="mt-5 max-w-xl text-base leading-7 text-white/65">Clientes, produtos, estoque, financeiro e produção ficarão vinculados somente a esta organização.</p></div>
      <div className="grid gap-4 text-sm text-white/75 sm:grid-cols-3"><span className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#c6f054]"/>RLS por empresa</span><span className="flex items-center gap-2"><Users className="size-5 text-[#c6f054]"/>Equipe por convite</span><span className="flex items-center gap-2"><Building2 className="size-5 text-[#c6f054]"/>Identidade própria</span></div>
    </section>
    <section className="self-center rounded-[2rem] bg-white p-7 text-[#17282d] shadow-2xl md:p-10"><p className="text-sm text-[#607278]">Olá, {userName}.</p><h2 className="mt-2 text-3xl font-bold">Configure seu espaço</h2><p className="mt-3 text-sm leading-6 text-[#718187]">Use o nome fantasia da empresa. Os dados legais e a logo podem ser preenchidos em seguida.</p>
      {organizations.length > 0 && <div className="mt-8 grid gap-3"><b className="text-sm">Empresas disponíveis</b>{organizations.map((organization) => <button key={organization.id} type="button" onClick={() => void activate(organization.id)} disabled={loading} className="flex min-h-14 items-center justify-between rounded-xl border border-[#dce5e5] px-4 text-left transition hover:border-[#1aa99d] hover:bg-[#eff9f7]"><span className="flex items-center gap-3"><Building2 className="size-5 text-[#148f86]"/><b>{organization.trade_name}</b></span><CheckCircle2 className="size-5 text-[#148f86]"/></button>)}</div>}
      <form className="mt-8 grid gap-4" onSubmit={create}><label className="grid gap-2 text-sm font-bold">{organizations.length ? "Ou crie outra empresa" : "Nome da empresa"}<Input value={tradeName} onChange={(event) => setTradeName(event.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: Fábrica Horizonte" className="h-12"/></label>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button type="submit" disabled={loading || tradeName.trim().length < 2} className="h-12 bg-[#153c43] text-white hover:bg-[#0f2f35]">{loading ? <LoaderCircle className="animate-spin"/> : <Building2/>}{loading ? "Preparando..." : "Criar empresa"}</Button></form>
      <form action="/auth/signout" method="post" className="mt-5 text-center"><button className="text-sm text-[#718187] hover:text-[#17282d]">Sair desta conta</button></form>
    </section>
  </div></main>;
}
