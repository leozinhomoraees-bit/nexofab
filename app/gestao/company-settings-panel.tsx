"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, ImageUp, LoaderCircle, MapPin, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Company = {
  trade_name: string; legal_name?: string | null; document?: string | null; state_registration?: string | null;
  email?: string | null; phone?: string | null; whatsapp?: string | null; website?: string | null;
  address_street?: string | null; address_number?: string | null; address_complement?: string | null;
  address_district?: string | null; address_city?: string | null; address_state?: string | null;
  address_zip_code?: string | null; proposal_footer?: string | null; logo_url?: string | null;
};

const empty: Company = { trade_name: "" };
const value = (entry?: string | null) => entry ?? "";

export function CompanySettingsPanel() {
  const [company, setCompany] = useState<Company>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/gestao/empresa", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setCompany(payload.company);
    } catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  function update(field: keyof Company, fieldValue: string) { setCompany((current) => ({ ...current, [field]: fieldValue })); setMessage(""); }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/gestao/empresa", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        tradeName: company.trade_name, legalName: value(company.legal_name), document: value(company.document), stateRegistration: value(company.state_registration),
        email: value(company.email), phone: value(company.phone), whatsapp: value(company.whatsapp), website: value(company.website),
        addressStreet: value(company.address_street), addressNumber: value(company.address_number), addressComplement: value(company.address_complement),
        addressDistrict: value(company.address_district), addressCity: value(company.address_city), addressState: value(company.address_state),
        addressZipCode: value(company.address_zip_code), proposalFooter: value(company.proposal_footer),
      }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      setCompany(payload.company); setMessage("Dados da empresa salvos. As propostas usarão estas informações automaticamente.");
    } catch (caught) { setError((caught as Error).message); }
    finally { setSaving(false); }
  }

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.set("logo", file);
      const response = await fetch("/api/gestao/empresa", { method: "POST", body: form });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      setCompany(payload.company); setMessage("Logo atualizada com sucesso.");
    } catch (caught) { setError((caught as Error).message); }
    finally { setSaving(false); event.target.value = ""; }
  }

  return <section className="company-settings-workspace">
    <header className="module-heading"><div><small>IDENTIDADE E DOCUMENTOS</small><h1>Minha empresa</h1><span>Dados exibidos em propostas, PDFs e comunicações com o cliente.</span></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""}/>{loading ? "Carregando" : "Atualizar"}</Button></header>
    {error && <div className="company-settings-message error">{error}</div>}
    {message && <div className="company-settings-message success"><Check/>{message}</div>}
    <form className="company-settings-layout" onSubmit={save}>
      <aside className="company-brand-card">
        <div className="company-logo-preview">{company.logo_url ? <img src={company.logo_url} alt={`Logo ${company.trade_name || "da empresa"}`}/> : <Building2/>}</div>
        <div><small>LOGO DA PROPOSTA</small><h2>{company.trade_name || "Sua empresa"}</h2><p>Use PNG, JPG ou WebP com fundo transparente ou escuro. Limite de 3 MB.</p></div>
        <label className="company-logo-upload"><ImageUp/>Selecionar nova logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} disabled={saving}/></label>
        <div className="company-saas-note"><ShieldCheck/><span><b>Preparado para crescer</b>Esta identidade fica vinculada aos orçamentos da empresa e não aos textos fixos do site.</span></div>
      </aside>
      <div className="company-settings-form">
        <section><header><Building2/><div><small>DADOS LEGAIS</small><h2>Identificação da contratada</h2></div></header><div className="form-grid">
          <label>Nome fantasia<Input value={value(company.trade_name)} onChange={(event) => update("trade_name", event.target.value)} required/></label>
          <label className="span-2">Razão social<Input value={value(company.legal_name)} onChange={(event) => update("legal_name", event.target.value)}/></label>
          <label>CNPJ / CPF<Input value={value(company.document)} onChange={(event) => update("document", event.target.value)} placeholder="00.000.000/0000-00"/></label>
          <label>Inscrição estadual<Input value={value(company.state_registration)} onChange={(event) => update("state_registration", event.target.value)}/></label>
          <label>E-mail<Input type="email" value={value(company.email)} onChange={(event) => update("email", event.target.value)}/></label>
          <label>Telefone<Input value={value(company.phone)} onChange={(event) => update("phone", event.target.value)}/></label>
          <label>WhatsApp<Input value={value(company.whatsapp)} onChange={(event) => update("whatsapp", event.target.value)}/></label>
          <label>Site<Input value={value(company.website)} onChange={(event) => update("website", event.target.value)} placeholder="www.suaempresa.com.br"/></label>
        </div></section>
        <section><header><MapPin/><div><small>LOCALIZAÇÃO</small><h2>Endereço comercial</h2></div></header><div className="form-grid">
          <label className="span-2">Rua / avenida<Input value={value(company.address_street)} onChange={(event) => update("address_street", event.target.value)}/></label>
          <label>Número<Input value={value(company.address_number)} onChange={(event) => update("address_number", event.target.value)}/></label>
          <label>Complemento<Input value={value(company.address_complement)} onChange={(event) => update("address_complement", event.target.value)}/></label>
          <label>Bairro<Input value={value(company.address_district)} onChange={(event) => update("address_district", event.target.value)}/></label>
          <label>CEP<Input value={value(company.address_zip_code)} onChange={(event) => update("address_zip_code", event.target.value)}/></label>
          <label>Cidade<Input value={value(company.address_city)} onChange={(event) => update("address_city", event.target.value)}/></label>
          <label>UF<Input maxLength={2} value={value(company.address_state)} onChange={(event) => update("address_state", event.target.value.toUpperCase())}/></label>
        </div></section>
        <section><header><ShieldCheck/><div><small>PROPOSTAS</small><h2>Apresentação comercial</h2></div></header><label className="company-footer-field">Texto do rodapé<textarea rows={3} value={value(company.proposal_footer)} onChange={(event) => update("proposal_footer", event.target.value)} placeholder="Ex.: Comunicação visual e fabricação digital"/><small>Nome, CNPJ, telefone e endereço são montados automaticamente na proposta.</small></label></section>
        <footer><Button type="submit" disabled={saving || loading}>{saving ? <LoaderCircle className="spin"/> : <Check/>}{saving ? "Salvando..." : "Salvar configurações"}</Button></footer>
      </div>
    </form>
  </section>;
}
