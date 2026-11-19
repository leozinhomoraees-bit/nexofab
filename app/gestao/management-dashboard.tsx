"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Boxes, Building2, Calculator, CircleDollarSign, ClipboardList, Factory, Gavel, Home, LogOut, Plus, Scissors, Search, Users } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FinancePanel } from "./finance-panel";
import { InventoryPanel, OverviewPanel, ProductionPanel } from "./management-panels";
import { CustomersPanel, QuotesPanel } from "./commercial-panels";
import { PricingPanel } from "./pricing-panel";
import { NotificationCenter } from "./notification-center";
import { TenderItemsPanel } from "./tender-items-panel";
import { ReportsPanel } from "./reports-panel";
import { CompanySettingsPanel } from "./company-settings-panel";
import { CutPlanPanel } from "./cut-plan-panel";
import type { CutPlanQuotePrefill } from "@/lib/cut-plan-quote";

const menu = [
  ["visao-geral", Home, "Visão geral"],
  ["orcamentos", ClipboardList, "Orçamentos"],
  ["precificacao", Calculator, "Precificação"],
  ["licitacoes", Gavel, "Licitações"],
  ["producao", Factory, "Produção"],
  ["planos-corte", Scissors, "Planos de corte"],
  ["estoque", Boxes, "Estoque"],
  ["clientes", Users, "Clientes"],
  ["financeiro", CircleDollarSign, "Financeiro"],
  ["relatorios", BarChart3, "Relatórios"],
  ["empresa", Building2, "Minha empresa"],
] as const;

export function ManagementDashboard({ userName, initialSection = "visao-geral" }: { userName: string; initialSection?: string }) {
  const [section, setSection] = useState(initialSection);
  const [search, setSearch] = useState("");
  const [quoteComposer, setQuoteComposer] = useState(0);
  const [quoteOpenRequest, setQuoteOpenRequest] = useState<{ id: string; request: number } | null>(null);
  const [quotePrefill, setQuotePrefill] = useState<CutPlanQuotePrefill | null>(null);
  const [pricingComposer, setPricingComposer] = useState(0);
  const [financeSection, setFinanceSection] = useState<"payables" | "receivables" | "commissions" | "suppliers" | "break-even">("payables");

  function navigate(target: string) {
    setQuoteComposer(0);
    if (target === "ponto-equilibrio") {
      setFinanceSection("break-even");
      setSection("financeiro");
      return;
    }
    setSection(target);
  }

  return <SidebarProvider><Sidebar className="management-sidebar" collapsible="icon">
    <SidebarHeader><Link href="/" className="dash-brand nexofab-wordmark" aria-label="NexoFab"><span>Nexo</span>Fab</Link></SidebarHeader>
    <SidebarContent><SidebarGroup><SidebarGroupLabel>GESTÃO</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{menu.map(([key, Icon, label]) => <SidebarMenuItem key={label}><SidebarMenuButton isActive={section === key} tooltip={label} onClick={() => { setQuoteComposer(0); if (key === "financeiro") setFinanceSection("payables"); setSection(key); }}><Icon/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
    <SidebarFooter><SidebarMenu><SidebarMenuItem><form action="/auth/signout" method="post"><SidebarMenuButton type="submit"><LogOut/><span>Sair</span></SidebarMenuButton></form></SidebarMenuItem></SidebarMenu></SidebarFooter>
  </Sidebar><SidebarInset className="dash-shell">
    <header className="dash-header"><SidebarTrigger/><div className="dash-search"><Search/><Input aria-label="Buscar nesta área" placeholder="Buscar nesta área..." value={search} onChange={(event) => setSearch(event.target.value)}/></div><Button className="dash-new-quote" onClick={() => { setQuoteOpenRequest(null); setQuotePrefill(null); setSection("orcamentos"); setQuoteComposer((value) => value + 1); }}><Plus/>Novo orçamento</Button><NotificationCenter onOpenQuotes={(quoteId) => { setQuoteComposer(0); setQuotePrefill(null); if (quoteId) setQuoteOpenRequest({ id: quoteId, request: Date.now() }); setSection("orcamentos"); }} onOpenProduction={() => { setQuoteComposer(0); setSection("producao"); }}/><div className="user-chip"><span>{userName.slice(0, 1).toUpperCase()}</span><div><b>{userName.split("@")[0]}</b><small>Administrador</small></div></div></header>
    <main className="dash-main">
      {section === "visao-geral" && <OverviewPanel onNavigate={navigate}/>}
      {section === "orcamentos" && <QuotesPanel
        key={quoteComposer}
        search={search}
        composerRequest={quoteComposer}
        requestedQuoteId={quoteOpenRequest?.id}
        quoteOpenRequest={quoteOpenRequest?.request ?? 0}
        prefill={quotePrefill ?? undefined}
        onManageCalculationTypes={() => { setSection("precificacao"); setPricingComposer((value) => value + 1); }}
      />}
      {section === "precificacao" && <PricingPanel key={pricingComposer} createProductRequest={pricingComposer}/>}
      {section === "licitacoes" && <TenderItemsPanel search={search}/>}
      {section === "producao" && <ProductionPanel search={search}/>}
      {section === "planos-corte" && <CutPlanPanel onBuildQuote={(prefill) => {
        setQuotePrefill(prefill);
        setQuoteOpenRequest(null);
        setSection("orcamentos");
        setQuoteComposer((value) => value + 1);
      }}/>}
      {section === "estoque" && <InventoryPanel search={search}/>}
      {section === "clientes" && <CustomersPanel search={search}/>}
      {section === "financeiro" && <FinancePanel key={financeSection} search={search} requestedSection={financeSection}/>}
      {section === "relatorios" && <ReportsPanel/>}
      {section === "empresa" && <CompanySettingsPanel/>}
    </main>
  </SidebarInset></SidebarProvider>;
}
