"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Calculator,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardList,
  Columns3,
  Eye,
  Factory,
  Flame,
  Layers,
  Lock,
  MapPin,
  Minus,
  QrCode,
  Scissors,
  ShieldCheck,
  Sparkles,
  Tag,
  Tv,
  Users,
  X,
} from "lucide-react";

type PreviewTabId = "comercial" | "precificacao" | "producao" | "financeiro";
type PlanCycle = "monthly" | "quarterly" | "yearly";

const previewTabs: Array<{
  id: PreviewTabId;
  label: string;
  icon: typeof ClipboardList;
  kpis: Array<{ label: string; value: string; delta: string }>;
  asideKicker: string;
  asideTitle: string;
  asideCopy: string;
  bullets: string[];
}> = [
  {
    id: "comercial",
    label: "Funil & Proposta",
    icon: ClipboardList,
    kpis: [
      { label: "Funil ativo", value: "R$ 44.500", delta: "18 propostas em aberto" },
      { label: "Conversão real", value: "64%", delta: "Aprovação em 1 clique" },
      { label: "Rastreio ao vivo", value: "Vista 3x", delta: "Fotos + alerta na tela" },
    ],
    asideKicker: "COMERCIAL ANTI-ESQUECIMENTO",
    asideTitle: "Funil Kanban, proposta com fotos e recibo direto no orçamento.",
    asideCopy:
      "Monte orçamentos em segundos com 24 projetos guiados, anexe fotos ou mockups de referência na proposta pública, receba aviso quando o cliente abrir o link e já dê baixa no pagamento com recibo pelo WhatsApp.",
    bullets: [
      "24 projetos guiados personalizáveis (fachada, letreiro, luminoso, troféu...)",
      "Fotos de referência na proposta online + selo 'Vista Xx'",
      "Portal /p/sua-empresa + baixa de pagamento e recibo no orçamento",
    ],
  },
  {
    id: "precificacao",
    label: "Corte & Cálculo",
    icon: Calculator,
    kpis: [
      { label: "Aproveitamento", value: "87,4%", delta: "Régua em cm + sobra real" },
      { label: "Chapas prontas", value: "6 padrões", delta: "PVC, PS, ACM, Acrílico, MDF" },
      { label: "Margem líquida", value: "38,2%", delta: "Hora-máquina + fixos" },
    ],
    asideKicker: "MARGEM PROTEGIDA NA ORIGEM",
    asideTitle: "Plano de corte vetorial (DXF/SVG) com réguas e encaixe inteligente.",
    asideCopy:
      "Importe DXF/SVG com aproveitamento real dentro de furos, réguas graduadas em cm e linha de consumo da chapa — ou use o encaixe rápido por medida em chapa e bobina sem precisar cadastrar estoque antes.",
    bullets: [
      "Importação DXF/SVG com encaixe em furos e exportação para Laser/Router",
      "Régua graduada em cm mostrando área usada e sobra livre de retalho",
      "Chapas padrão (PVC/PS, ACM, Acrílico, MDF) + custo direto no orçamento",
    ],
  },
  {
    id: "producao",
    label: "PCP & Agenda",
    icon: Factory,
    kpis: [
      { label: "OS no chão", value: "12 ordens", delta: "Kanban + OS rápida avulsa" },
      { label: "Agenda de rua", value: "Maps / Waze", delta: "Roteiro de instalação 1-toque" },
      { label: "Rastreio cliente", value: "Link ao vivo", delta: "Menos cobrança no WhatsApp" },
    ],
    asideKicker: "DO CHÃO DE FÁBRICA À INSTALAÇÃO",
    asideTitle: "Kanban PCP, Agenda de Instalação, Modo TV e Rastreio do Pedido.",
    asideCopy:
      "Crie OS a partir do orçamento ou em 1 clique para serviços avulsos, agende entregas e instalações no calendário arrastável com rota no Maps/Waze e envie um link público para o cliente acompanhar a produção.",
    bullets: [
      "Kanban PCP de 8 etapas, Modo TV 30s, QR Code na OS e etiquetas A4/térmica",
      "Agenda visual semanal/mensal com Maps, Waze, WhatsApp e roteiro imprimível",
      "Página pública /pedido para o cliente ver o andamento em tempo real",
    ],
  },
  {
    id: "financeiro",
    label: "BI & Financeiro",
    icon: BarChart3,
    kpis: [
      { label: "Entradas (mês)", value: "R$ 48.900", delta: "+18% vs. mês anterior" },
      { label: "Ponto de equilíbrio", value: "118%", delta: "Meta operacional batida" },
      { label: "Lucro líquido", value: "R$ 17.640", delta: "DRE + fluxo projetado" },
    ],
    asideKicker: "INTELIGÊNCIA EXECUTIVA NO CAIXA",
    asideTitle: "Gráficos de 6 meses, DRE, contas, comissões e recibo digital.",
    asideCopy:
      "Visualize faturamento × despesas × saldo, importe boletos em PDF, acompanhe todos os recebimentos sem perder parcelas de vista e envie recibos digitais profissionais pelo WhatsApp.",
    bullets: [
      "Gráficos executivos interativos na Visão Geral e Relatórios",
      "Contas a pagar/receber com visão de todos os meses e Ficha 360º",
      "Exportação CSV/PDF + recibo digital com sua marca em 1 clique",
    ],
  },
];

