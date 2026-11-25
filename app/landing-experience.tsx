"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Boxes,
  Calculator,
  Check,
  CircleDollarSign,
  ClipboardList,
  Columns3,
  Eye,
  Factory,
  Layers,
  Lock,
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
      { label: "Rastreio ao vivo", value: "Vista 3x", delta: "Alerta quando cliente abre" },
    ],
    asideKicker: "COMERCIAL ANTI-ESQUECIMENTO",
    asideTitle: "Funil Kanban, rastreio de abertura e portal de pedidos.",
    asideCopy:
      "Arraste propostas pelo funil, receba aviso na tela quando o cliente abrir o link ou ficar sem resposta e receba pedidos 24h pelo seu portal /p/sua-empresa.",
    bullets: [
      "Funil Kanban com soma em R$ por coluna",
      "Selo 'Vista Xx' + alerta no sino e na tela do PC",
      "Portal público /p/sua-empresa e Central de Atendimentos",
    ],
  },
  {
    id: "precificacao",
    label: "Chapa & Bobina",
    icon: Calculator,
    kpis: [
      { label: "Aproveitamento", value: "87,4%", delta: "Chapa ACM 122×500 cm" },
      { label: "Sobra real", value: "12,6%", delta: "Calculada antes de orçar" },
      { label: "Margem líquida", value: "38,2%", delta: "Hora-máquina + fixos" },
    ],
    asideKicker: "MARGEM PROTEGIDA NA ORIGEM",
    asideTitle: "Encaixe visual de chapas, bobinas e arquivos DXF/SVG.",
    asideCopy:
      "Digite medidas retangulares em centímetros (ACM, MDF, Acrílico, Vinil ou Lona) e veja o mapa de corte na hora — ou importe DXF/SVG para Laser e Router CNC.",
    bullets: [
      "Encaixe rápido por medida sem precisar de arquivo vetorial",
      "Importação DXF/SVG para RDWorks e Aspire",
      "Leva o custo exato direto para o orçamento em 1 clique",
    ],
  },
  {
    id: "producao",
    label: "Kanban PCP & TV",
    icon: Factory,
    kpis: [
      { label: "OS no chão", value: "12 ordens", delta: "Kanban arrastar e soltar" },
      { label: "QR Code na OS", value: "1 toque", delta: "Operador avança no celular" },
      { label: "Modo TV PCP", value: "Ao vivo", delta: "Atualiza a cada 30s" },
    ],
    asideKicker: "CHÃO DE FÁBRICA NÍVEL ERP GIGANTE",
    asideTitle: "Kanban PCP, Modo TV, QR Code e Etiquetas de Volume.",
    asideCopy:
      "Arraste ordens entre etapas, deixe a TV da oficina mostrando atrasos e prioridades em tempo real, imprima OS com QR Code e gere etiquetas térmicas ou A4 de expedição.",
    bullets: [
      "Kanban visual de 8 etapas com baixa automática de estoque",
      "QR Code na folha da OS + botão de avanço rápido no celular",
      "Etiquetas de volume (100×150mm ou A4) + prova de arte online",
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
    asideTitle: "Gráficos de 6 meses, DRE, contas, comissões e recibo.",
    asideCopy:
      "Visualize faturamento × despesas × saldo, importe boletos em PDF, acompanhe o ponto de equilíbrio em tempo real e envie recibos digitais profissionais pelo WhatsApp.",
    bullets: [
      "Gráficos executivos interativos na Visão Geral e Relatórios",
      "Contas a pagar/receber parceladas, comissões e Ficha 360º",
      "Exportação CSV/PDF + recibo digital com sua marca",
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
  { feature: "Precificação técnica (m², chapa, bobina, hora-máquina e perdas)", spreadsheets: "partial", legacy: "yes", nexofab: "yes" },
  { feature: "Encaixe visual de chapas/bobinas + importação DXF/SVG", spreadsheets: "no", legacy: "partial", nexofab: "yes" },
  { feature: "Kanban PCP Drag & Drop + Modo TV de Chão de Fábrica", spreadsheets: "no", legacy: "yes", nexofab: "yes" },
  { feature: "QR Code na OS (1 toque no celular) + Etiquetas de Volume", spreadsheets: "no", legacy: "partial", nexofab: "yes" },
  { feature: "Proposta online com rastreio ('Vista Xx') + Portal /p/sua-empresa", spreadsheets: "no", legacy: "partial", nexofab: "yes" },
  { feature: "Gráficos executivos, DRE, Ponto de Equilíbrio e Recibo Digital", spreadsheets: "partial", legacy: "yes", nexofab: "yes" },
  { feature: "Taxa de implantação / setup", spreadsheets: "partial", legacy: "R$ 1.000 – R$ 3.500", nexofab: "R$ 0 (usa em 3 min)" },
  { feature: "Investimento mensal (até 10 usuários inclusos)", spreadsheets: "partial", legacy: "R$ 450 – R$ 1.500/mês", nexofab: "A partir de R$ 20/mês" },
];

const plans: Array<{
  cycle: PlanCycle;
  name: string;
  badge: string;
  price: string;
  sub: string;
}> = [
  {
    cycle: "monthly",
    name: "Plano Completo · Mensal",
    badge: "Sem fidelidade",
    price: "R$ 29,00",
    sub: "Cobrança mensal de R$ 29,00. Flexibilidade total para cancelar quando quiser.",
  },
  {
    cycle: "quarterly",
    name: "Plano Completo · Trimestral",
    badge: "14% OFF · Mais escolhido",
    price: "R$ 25,00",
    sub: "Cobrança de R$ 75,00 a cada 3 meses. Equilíbrio ideal entre economia e caixa.",
  },
  {
    cycle: "yearly",
    name: "Plano Completo · Anual",
    badge: "31% OFF · Maior economia",
    price: "R$ 20,00",
    sub: "Cobrança anual de R$ 240,00. O menor custo mensal para a operação inteira.",
  },
];

const included = [
  "7 dias grátis completos sem cadastrar cartão",
  "Até 10 usuários ativos por empresa com papéis por setor",
  "Kanban PCP, Modo TV, QR Code na OS e Etiquetas Térmicas/A4",
  "Encaixe visual de chapa/bobina, DXF/SVG e precificação real",
  "Proposta online ('Vista Xx'), portal /p/slug, arte e recibo com sua marca",
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

      <div ref={navWrapRef} className="nf-nav-wrap">
        <nav className="nf-nav" aria-label="Navegação principal">
          <a href="#inicio" className="nf-brand">
            <span>Nexo</span>Fab
          </a>
          <div className="nf-nav-links">
            <a href="#produto">Sistema</a>
            <a href="#modulos">Módulos</a>
            <a href="#comparativo">Comparativo</a>
            <a href="#planos">Planos</a>
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
              ERP &amp; PCP moderno para comunicação visual, gráficas e fabricação sob medida
            </div>
            <h1>
              Poder de ERP gigante, <em>preço justo e uso em 3 minutos.</em>
            </h1>
            <p className="nf-hero-copy">
              Funil Kanban, precificação real por m²/chapa/bobina, encaixe visual, Kanban PCP com Modo TV e QR Code na
              OS, etiquetas de expedição, aprovação de arte e financeiro completo — tudo no mesmo lugar.
            </p>
            <div className="nf-hero-actions">
              <Link href="/cadastro" className="nf-btn-primary nf-btn-lg">
                Começar 7 dias grátis
                <ArrowRight className="size-4" />
              </Link>
              <a href="#planos" className="nf-btn-secondary nf-btn-lg">
                Planos a partir de R$ 20/mês
              </a>
            </div>
            <div className="nf-hero-trust">
              <span><Check /> Zero taxa de implantação</span>
              <span><Check /> Sem cartão no teste</span>
              <span><Check /> Até 10 usuários inclusos</span>
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
              <h3>Funil Kanban, Proposta Online e Portal /p/sua-empresa</h3>
              <p>
                Arraste propostas pelo funil comercial com soma em R$ por coluna, envie alternativas no mesmo link com a
                sua marca e saiba na hora quando o cliente abriu a proposta. Publique seu próprio portal de pedidos para
                receber solicitações direto no sino.
              </p>
              <div className="nf-mini-chips">
                <span>Funil Kanban Drag &amp; Drop</span>
                <span>Rastreio &ldquo;Vista Xx&rdquo;</span>
                <span>Portal /p/sua-empresa</span>
                <span>Venda rápida de balcão</span>
              </div>
            </article>

            <article className="nf-bento-card medium" data-reveal="pending" style={revealDelay(110)}>
              <div className="nf-icon-box teal"><Scissors className="size-5" /></div>
              <h3>Encaixe Visual de Chapa/Bobina &amp; DXF/SVG</h3>
              <p>
                Simule cortes retangulares em chapas (ACM, MDF, Acrílico, PVC) ou bobinas (vinil/lona) sem precisar de
                vetor, ou importe DXF/SVG para Laser e Router CNC com envio direto ao orçamento.
              </p>
              <div className="nf-mini-chips">
                <span>Chapa &amp; Bobina visual</span>
                <span>DXF / SVG</span>
                <span>Hora-máquina &amp; perdas</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(60)}>
              <div className="nf-icon-box teal"><Factory className="size-5" /></div>
              <h3>Kanban PCP, Modo TV &amp; QR Code na OS</h3>
              <p>
                Quadro visual de 8 etapas com semáforo de prazo, tela cheia para TV na oficina, QR Code na OS para
                avançar etapa em 1 toque no celular, aprovação de arte online e etiquetas de volume (térmica ou A4).
              </p>
              <div className="nf-mini-chips">
                <span>Modo TV Chão de Fábrica</span>
                <span>QR Code + Etiquetas</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(130)}>
              <div className="nf-icon-box"><BellRing className="size-5" /></div>
              <h3>Central de Atendimentos &amp; Ficha 360º</h3>
              <p>
                Nunca mais esqueça um cliente sem resposta na correria: alertas no sino e na tela do PC para orçamentos
                parados e retornos agendados, mais Ficha 360º com histórico financeiro e comercial completo.
              </p>
              <div className="nf-mini-chips">
                <span>Alertas na tela do PC</span>
                <span>Ficha 360º do cliente</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(200)}>
              <div className="nf-icon-box teal"><CircleDollarSign className="size-5" /></div>
              <h3>Gráficos Executivos, DRE &amp; Caixa</h3>
              <p>
                Faturamento × despesas × saldo dos últimos 6 meses, funil de conversão, ponto de equilíbrio ao vivo,
                contas a pagar com leitor de boleto PDF, comissões e recibo digital para WhatsApp.
              </p>
              <div className="nf-mini-chips">
                <span>Gráficos BI 6 meses</span>
                <span>DRE &amp; ponto de equilíbrio</span>
              </div>
            </article>

            <article className="nf-bento-card half" data-reveal="pending" style={revealDelay(70)}>
              <div className="nf-icon-box"><Boxes className="size-5" /></div>
              <h3>Estoque sincronizado com reserva automática por OS</h3>
              <p>
                Reserve chapas e insumos assim que o orçamento vira produção, visualize alertas de saldo insuficiente
                direto no card do Kanban e dê baixa rastreável ao finalizar a ordem.
              </p>
              <div className="nf-mini-chips">
                <span>Reserva por OS</span>
                <span>Baixa na conclusão</span>
                <span>Alertas de mínimo</span>
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
            <p className="nf-kicker">Preço transparente de lançamento</p>
            <h2>Um plano completo. Escolha como prefere pagar.</h2>
            <p>Todos os módulos liberados desde o primeiro dia, com até 10 usuários ativos e 7 dias grátis para validar na prática.</p>
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
                Mensal
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedCycle === "quarterly"}
                className={selectedCycle === "quarterly" ? "active" : ""}
                onClick={() => setSelectedCycle("quarterly")}
              >
                Trimestral <small>-14%</small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedCycle === "yearly"}
                className={selectedCycle === "yearly" ? "active" : ""}
                onClick={() => setSelectedCycle("yearly")}
              >
                Anual <small>-31%</small>
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
                  <span className="nf-plan-badge">{plan.badge}</span>
                  <h3>{plan.name}</h3>
                  <div className="nf-plan-price">
                    <strong>{plan.price}</strong>
                    <span>/mês</span>
                  </div>
                  <p className="nf-plan-sub">{plan.sub}</p>
                  <Link
                    href="/cadastro"
                    className={isSelected ? "nf-btn-primary nf-btn-lg" : "nf-btn-secondary nf-btn-lg"}
                  >
                    Começar 7 dias grátis
                    <ArrowRight className="size-4" />
                  </Link>
                </article>
              );
            })}
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
              <summary>O que acontece se o período de teste vencer antes de eu assinar?</summary>
              <p>Seus clientes, orçamentos, ordens e financeiro continuam intactos em modo somente leitura. Assim que o pagamento for confirmado, a gravação é liberada automaticamente.</p>
            </details>
            <details>
              <summary>Quantos usuários posso adicionar na minha empresa?</summary>
              <p>O Plano Completo inclui até 10 usuários ativos por empresa, com papéis separados para administrador, comercial, produção, estoque e financeiro.</p>
            </details>
            <details>
              <summary>Funciona no celular na oficina e em TV no chão de fábrica?</summary>
              <p>Sim. A OS imprime um QR Code que abre a ordem direto no celular do operador com avanço de etapa em 1 toque, e a aba Produção conta com Modo TV em tela cheia com atualização automática a cada 30 segundos.</p>
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
                <Layers className="size-4" /> PRONTO PARA ELEVAR O NÍVEL DA SUA OPERAÇÃO?
              </p>
              <h2>Teste o NexoFab na prática hoje mesmo.</h2>
              <p>7 dias grátis com acesso completo, até 10 usuários e planos a partir de R$ 20/mês no anual.</p>
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
