"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BarChart3, Boxes, Building2, Calculator, CircleDollarSign, ClipboardList, CreditCard, Factory, Gavel, Home, LoaderCircle, LogOut, Plus, Scissors, Search, UserCog, Users } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OverviewPanel } from "./management-panels";
import { NotificationCenter } from "./notification-center";
import { ToastProvider } from "./toast-context";
import type { CutPlanQuotePrefill } from "@/lib/cut-plan-quote";
import type { SubscriptionAccessSummary } from "@/lib/billing";

function PanelLoading() {
  return (
    <div className="panel-loading-state">
      <LoaderCircle className="spin" />
      <span>Carregando módulo...</span>
    </div>
  );
}

const QuotesPanel = dynamic(() => import("./commercial-panels").then((mod) => mod.QuotesPanel), { loading: PanelLoading });
const CustomersPanel = dynamic(() => import("./commercial-panels").then((mod) => mod.CustomersPanel), { loading: PanelLoading });
const PricingPanel = dynamic(() => import("./pricing-panel").then((mod) => mod.PricingPanel), { loading: PanelLoading });
const ProductionPanel = dynamic(() => import("./management-panels").then((mod) => mod.ProductionPanel), { loading: PanelLoading });
const InventoryPanel = dynamic(() => import("./management-panels").then((mod) => mod.InventoryPanel), { loading: PanelLoading });
const FinancePanel = dynamic(() => import("./finance-panel").then((mod) => mod.FinancePanel), { loading: PanelLoading });
const ReportsPanel = dynamic(() => import("./reports-panel").then((mod) => mod.ReportsPanel), { loading: PanelLoading });
const CutPlanPanel = dynamic(() => import("./cut-plan-panel").then((mod) => mod.CutPlanPanel), { loading: PanelLoading });
const TenderItemsPanel = dynamic(() => import("./tender-items-panel").then((mod) => mod.TenderItemsPanel), { loading: PanelLoading });
const TeamPanel = dynamic(() => import("./team-panel").then((mod) => mod.TeamPanel), { loading: PanelLoading });
const BillingPanel = dynamic(() => import("./billing-panel").then((mod) => mod.BillingPanel), { loading: PanelLoading });
const CompanySettingsPanel = dynamic(() => import("./company-settings-panel").then((mod) => mod.CompanySettingsPanel), { loading: PanelLoading });

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
  ["equipe", UserCog, "Equipe"],
  ["assinatura", CreditCard, "Assinatura"],
  ["empresa", Building2, "Minha empresa"],
] as const;

type MenuKey = (typeof menu)[number][0];
const validMenuKeys = new Set<string>(menu.map(([key]) => key));

type OrganizationOption = { id: string; trade_name: string };

function isSectionAllowed(key: string, role: string): boolean {
  if (!validMenuKeys.has(key)) return false;
  if (["equipe", "assinatura"].includes(key)) return ["owner", "admin"].includes(role);
  if (key === "relatorios") return ["owner", "admin", "financeiro"].includes(role);
  if (["financeiro", "licitacoes"].includes(key)) return ["owner", "admin", "financeiro", "comercial"].includes(role);
  return true;
}