const marqueeItems = [
  "Comunicação Visual",
  "Fachadas em ACM",
  "Corte CNC & Router",
  "Corte e Gravação a Laser",
  "Grandes Formatos",
  "Marcenaria Técnica",
  "Displays & PDV",
  "Impressão 3D",
  "Sinalização Corporativa",
  "Gráficas Rápidas",
];

const comparisonRows: Array<{
  feature: string;
  spreadsheets: "no" | "partial";
  legacy: "yes" | "partial" | string;
  nexofab: "yes" | string;
}> = [
  { feature: "24 Projetos Guiados personalizáveis + cálculo técnico (m², chapa, bobina e hora-máquina)", spreadsheets: "partial", legacy: "partial", nexofab: "yes" },
  { feature: "Plano de corte vetorial DXF/SVG com encaixe em furos, réguas em cm + chapa/bobina", spreadsheets: "no", legacy: "partial", nexofab: "yes" },
  { feature: "Proposta online com fotos/mockups, rastreio ('Vista Xx') e Portal /p/sua-empresa", spreadsheets: "no", legacy: "partial", nexofab: "yes" },
  { feature: "Kanban PCP Drag & Drop, OS rápida avulsa, Modo TV e QR Code na OS", spreadsheets: "no", legacy: "yes", nexofab: "yes" },
  { feature: "Agenda Visual de Instalação (Maps/Waze) + Link público de rastreio do pedido", spreadsheets: "no", legacy: "partial", nexofab: "yes" },
  { feature: "Gráficos executivos, DRE, Ponto de Equilíbrio e Recibo Digital no WhatsApp", spreadsheets: "partial", legacy: "yes", nexofab: "yes" },
  { feature: "Taxa de implantação / setup", spreadsheets: "partial", legacy: "R$ 1.000 – R$ 3.500", nexofab: "R$ 0 (usa em 3 min)" },
  { feature: "Investimento mensal (até 10 usuários inclusos)", spreadsheets: "partial", legacy: "R$ 450 – R$ 1.500/mês", nexofab: "Lançamento: a partir de R$ 20/mês" },
];

const plans: Array<{
  cycle: PlanCycle;
  name: string;
  badge: string;
  regularPrice: string;
  discountTag: string;
  price: string;
  sub: string;
}> = [
  {
    cycle: "monthly",
    name: "Plano Completo · Mensal",
    badge: "Oferta de lançamento",
    regularPrice: "R$ 69,00",
    discountTag: "58% OFF",
    price: "R$ 29,00",
    sub: "Cobrança mensal de R$ 29,00. Sem fidelidade — total liberdade para cancelar quando quiser.",
  },
  {
    cycle: "quarterly",
    name: "Plano Completo · Trimestral",
    badge: "Mais escolhido · Lançamento",
    regularPrice: "R$ 69,00",
    discountTag: "64% OFF",
    price: "R$ 25,00",
    sub: "Cobrança de R$ 75,00 a cada 3 meses. Economia real mantendo leveza no fluxo de caixa.",
  },
  {
    cycle: "yearly",
    name: "Plano Completo · Anual",
    badge: "Preço de fundador",
    regularPrice: "R$ 69,00",
    discountTag: "71% OFF",
    price: "R$ 20,00",
    sub: "Cobrança anual de R$ 240,00. Garante o menor valor de lançamento congelado por 12 meses.",
  },
];

const included = [
  "7 dias grátis completos sem cadastrar cartão",
  "Até 10 usuários ativos por empresa com papéis por setor",
  "24 projetos guiados personalizáveis + proposta com fotos e recibo no orçamento",
  "Plano de corte vetorial (DXF/SVG) com réguas em cm + encaixe chapa/bobina",
  "Kanban PCP, OS rápida, Modo TV, QR Code, Agenda de Instalação e Rastreio do Pedido",
  "Gráficos executivos, DRE, Ficha 360º e pagamento via PIX, boleto ou cartão",
];

function revealDelay(ms: number): CSSProperties {
  return { "--delay": `${ms}ms` } as CSSProperties;
}

