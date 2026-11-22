"use client";

import { useState } from "react";
import { Building2, Calculator, CircleDollarSign, Landmark, ReceiptText, Target } from "lucide-react";
import { BreakEvenPanel } from "./break-even-panel";
import { AccountsPayablePanel, SuppliersPanel } from "./accounts-payable-panel";
import { AccountsReceivablePanel } from "./accounts-receivable-panel";
import { CommissionReportPanel } from "./commission-report-panel";

type FinanceSection = "payables" | "receivables" | "commissions" | "suppliers" | "break-even";

export function FinancePanel({ search, requestedSection = "payables", activeRole = "admin" }: { search: string; requestedSection?: FinanceSection; activeRole?: string }) {
  const canFullFinance = ["owner", "admin", "financeiro"].includes(activeRole);
  const [section, setSection] = useState<FinanceSection>(canFullFinance ? requestedSection : "commissions");
  const effectiveSection: FinanceSection = canFullFinance ? section : "commissions";
  return <div className="finance-workspace">
    <header className="finance-workspace-head">
      <div><p>GESTÃO FINANCEIRA</p><h1>{canFullFinance ? "Financeiro" : "Comissões"}</h1><span>{canFullFinance ? "Controle compromissos, pagamentos e a saúde financeira da empresa em um só lugar." : "Acompanhe as comissões dos orçamentos aprovados e fechados."}</span></div>
      <nav aria-label="Áreas do financeiro">
        {canFullFinance && <button className={effectiveSection === "payables" ? "active" : ""} onClick={() => setSection("payables")}><ReceiptText/>Contas a pagar</button>}
        {canFullFinance && <button className={effectiveSection === "receivables" ? "active" : ""} onClick={() => setSection("receivables")}><CircleDollarSign/>Contas a receber</button>}
        <button className={effectiveSection === "commissions" ? "active" : ""} onClick={() => setSection("commissions")}><Calculator/>Comissões</button>
        {canFullFinance && <button className={effectiveSection === "suppliers" ? "active" : ""} onClick={() => setSection("suppliers")}><Building2/>Fornecedores</button>}
        {canFullFinance && <button className={effectiveSection === "break-even" ? "active" : ""} onClick={() => setSection("break-even")}><Target/>Ponto de equilíbrio</button>}
      </nav>
    </header>
    {effectiveSection === "payables" && <AccountsPayablePanel search={search}/>}
    {effectiveSection === "receivables" && <AccountsReceivablePanel search={search}/>}
    {effectiveSection === "commissions" && <CommissionReportPanel/>}
    {effectiveSection === "suppliers" && <SuppliersPanel/>}
    {effectiveSection === "break-even" && <BreakEvenPanel/>}
    <footer className="finance-workspace-foot"><Landmark/>Os registros financeiros são restritos aos perfis Administrador e Financeiro.</footer>
  </div>;
}
