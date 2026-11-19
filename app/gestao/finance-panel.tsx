"use client";

import { useState } from "react";
import { Building2, Calculator, CircleDollarSign, Landmark, ReceiptText, Target } from "lucide-react";
import { BreakEvenPanel } from "./break-even-panel";
import { AccountsPayablePanel, SuppliersPanel } from "./accounts-payable-panel";
import { AccountsReceivablePanel } from "./accounts-receivable-panel";
import { CommissionReportPanel } from "./commission-report-panel";

type FinanceSection = "payables" | "receivables" | "commissions" | "suppliers" | "break-even";

export function FinancePanel({ search, requestedSection = "payables" }: { search: string; requestedSection?: FinanceSection }) {
  const [section, setSection] = useState<FinanceSection>(requestedSection);
  return <div className="finance-workspace">
    <header className="finance-workspace-head">
      <div><p>GESTÃO FINANCEIRA</p><h1>Financeiro</h1><span>Controle compromissos, pagamentos e a saúde financeira da empresa em um só lugar.</span></div>
      <nav aria-label="Áreas do financeiro">
        <button className={section === "payables" ? "active" : ""} onClick={() => setSection("payables")}><ReceiptText/>Contas a pagar</button>
        <button className={section === "receivables" ? "active" : ""} onClick={() => setSection("receivables")}><CircleDollarSign/>Contas a receber</button>
        <button className={section === "commissions" ? "active" : ""} onClick={() => setSection("commissions")}><Calculator/>Comissões</button>
        <button className={section === "suppliers" ? "active" : ""} onClick={() => setSection("suppliers")}><Building2/>Fornecedores</button>
        <button className={section === "break-even" ? "active" : ""} onClick={() => setSection("break-even")}><Target/>Ponto de equilíbrio</button>
      </nav>
    </header>
    {section === "payables" && <AccountsPayablePanel search={search}/>} 
    {section === "receivables" && <AccountsReceivablePanel search={search}/>} 
    {section === "commissions" && <CommissionReportPanel/>}
    {section === "suppliers" && <SuppliersPanel/>}
    {section === "break-even" && <BreakEvenPanel/>}
    <footer className="finance-workspace-foot"><Landmark/>Os registros financeiros são restritos aos perfis Administrador e Financeiro.</footer>
  </div>;
}