function renderStageVisual(tabId: PreviewTabId) {
  if (tabId === "comercial") {
    return (
      <div className="nf-mini-kanban">
        <div className="nf-mini-col">
          <header><b>Novos</b><span>R$ 11.400</span></header>
          <article>
            <small>#1051 · Portal /p</small>
            <b>Totem ACM 2,40m</b>
            <em>R$ 6.800</em>
          </article>
          <article>
            <small>#1052 · WhatsApp</small>
            <b>Envelopamento Van</b>
            <em>R$ 4.600</em>
          </article>
        </div>
        <div className="nf-mini-col accent-amber">
          <header><b>Aguardando</b><span>R$ 18.900</span></header>
          <article>
            <div className="nf-mini-badges">
              <small>#1045</small>
              <span className="nf-mini-eye"><Eye />Vista 3x</span>
            </div>
            <b>24 placas acrílico 6mm</b>
            <em>R$ 7.200</em>
          </article>
          <article>
            <small>#1047 · Retorno hoje</small>
            <b>Fachada loja centro</b>
            <em>R$ 11.700</em>
          </article>
        </div>
        <div className="nf-mini-col accent-lime">
          <header><b>Aprovados</b><span>R$ 14.200</span></header>
          <article className="highlight">
            <div className="nf-mini-badges">
              <small>#1042</small>
              <span className="nf-mini-ok">Aprovada 1-clique</span>
            </div>
            <b>Letra Caixa LED + ACM</b>
            <em>R$ 14.200</em>
          </article>
        </div>
      </div>
    );
  }

  if (tabId === "precificacao") {
    return (
      <div className="nf-mini-nesting">
        <div className="nf-mini-nesting-head">
          <span><b>Chapa ACM 3mm</b> · 122 × 500 cm</span>
          <em>12 peças encaixadas · 87,4% útil</em>
        </div>
        <svg viewBox="0 0 500 132" className="nf-mini-nesting-svg" role="img" aria-label="Exemplo visual de encaixe de peças em chapa ACM">
          <rect x="2" y="2" width="496" height="128" rx="6" fill="#0b1f2c" stroke="#2c5364" strokeWidth="1.5" />
          <rect x="8" y="8" width="484" height="116" fill="none" stroke="#e69e60" strokeDasharray="5 4" strokeWidth="1" opacity="0.7" />
          {[0, 1, 2, 3, 4].map((col) => (
            <g key={`r1-${col}`}>
              <rect x={14 + col * 74} y={14} width={68} height={48} rx="3" fill="#0e8b81" fillOpacity="0.32" stroke="#2dd4bf" strokeWidth="1.2" />
              <text x={48 + col * 74} y={42} textAnchor="middle" fill="#ccfbf1" fontSize="9.5" fontWeight="700">60×40</text>
            </g>
          ))}
          {[0, 1, 2, 3, 4].map((col) => (
            <g key={`r2-${col}`}>
              <rect x={14 + col * 74} y={68} width={68} height={48} rx="3" fill="#0e8b81" fillOpacity="0.32" stroke="#2dd4bf" strokeWidth="1.2" />
              <text x={48 + col * 74} y={96} textAnchor="middle" fill="#ccfbf1" fontSize="9.5" fontWeight="700">60×40</text>
            </g>
          ))}
          <rect x="384" y="14" width="46" height="102" rx="3" fill="#c6f054" fillOpacity="0.22" stroke="#c6f054" strokeWidth="1.2" />
          <text x="407" y="69" textAnchor="middle" fill="#ecfccb" fontSize="9" fontWeight="800">40×95 ↻</text>
          <rect x="436" y="14" width="46" height="102" rx="3" fill="#c6f054" fillOpacity="0.22" stroke="#c6f054" strokeWidth="1.2" />
          <text x="459" y="69" textAnchor="middle" fill="#ecfccb" fontSize="9" fontWeight="800">40×95 ↻</text>
        </svg>
        <div className="nf-mini-nesting-foot">
          <span>Chapa ou Bobina (sem precisar de DXF)</span>
          <span>DXF / SVG para Laser &amp; Router</span>
        </div>
      </div>
    );
  }

  if (tabId === "producao") {
    return (
      <div className="nf-mini-kanban">
        <div className="nf-mini-col">
          <header><b>Arte / Prova</b><span>3 OS</span></header>
          <article>
            <small>OS-325 · Arte v2</small>
            <b>Plotagem frota 2 vans</b>
            <span className="nf-mini-pill amber">Aguardando cliente</span>
          </article>
        </div>
        <div className="nf-mini-col accent-teal">
          <header><b>Em Produção</b><span>5 OS</span></header>
          <article className="highlight">
            <div className="nf-mini-badges">
              <small>OS-318 · URGENTE</small>
              <span className="nf-mini-eye"><QrCode />QR ativo</span>
            </div>
            <b>Totem luminoso recepção</b>
            <span className="nf-mini-pill ok">Estoque reservado</span>
          </article>
        </div>
        <div className="nf-mini-col accent-lime">
          <header><b>Expedição</b><span>4 OS</span></header>
          <article>
            <div className="nf-mini-badges">
              <small>OS-312 · VOL 1/3</small>
              <span className="nf-mini-ok"><Tag />Etiqueta</span>
            </div>
            <b>Painel MDF fresado</b>
            <span className="nf-mini-pill lime"><Tv />No Modo TV</span>
          </article>
        </div>
      </div>
    );
  }

  const bars = [
    { m: "Jun", rev: 56, exp: 34 },
    { m: "Jul", rev: 68, exp: 42 },
    { m: "Ago", rev: 62, exp: 38 },
    { m: "Set", rev: 79, exp: 46 },
    { m: "Out", rev: 86, exp: 49 },
    { m: "Nov", rev: 96, exp: 52 },
  ];

  return (
    <div className="nf-mini-chart">
      <div className="nf-mini-nesting-head">
        <span><b>Evolução 6 meses</b> · Entradas × Saídas × Saldo</span>
        <em>Margem líquida 36,1%</em>
      </div>
      <svg viewBox="0 0 480 142" className="nf-mini-chart-svg" role="img" aria-label="Gráfico executivo de faturamento e despesas">
        {[24, 62, 100].map((y) => (
          <line key={y} x1="16" x2="466" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
        ))}
        {bars.map((b, i) => {
          const x = 32 + i * 74;
          return (
            <g key={b.m}>
              <rect x={x} y={118 - b.rev} width="20" height={b.rev} rx="4" fill="#14b8a6" />
              <rect x={x + 24} y={118 - b.exp} width="20" height={b.exp} rx="4" fill="#e26d54" opacity="0.88" />
              <text x={x + 22} y="135" textAnchor="middle" fill="#90a8b4" fontSize="10.5" fontWeight="700">{b.m}</text>
            </g>
          );
        })}
        <path
          d="M 54 90 L 128 84 L 202 88 L 276 74 L 350 68 L 424 58"
          fill="none"
          stroke="#c6f054"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {[
          [54, 90],
          [128, 84],
          [202, 88],
          [276, 74],
          [350, 68],
          [424, 58],
        ].map(([cx, cy], idx) => (
          <circle key={idx} cx={cx} cy={cy} r="4" fill="#c6f054" stroke="#081927" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
}

export function LandingExperience() {
  const [activeTab, setActiveTab] = useState<PreviewTabId>("comercial");
  const [selectedCycle, setSelectedCycle] = useState<PlanCycle>("quarterly");
  const progressRef = useRef<HTMLDivElement>(null);
  const navWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId = 0;

    const flushScroll = () => {
      rafId = 0;
      const y = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = docHeight > 0 ? Math.min(1, Math.max(0, y / docHeight)) : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${ratio})`;
      }
      if (navWrapRef.current) {
        navWrapRef.current.classList.toggle("scrolled", y > 24);
      }
    };

    const scheduleScroll = () => {
      if (!rafId) rafId = window.requestAnimationFrame(flushScroll);
    };

    scheduleScroll();
    window.addEventListener("scroll", scheduleScroll, { passive: true });
    window.addEventListener("resize", scheduleScroll, { passive: true });

    const revealElements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-reveal", "visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    revealElements.forEach((element) => observer.observe(element));

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", scheduleScroll);
      window.removeEventListener("resize", scheduleScroll);
      observer.disconnect();
    };
  }, []);

  const currentTab = previewTabs.find((tab) => tab.id === activeTab) ?? previewTabs[0];

  return (
    <div className="nf-landing">
      <div ref={progressRef} className="nf-scroll-progress" style={{ transform: "scaleX(0)" }} aria-hidden="true" />
      <div className="nf-bg-grid" aria-hidden="true" />

      <div className="nf-launch-ribbon" role="region" aria-label="Oferta especial de lançamento">
        <div className="nf-container nf-launch-ribbon-inner">
          <span className="nf-launch-pill">
            <Flame className="size-3.5" />
            OFERTA DE LANÇAMENTO
          </span>
          <p>
            Condição especial para as primeiras empresas: <strong>até 71% OFF</strong> — plano completo com 10 usuários a partir de <strong>R$ 20/mês</strong>.
          </p>
          <a href="#planos" className="nf-launch-link">
            Garantir oferta <ArrowRight className="size-3.5" />
          </a>
        </div>
      </div>

      <div ref={navWrapRef} className="nf-nav-wrap">
        <nav className="nf-nav" aria-label="Navegação principal">
          <a href="#inicio" className="nf-brand">
            <span>Nexo</span>Fab
          </a>
          <div className="nf-nav-links">
            <a href="#produto">Sistema</a>
            <a href="#modulos">Módulos</a>
            <a href="#comparativo">Comparativo</a>
            <a href="#planos">Oferta</a>
            <a href="#duvidas">Dúvidas</a>
          </div>
          <div className="nf-nav-actions">
            <Link href="/login" className="nf-btn-ghost">
              Entrar
            </Link>
            <Link href="/cadastro" className="nf-btn-primary">
              Testar 7 dias grátis
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </nav>
      </div>

      <header id="inicio" className="nf-hero">
        <div className="nf-container">
          <div className="nf-hero-head">
            <div className="nf-pill">
              <span className="nf-pill-dot" />
              Oferta especial de lançamento · ERP &amp; PCP para comunicação visual, gráficas e fabricação sob medida
            </div>
            <h1>
              Poder de ERP gigante, <em>preço de lançamento e uso em 3 minutos.</em>
            </h1>
            <p className="nf-hero-copy">
              24 projetos guiados personalizáveis, plano de corte vetorial (DXF/SVG) com réguas em cm, proposta online
              com fotos, Kanban PCP com Modo TV, agenda de instalação com Maps/Waze, link de rastreio do pedido e
              financeiro completo com recibo no WhatsApp.
            </p>
            <div className="nf-hero-actions">
              <Link href="/cadastro" className="nf-btn-primary nf-btn-lg">
                Começar 7 dias grátis
                <ArrowRight className="size-4" />
              </Link>
              <a href="#planos" className="nf-btn-secondary nf-btn-lg">
                Ver oferta de lançamento (R$ 20/mês)
              </a>
            </div>
            <div className="nf-hero-trust">
              <span><Check /> Zero taxa de implantação</span>
              <span><Check /> Sem cartão nos 7 dias grátis</span>
              <span><Check /> Até 10 usuários inclusos</span>
              <span><Check /> Até 71% OFF no lançamento</span>
            </div>
          </div>

          <div id="produto" className="nf-stage-wrap" data-reveal="pending" style={revealDelay(80)}>
            <div className="nf-stage">
              <div className="nf-stage-bar">
                <div className="nf-dots" aria-hidden="true">
                  <i /><i /><i />
                </div>
                <span className="nf-stage-url">nexofab.vercel.app/gestao</span>
                <span className="nf-stage-badge">
                  <ShieldCheck className="size-3.5" />
                  Multiempresa · Isolado RLS
                </span>
              </div>

              <div className="nf-stage-tabs" role="tablist" aria-label="Módulos interativos do NexoFab">
                {previewTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      className={activeTab === tab.id ? "nf-stage-tab active" : "nf-stage-tab"}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div key={currentTab.id} className="nf-stage-body">
                <div>
                  <div className="nf-stage-kpis">
                    {currentTab.kpis.map((kpi) => (
                      <div key={kpi.label} className="nf-kpi">
                        <small>{kpi.label}</small>
                        <strong>{kpi.value}</strong>
                        <span>{kpi.delta}</span>
                      </div>
                    ))}
                  </div>
                  {renderStageVisual(currentTab.id)}
                </div>

                <aside className="nf-stage-aside">
                  <div>
                    <small>{currentTab.asideKicker}</small>
                    <h3>{currentTab.asideTitle}</h3>
                    <p>{currentTab.asideCopy}</p>
                  </div>
                  <ul className="nf-stage-checks">
                    {currentTab.bullets.map((bullet) => (
                      <li key={bullet}>
                        <Check />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="nf-marquee" aria-label="Segmentos atendidos pelo NexoFab">
        <div className="nf-marquee-track">
          {[...marqueeItems, ...marqueeItems].map((item, idx) => (
            <span key={`${item}-${idx}`} className="nf-marquee-item">
              <i />
              {item}
            </span>
          ))}
        </div>
      </div>

      <section id="modulos" className="nf-section">
        <div className="nf-container">
          <div className="nf-section-head" data-reveal="pending">
            <p className="nf-kicker">Tudo conectado de verdade</p>
            <h2>Cada setor da sua fábrica falando a mesma língua.</h2>
            <p>
              Construído para substituir planilhas espalhadas, esquecimentos no WhatsApp e ERPs caros demais — do
              primeiro orçamento até a etiqueta na caixa entregue.
            </p>
          </div>

          <div className="nf-bento">
            <article className="nf-bento-card wide" data-reveal="pending" style={revealDelay(40)}>
              <div className="nf-icon-box"><Columns3 className="size-5" /></div>
              <h3>24 Projetos Guiados, Proposta com Fotos &amp; Portal /p</h3>
              <p>
                Personalize quais projetos sua empresa atende (fachada ACM, letra caixa, luminoso backlight, troféu,
                cavalete, wind banner, vitrine, adesivo e mais), anexe fotos ou mockups na proposta online, acompanhe
                aberturas (&ldquo;Vista Xx&rdquo;) e receba pedidos 24h no seu portal /p/sua-empresa.
              </p>
              <div className="nf-mini-chips">
                <span>24 Projetos Guiados</span>
                <span>Fotos na proposta &amp; OS</span>
                <span>Rastreio &ldquo;Vista Xx&rdquo;</span>
                <span>Portal /p/sua-empresa</span>
              </div>
            </article>

            <article className="nf-bento-card medium" data-reveal="pending" style={revealDelay(110)}>
              <div className="nf-icon-box teal"><Scissors className="size-5" /></div>
              <h3>Plano de Corte Vetorial (DXF/SVG) com Réguas &amp; Bobina</h3>
              <p>
                Importe DXF/SVG para Laser e Router CNC com encaixe inteligente até dentro de furos, régua graduada em
                cm mostrando consumo e sobra real, chapas padrão prontas (PVC/PS, ACM, Acrílico, MDF) e encaixe rápido
                por medida em chapa ou bobina.
              </p>
              <div className="nf-mini-chips">
                <span>DXF / SVG inteligente</span>
                <span>Régua em cm + sobra</span>
                <span>Chapas padrão prontas</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(60)}>
              <div className="nf-icon-box teal"><Factory className="size-5" /></div>
              <h3>Kanban PCP, Modo TV, QR Code &amp; OS Rápida</h3>
              <p>
                Quadro visual de 8 etapas com semáforo de prazo, Modo TV na oficina, QR Code para avançar etapa no
                celular, etiquetas térmicas/A4 e <strong>OS rápida avulsa</strong> para serviços fechados direto no
                balcão ou WhatsApp sem burocracia.
              </p>
              <div className="nf-mini-chips">
                <span>OS rápida sem orçamento</span>
                <span>Modo TV + QR Code</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(130)}>
              <div className="nf-icon-box"><CalendarDays className="size-5" /></div>
              <h3>Agenda de Instalação &amp; Rastreio Público do Pedido</h3>
              <p>
                Organize instalações e entregas no calendário semanal/mensal arrastável com botão direto para Google
                Maps, Waze e roteiro imprimível — e envie um link público (/pedido) para o cliente acompanhar a
                produção sem cobrar toda hora no WhatsApp.
              </p>
              <div className="nf-mini-chips">
                <span><MapPin className="size-3 inline mr-1" />Maps &amp; Waze 1-toque</span>
                <span>Link público /pedido</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(200)}>
              <div className="nf-icon-box teal"><CircleDollarSign className="size-5" /></div>
              <h3>Gráficos Executivos, DRE, Caixa &amp; Recibo no Orçamento</h3>
              <p>
                Faturamento × despesas × saldo dos últimos 6 meses, ponto de equilíbrio ao vivo, leitor de boleto PDF,
                contas a receber de todos os meses e baixa de pagamento com <strong>recibo digital no WhatsApp</strong>{" "}
                direto dentro do orçamento.
              </p>
              <div className="nf-mini-chips">
                <span>Receber &amp; Recibo 1-clique</span>
                <span>DRE &amp; gráficos BI</span>
              </div>
            </article>

            <article className="nf-bento-card half" data-reveal="pending" style={revealDelay(70)}>
              <div className="nf-icon-box"><Boxes className="size-5" /></div>
              <h3>Estoque com reserva por OS, Atendimentos &amp; Ficha 360º</h3>
              <p>
                Reserve chapas e insumos automaticamente ao aprovar a OS com baixa rastreável na conclusão, mais Central
                de Atendimentos com alertas na tela do PC e Ficha 360º reunindo histórico comercial e financeiro de cada
                cliente.
              </p>
              <div className="nf-mini-chips">
                <span>Reserva automática por OS</span>
                <span>Alertas anti-esquecimento</span>
                <span>Ficha 360º do cliente</span>
              </div>
            </article>

            <article className="nf-bento-card half" data-reveal="pending" style={revealDelay(140)}>
              <div className="nf-icon-box teal"><Lock className="size-5" /></div>
              <h3>Equipe por setor (até 10 usuários) &amp; segurança RLS</h3>
              <p>
                Convide comercial, produção, estoque e financeiro com permissões granulares aplicadas diretamente no
                banco de dados (Row Level Security) e isolamento total entre empresas.
              </p>
              <div className="nf-mini-chips">
                <span><Users className="size-3 inline mr-1" />Até 10 usuários</span>
                <span>Permissões por setor</span>
                <span>Isolamento RLS</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="comparativo" className="nf-section">
        <div className="nf-container">
          <div className="nf-section-head center" data-reveal="pending">
            <p className="nf-kicker">Comparativo real de mercado</p>
            <h2>Recursos de ERP de R$ 600+/mês por uma fração do preço.</h2>
            <p>
              Sem taxa de implantação, sem contratos presos e sem cobrar por módulo separado.
            </p>
          </div>

          <div className="nf-compare-card" data-reveal="pending" style={revealDelay(80)}>
            <div className="nf-compare-scroll">
              <table className="nf-compare-table">
                <thead>
                  <tr>
                    <th>Recurso essencial da fábrica</th>
                    <th>Planilhas &amp; WhatsApp</th>
                    <th>ERPs tradicionais</th>
                    <th className="nf-compare-highlight">NexoFab</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.feature}>
                      <td><b>{row.feature}</b></td>
                      <td>
                        {row.spreadsheets === "no" ? (
                          <span className="nf-cmp-no"><X />Não tem</span>
                        ) : (
                          <span className="nf-cmp-partial"><Minus />Manual</span>
                        )}
                      </td>
                      <td>
                        {row.legacy === "yes" ? (
                          <span className="nf-cmp-yes-muted"><Check />Sim</span>
                        ) : row.legacy === "partial" ? (
                          <span className="nf-cmp-partial"><Minus />Opcional / caro</span>
                        ) : (
                          <span className="nf-cmp-text">{row.legacy}</span>
                        )}
                      </td>
                      <td className="nf-compare-highlight">
                        {row.nexofab === "yes" ? (
                          <span className="nf-cmp-yes"><Check />Incluso</span>
                        ) : (
                          <strong className="nf-cmp-best">{row.nexofab}</strong>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="nf-section" style={{ paddingTop: 20 }}>
        <div className="nf-container">
          <div className="nf-section-head center" data-reveal="pending">
            <p className="nf-kicker">Implantação imediata</p>
            <h2>Comece a operar em menos de 3 minutos.</h2>
            <p>Sem instalação local, sem servidor próprio e com opção de carregar dados de exemplo em 1 clique.</p>
          </div>

          <div className="nf-steps">
            {[
              ["01", "Crie sua conta grátis", "Cadastre seu nome, e-mail e senha. Não pedimos cartão de crédito para iniciar."],
              ["02", "Personalize sua empresa", "Suba sua logo, ative seu portal /p/sua-empresa e ganhe 7 dias grátis completos."],
              ["03", "Convide sua equipe", "Adicione até 10 pessoas definindo quem cuida de vendas, produção, estoque ou caixa."],
              ["04", "Escolha seu ciclo", "Quando aprovar o sistema, ative o plano mensal, trimestral ou anual via PIX, boleto ou cartão."],
            ].map(([num, title, desc], idx) => (
              <article key={num} className="nf-step" data-reveal="pending" style={revealDelay(idx * 80)}>
                <span className="nf-step-num">{num}</span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="nf-section nf-pricing-section">
        <div className="nf-container">
          <div className="nf-section-head center" data-reveal="pending">
            <span className="nf-launch-offer-tag">
              <Flame className="size-3.5" />
              OFERTA ESPECIAL DE LANÇAMENTO · ATÉ 71% OFF
            </span>
            <h2>Condição exclusiva para as primeiras empresas.</h2>
            <p>
              Todos os módulos liberados desde o primeiro dia, até 10 usuários inclusos e <strong>7 dias grátis</strong>{" "}
              para validar na prática — com valores promocionais de lançamento por tempo limitado.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", ...revealDelay(60) }} data-reveal="pending">
            <div className="nf-cycle-switch" role="tablist" aria-label="Destacar ciclo de assinatura">
              <button
                type="button"
                role="tab"
                aria-selected={selectedCycle === "monthly"}
                className={selectedCycle === "monthly" ? "active" : ""}
                onClick={() => setSelectedCycle("monthly")}
              >
                Mensal <small>-58%</small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedCycle === "quarterly"}
                className={selectedCycle === "quarterly" ? "active" : ""}
                onClick={() => setSelectedCycle("quarterly")}
              >
                Trimestral <small>-64%</small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedCycle === "yearly"}
                className={selectedCycle === "yearly" ? "active" : ""}
                onClick={() => setSelectedCycle("yearly")}
              >
                Anual <small>-71%</small>
              </button>
            </div>
          </div>

          <div className="nf-plans-grid">
            {plans.map((plan, idx) => {
              const isSelected = selectedCycle === plan.cycle;
              return (
                <article
                  key={plan.cycle}
                  className={isSelected ? "nf-plan selected" : "nf-plan"}
                  data-reveal="pending"
                  style={revealDelay(idx * 90)}
                  onMouseEnter={() => setSelectedCycle(plan.cycle)}
                >
                  <div className="nf-plan-top">
                    <span className="nf-plan-badge">{plan.badge}</span>
                    <span className="nf-plan-discount">{plan.discountTag}</span>
                  </div>
                  <h3>{plan.name}</h3>
                  <div className="nf-plan-anchor">
                    <span>De <s>{plan.regularPrice}/mês</s> por</span>
                  </div>
                  <div className="nf-plan-price">
                    <strong>{plan.price}</strong>
                    <span>/mês</span>
                  </div>
                  <p className="nf-plan-sub">{plan.sub}</p>
                  <Link
                    href="/cadastro"
                    className={isSelected ? "nf-btn-primary nf-btn-lg" : "nf-btn-secondary nf-btn-lg"}
                  >
                    Garantir oferta · 7 dias grátis
                    <ArrowRight className="size-4" />
                  </Link>
                </article>
              );
            })}
          </div>

          <div className="nf-launch-guarantee" data-reveal="pending" style={revealDelay(100)}>
            <Sparkles className="size-4" />
            <span>
              <strong>Lote de lançamento:</strong> teste 7 dias grátis sem cartão e, ao ativar a assinatura, garanta o
              preço promocional com 100% dos recursos liberados — sem taxas escondidas e sem cobrança por módulo.
            </span>
          </div>

          <ul className="nf-included-bar" data-reveal="pending" style={revealDelay(120)}>
            {included.map((item) => (
              <li key={item}>
                <Check />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="duvidas" className="nf-section">
        <div className="nf-container nf-faq-grid">
          <div className="nf-section-head" data-reveal="pending">
            <p className="nf-kicker">Dúvidas frequentes</p>
            <h2>Sem letras miúdas.</h2>
            <p>Tudo que você precisa saber antes de colocar sua empresa para rodar no NexoFab.</p>
            <div style={{ marginTop: "8px" }}>
              <Link href="/cadastro" className="nf-btn-primary">
                <Sparkles className="size-4" />
                Criar conta grátis
              </Link>
            </div>
          </div>

          <div className="nf-faq-list" data-reveal="pending" style={revealDelay(80)}>
            <details open>
              <summary>Preciso informar cartão de crédito para testar os 7 dias?</summary>
              <p>Não. Você cria sua conta, cadastra sua empresa no onboarding e usa o sistema completo por 7 dias sem cadastrar nenhum meio de pagamento.</p>
            </details>
            <details>
              <summary>O valor promocional de lançamento muda depois que eu assinar?</summary>
              <p>Quem ativa durante a oferta de lançamento garante o preço promocional no ciclo contratado — no plano anual, por exemplo, você trava R$ 20/mês pelos 12 meses inteiros com até 10 usuários e todos os módulos liberados.</p>
            </details>
            <details>
              <summary>O NexoFab gera recibo e emite Nota Fiscal?</summary>
              <p>Sim para recibos: você registra pagamentos direto no orçamento ou no Contas a Receber e gera recibos digitais profissionais com a sua marca prontos para enviar no WhatsApp. Já a emissão automática de NF-e/NFS-e faz parte da próxima fase como módulo adicional — você já pode operar hoje com seu emissor atual ou contador sem travar a rotina.</p>
            </details>
            <details>
              <summary>O que acontece se o período de teste vencer antes de eu assinar?</summary>
              <p>Seus clientes, orçamentos, ordens e financeiro continuam intactos em modo somente leitura. Assim que o pagamento for confirmado, a gravação é liberada automaticamente.</p>
            </details>
            <details>
              <summary>Quantos usuários posso adicionar na minha empresa?</summary>
              <p>O Plano Completo inclui até 10 usuários ativos por empresa, com papéis separados para administrador, comercial, produção, estoque e financeiro.</p>
            </details>
            <details>
              <summary>Funciona no celular na oficina e em TV no chão de fábrica?</summary>
              <p>Sim. A OS imprime um QR Code que abre a ordem direto no celular do operador com avanço de etapa em 1 toque, a Agenda de Instalação abre rotas no Google Maps e Waze, e a Produção conta com Modo TV em tela cheia atualizado a cada 30 segundos.</p>
            </details>
            <details>
              <summary>Consigo pagar por PIX ou boleto além de cartão?</summary>
              <p>Sim. A cobrança é processada pelo Asaas com opção de PIX, boleto bancário ou cartão de crédito nos ciclos mensal, trimestral ou anual.</p>
            </details>
            <details>
              <summary>Meus dados ficam misturados com os de outras empresas?</summary>
              <p>Nunca. Cada empresa opera em um tenant isolado no banco de dados com Row Level Security (RLS) e arquivos armazenados separadamente.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="nf-section" style={{ paddingTop: 0 }}>
        <div className="nf-container">
          <div className="nf-cta-box" data-reveal="pending">
            <div>
              <p className="nf-kicker" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <Layers className="size-4" /> OFERTA DE LANÇAMENTO POR TEMPO LIMITADO
              </p>
              <h2>Teste o NexoFab na prática hoje mesmo.</h2>
              <p>7 dias grátis com acesso completo, até 10 usuários e oferta de lançamento de R$ 69 por a partir de R$ 20/mês no anual.</p>
            </div>
            <div className="nf-cta-actions">
              <Link href="/cadastro" className="nf-btn-primary nf-btn-lg">
                Começar 7 dias grátis
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/login" className="nf-btn-secondary nf-btn-lg">
                Já tenho conta
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="nf-footer">
        <div className="nf-container nf-footer-inner">
          <a href="#inicio" className="nf-brand">
            <span>Nexo</span>Fab
          </a>
          <div className="nf-footer-links">
            <a href="#produto">Sistema</a>
            <a href="#modulos">Módulos</a>
            <a href="#comparativo">Comparativo</a>
            <a href="#planos">Planos</a>
            <Link href="/termos">Termos</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/login">Entrar</Link>
            <Link href="/cadastro">Criar conta</Link>
          </div>
          <span>© {new Date().getFullYear()} NexoFab · Gestão para fabricação</span>
        </div>
      </footer>
    </div>
  );
}