export function ManagementDashboard({ userName, initialSection = "visao-geral", activeOrganizationId, activeRole, organizations, subscriptionSummary }: { userName: string; initialSection?: string; activeOrganizationId: string; activeRole: string; organizations: OrganizationOption[]; subscriptionSummary: SubscriptionAccessSummary }) {
  const safeInitial = isSectionAllowed(initialSection, activeRole) ? initialSection : "visao-geral";
  const [section, setSection] = useState(safeInitial);
  const [search, setSearch] = useState("");
  const [quoteComposer, setQuoteComposer] = useState(0);
  const [quoteOpenRequest, setQuoteOpenRequest] = useState<{ id: string; request: number } | null>(null);
  const [quotePrefill, setQuotePrefill] = useState<CutPlanQuotePrefill | null>(null);
  const [pricingComposer, setPricingComposer] = useState(0);
  const [financeSection, setFinanceSection] = useState<"payables" | "receivables" | "commissions" | "suppliers" | "break-even">(
    ["owner", "admin", "financeiro"].includes(activeRole) ? "payables" : "commissions",
  );
  const [switchingOrganization, setSwitchingOrganization] = useState(false);

  const canCreateQuote = ["owner", "admin", "comercial", "financeiro"].includes(activeRole);

  const selectSection = useCallback((nextSection: string, pushHistory = true) => {
    const resolved = isSectionAllowed(nextSection, activeRole) ? nextSection : "visao-geral";
    setSection(resolved);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (resolved === "visao-geral") url.searchParams.delete("secao");
    else url.searchParams.set("secao", resolved);
    if (pushHistory) window.history.pushState({ secao: resolved }, "", url.toString());
    else window.history.replaceState({ secao: resolved }, "", url.toString());
  }, [activeRole]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("secao") || "visao-geral";
      setSection(isSectionAllowed(fromUrl, activeRole) ? fromUrl : "visao-geral");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [activeRole]);

  async function switchOrganization(organizationId: string) {
    if (organizationId === activeOrganizationId) return;
    setSwitchingOrganization(true);
    const response = await fetch("/api/organizations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId }) });
    if (!response.ok) { setSwitchingOrganization(false); return; }
    window.location.replace("/gestao");
  }

  function navigate(target: string) {
    setQuoteComposer(0);
    if (target === "ponto-equilibrio") {
      setFinanceSection("break-even");
      selectSection("financeiro");
      return;
    }
    selectSection(target);
  }

  return <ToastProvider><SidebarProvider><Sidebar className="management-sidebar" collapsible="icon">
    <SidebarHeader><Link href="/" className="dash-brand nexofab-wordmark" aria-label="NexoFab"><span>Nexo</span>Fab</Link></SidebarHeader>
    <SidebarContent><SidebarGroup><SidebarGroupLabel>GESTÃO</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{menu.filter(([key]) => isSectionAllowed(key, activeRole)).map(([key, Icon, label]) => <SidebarMenuItem key={label}><SidebarMenuButton isActive={section === key} tooltip={label} onClick={() => { setQuoteComposer(0); if (key === "financeiro") setFinanceSection(["owner", "admin", "financeiro"].includes(activeRole) ? "payables" : "commissions"); selectSection(key as MenuKey); }}><Icon/><span>{key === "financeiro" && activeRole === "comercial" ? "Comissões" : label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
    <SidebarFooter><SidebarMenu><SidebarMenuItem><form action="/auth/signout" method="post"><SidebarMenuButton type="submit"><LogOut/><span>Sair</span></SidebarMenuButton></form></SidebarMenuItem></SidebarMenu></SidebarFooter>
  </Sidebar><SidebarInset className="dash-shell">
    <header className="dash-header"><SidebarTrigger/><label className="organization-switcher"><Building2/><select aria-label="Empresa ativa" value={activeOrganizationId} disabled={switchingOrganization} onChange={(event) => void switchOrganization(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.trade_name}</option>)}</select></label><div className="dash-search"><Search/><Input aria-label="Buscar nesta área" placeholder="Buscar nesta área..." value={search} onChange={(event) => setSearch(event.target.value)}/></div>{canCreateQuote && <Button className="dash-new-quote" onClick={() => { setQuoteOpenRequest(null); setQuotePrefill(null); selectSection("orcamentos"); setQuoteComposer((value) => value + 1); }}><Plus/>Novo orçamento</Button>}<NotificationCenter onOpenQuotes={(quoteId) => { setQuoteComposer(0); setQuotePrefill(null); if (quoteId) setQuoteOpenRequest({ id: quoteId, request: Date.now() }); selectSection("orcamentos"); }} onOpenProduction={() => { setQuoteComposer(0); selectSection("producao"); }}/><div className="user-chip"><span>{userName.slice(0, 1).toUpperCase()}</span><div><b>{userName.split("@")[0]}</b><small>{activeRole === "owner" ? "Proprietário" : activeRole}</small></div></div></header>
    <main className="dash-main">
      {section !== "assinatura" && (subscriptionSummary.status === "trialing" || subscriptionSummary.isReadOnly) && (
        <div className={`billing-banner ${subscriptionSummary.tone}`}>
          <span><strong>{subscriptionSummary.label}</strong>{subscriptionSummary.isReadOnly ? " · Seus dados permanecem preservados em modo leitura." : " · Acesso completo liberado durante o período de avaliação."}</span>
          {["owner", "admin"].includes(activeRole) && <Button size="sm" variant="outline" onClick={() => selectSection("assinatura")}>Ver assinatura</Button>}
        </div>
      )}
      {section === "visao-geral" && <OverviewPanel onNavigate={navigate}/>}
      {section === "orcamentos" && <QuotesPanel
        key={quoteComposer}
        search={search}
        composerRequest={quoteComposer}
        requestedQuoteId={quoteOpenRequest?.id}
        quoteOpenRequest={quoteOpenRequest?.request ?? 0}
        prefill={quotePrefill ?? undefined}
        onManageCalculationTypes={() => { selectSection("precificacao"); setPricingComposer((value) => value + 1); }}
      />}
      {section === "precificacao" && <PricingPanel key={pricingComposer} createProductRequest={pricingComposer}/>}
      {section === "licitacoes" && isSectionAllowed("licitacoes", activeRole) && <TenderItemsPanel search={search}/>}
      {section === "producao" && <ProductionPanel search={search}/>}
      {section === "planos-corte" && <CutPlanPanel onBuildQuote={(prefill) => {
        setQuotePrefill(prefill);
        setQuoteOpenRequest(null);
        selectSection("orcamentos");
        setQuoteComposer((value) => value + 1);
      }}/>}
      {section === "estoque" && <InventoryPanel search={search}/>}
      {section === "clientes" && <CustomersPanel search={search}/>}
      {section === "financeiro" && isSectionAllowed("financeiro", activeRole) && <FinancePanel key={financeSection} search={search} requestedSection={financeSection} activeRole={activeRole}/>}
      {section === "relatorios" && isSectionAllowed("relatorios", activeRole) && <ReportsPanel/>}
      {section === "equipe" && isSectionAllowed("equipe", activeRole) && <TeamPanel/>}
      {section === "assinatura" && isSectionAllowed("assinatura", activeRole) && <BillingPanel/>}
      {section === "empresa" && <CompanySettingsPanel/>}
    </main>
  </SidebarInset></SidebarProvider></ToastProvider>;
}
