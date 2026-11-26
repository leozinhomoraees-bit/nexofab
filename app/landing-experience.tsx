"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Calculator,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Columns3,
  Eye,
  Factory,
  Flame,
  Layers,
  Lock,
  MapPin,
  MessageCircle,
  Minus,
  Navigation,
  QrCode,
  Scissors,
  ShieldCheck,
  Sparkles,
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
    label: "Orçamentos",
    icon: ClipboardList,
    kpis: [
      { label: "Em negociação", value: "R$ 44.500", delta: "18 orçamentos abertos" },
      { label: "Fechamentos", value: "64%", delta: "Aprovação em 1 clique" },
      { label: "Aviso na hora", value: "Vista 3x", delta: "Saiba quando o cliente abriu" },
    ],
    asideKicker: "VENDA MAIS RÁPIDO",
    asideTitle: "Orçamento bonito com foto, aviso de abertura e recibo no WhatsApp.",
    asideCopy:
      "Escolha entre 24 modelos prontos (fachada, letreiro, luminoso, adesivo...), anexe fotos do projeto, envie o link com a sua marca e receba aviso assim que o cliente abrir.",
    bullets: [
      "24 modelos prontos de orçamento que você escolhe e personaliza",
      "Fotos de referência direto na proposta + aviso quando o cliente visualizar",
      "Página própria para receber pedidos 24h + recibo pronto pro WhatsApp",
    ],
  },
  {
    id: "precificacao",
    label: "Plano de Corte",
    icon: Scissors,
    kpis: [
      { label: "Aproveitamento", value: "87,4%", delta: "Régua em cm + sobra real" },
      { label: "Chapas prontas", value: "6 padrões", delta: "PVC, PS, ACM, Acrílico, MDF" },
      { label: "Lucro garantido", value: "38,2%", delta: "Material + máquina + sobra" },
    ],
    asideKicker: "MENOS DESPERDÍCIO DE CHAPA",
    asideTitle: "Veja o desenho do corte com régua em cm antes de gastar material.",
    asideCopy:
      "Envie o arquivo de corte (DXF ou SVG do Corel/Illustrator) e o sistema encaixa as peças automaticamente — até dentro de furos. Ou digite as medidas em centímetros para chapas e bobinas.",
    bullets: [
      "Régua em centímetros em volta da chapa mostrando exatamente o que vai usar",
      "Chapas padrão já cadastradas (PVC, PS, ACM, Acrílico e MDF) para usar na hora",
      "Leva o custo certo do material direto para o orçamento em 1 clique",
    ],
  },
  {
    id: "producao",
    label: "Produção & Agenda",
    icon: Factory,
    kpis: [
      { label: "Na oficina", value: "12 pedidos", delta: "Quadro visual simples" },
      { label: "Agenda de rua", value: "Maps / Waze", delta: "Rota da instalação em 1 toque" },
      { label: "Pro seu cliente", value: "Link ao vivo", delta: "Acompanha sem ficar cobrando" },
    ],
    asideKicker: "OFICINA SEM BAGUNÇA",
    asideTitle: "Quadro de produção, agenda de instalação e rastreio pro cliente.",
    asideCopy:
      "Acompanhe cada pedido da arte até a entrega, lance serviços rápidos fechados no WhatsApp sem burocracia, agende instalações com rota no Maps/Waze e mande o link de rastreio pro cliente.",
    bullets: [
      "Quadro visual fácil de arrastar, tela para TV na oficina e QR Code no papel",
      "Agenda semanal e mensal com botão direto pro Google Maps, Waze e WhatsApp",
      "Link de acompanhamento pro cliente ver em que etapa está o pedido dele",
    ],
  },
  {
    id: "financeiro",
    label: "Caixa & Recibo",
    icon: BarChart3,
    kpis: [
      { label: "Entradas no mês", value: "R$ 48.900", delta: "+18% que o mês passado" },
      { label: "Meta do mês", value: "118%", delta: "Contas pagas e caixa positivo" },
      { label: "Sobrou no bolso", value: "R$ 17.640", delta: "Lucro real do mês" },
    ],
    asideKicker: "CLAREZA TOTAL NO DINHEIRO",
    asideTitle: "Saiba quanto entrou, quanto saiu e quem ainda falta pagar.",
    asideCopy:
      "Veja gráficos simples dos últimos 6 meses, controle contas a pagar e a receber sem esquecer nenhuma parcela, dê baixa direto no orçamento e envie o recibo com sua logo no WhatsApp.",
    bullets: [
      "Gráfico fácil de entender mostrando entradas, despesas e lucro real",
      "Controle de parcelas, comissões e histórico completo de cada cliente",
      "Recibo digital com sua marca pronto para mandar no WhatsApp em 1 clique",
    ],
  },
];

const marqueeItems = [
  "Comunicação Visual",
  "Fachadas em ACM",
  "Corte Router & CNC",
  "Corte e Gravação a Laser",
  "Impressão Digital",
  "Marcenaria Sob Medida",
  "Displays & Placas",
  "Troféus & Acrílico",
  "Sinalização & Adesivos",
  "Gráficas Rápidas",
];

const comparisonRows: Array<{
  feature: string;
  spreadsheets: "no" | "partial";
  legacy: "yes" | "partial" | string;
  nexofab: "yes" | string;
}> = [
  { feature: "24 modelos prontos de orçamento + cálculo de material, máquina e lucro", spreadsheets: "partial", legacy: "partial", nexofab: "yes" },
  { feature: "Plano de corte visual com régua em cm (arquivos DXF/SVG + chapas e bobinas)", spreadsheets: "no", legacy: "partial", nexofab: "yes" },
  { feature: "Proposta online com fotos do projeto, aviso de abertura e página de pedidos", spreadsheets: "no", legacy: "partial", nexofab: "yes" },
  { feature: "Quadro de produção visual, pedido rápido, tela na TV e QR Code no celular", spreadsheets: "no", legacy: "yes", nexofab: "yes" },
  { feature: "Agenda de instalação com Google Maps/Waze + link de rastreio pro cliente", spreadsheets: "no", legacy: "partial", nexofab: "yes" },
  { feature: "Gráficos de lucro, contas a pagar/receber e recibo digital no WhatsApp", spreadsheets: "partial", legacy: "yes", nexofab: "yes" },
  { feature: "Taxa para começar a usar", spreadsheets: "partial", legacy: "R$ 1.000 – R$ 3.500", nexofab: "R$ 0 (usa em 3 min)" },
  { feature: "Valor mensal (até 10 pessoas da equipe inclusas)", spreadsheets: "partial", legacy: "R$ 450 – R$ 1.500/mês", nexofab: "Lançamento: a partir de R$ 20/mês" },
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
    sub: "Cobrança mensal de R$ 29,00. Sem fidelidade — cancele quando quiser.",
  },
  {
    cycle: "quarterly",
    name: "Plano Completo · Trimestral",
    badge: "Mais escolhido · Lançamento",
    regularPrice: "R$ 69,00",
    discountTag: "64% OFF",
    price: "R$ 25,00",
    sub: "Cobrança de R$ 75,00 a cada 3 meses. Ótima economia sem pesar no caixa.",
  },
  {
    cycle: "yearly",
    name: "Plano Completo · Anual",
    badge: "Preço de fundador",
    regularPrice: "R$ 69,00",
    discountTag: "71% OFF",
    price: "R$ 20,00",
    sub: "Cobrança anual de R$ 240,00. Trava o menor preço de lançamento por 12 meses.",
  },
];

const included = [
  "7 dias grátis completos sem pedir cartão de crédito",
  "Até 10 pessoas da sua equipe com acessos separados por função",
  "24 modelos prontos de orçamento + proposta com fotos e recibo no WhatsApp",
  "Plano de corte com régua em cm para arquivos (DXF/SVG), chapas e bobinas",
  "Quadro de produção, agenda de instalação (Maps/Waze) e link de rastreio",
  "Controle financeiro completo com pagamento por PIX, boleto ou cartão",
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
            <small>#1051 · Link de pedidos</small>
            <b>Totem ACM 2,40m</b>
            <em>R$ 6.800</em>
          </article>
          <article>
            <small>#1052 · WhatsApp</small>
            <b>Adesivo em Van</b>
            <em>R$ 4.600</em>
          </article>
        </div>
        <div className="nf-mini-col accent-amber">
          <header><b>Enviados</b><span>R$ 18.900</span></header>
          <article>
            <div className="nf-mini-badges">
              <small>#1045</small>
              <span className="nf-mini-eye"><Eye />Vista 3x</span>
            </div>
            <b>24 placas acrílico 6mm</b>
            <span className="nf-mini-pill amber"><Camera className="size-3" />2 fotos anexadas</span>
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
              <span className="nf-mini-ok">Aprovado em 1 clique</span>
            </div>
            <b>Letra Caixa LED + ACM</b>
            <span className="nf-mini-pill ok">Sinal pago · Recibo pronto</span>
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
          <span><b>Chapa PVC / PS 122 × 244 cm</b></span>
          <em>Usado: 118 cm · Sobra livre: 126 cm</em>
        </div>
        <svg viewBox="0 0 520 156" className="nf-mini-nesting-svg" role="img" aria-label="Exemplo visual do plano de corte com régua em centímetros e linha de sobra">
          {/* Régua esquerda (cm) */}
          <g stroke="#648391" strokeWidth="1" fill="#89a8b6" fontSize="8.5" fontWeight="700">
            <line x1="34" y1="10" x2="34" y2="128" />
            <line x1="28" y1="10" x2="34" y2="10" /><text x="25" y="13" textAnchor="end">122</text>
            <line x1="28" y1="69" x2="34" y2="69" /><text x="25" y="72" textAnchor="end">60</text>
            <line x1="28" y1="128" x2="34" y2="128" /><text x="25" y="131" textAnchor="end">0</text>
            {/* Régua inferior (cm) */}
            <line x1="38" y1="132" x2="504" y2="132" />
            <line x1="38" y1="132" x2="38" y2="137" /><text x="38" y="148" textAnchor="middle">0</text>
            <line x1="154" y1="132" x2="154" y2="137" /><text x="154" y="148" textAnchor="middle">60</text>
            <line x1="271" y1="132" x2="271" y2="137" /><text x="271" y="148" textAnchor="middle">120</text>
            <line x1="387" y1="132" x2="387" y2="137" /><text x="387" y="148" textAnchor="middle">180</text>
            <line x1="504" y1="132" x2="504" y2="137" /><text x="504" y="148" textAnchor="middle">244 cm</text>
          </g>

          {/* Chapa */}
          <rect x="38" y="10" width="466" height="118" rx="4" fill="#0b1f2c" stroke="#2c5364" strokeWidth="1.5" />
          <rect x="43" y="15" width="456" height="108" fill="none" stroke="rgba(255,255,255,0.14)" strokeDasharray="4 4" strokeWidth="1" />

          {/* Peças encaixadas (incluindo peça aproveitando furo interno!) */}
          <g fill="#0e8b81" fillOpacity="0.34" stroke="#2dd4bf" strokeWidth="1.3">
            <rect x="46" y="18" width="76" height="48" rx="3" />
            <rect x="46" y="70" width="76" height="48" rx="3" />
            <rect x="126" y="18" width="66" height="100" rx="3" />
            {/* Furo interno da peça + mini peça encaixada dentro */}
            <rect x="139" y="34" width="40" height="68" rx="2" fill="#0b1f2c" stroke="#f59e0b" strokeWidth="1.1" />
            <rect x="145" y="42" width="28" height="52" rx="2" fill="#c6f054" fillOpacity="0.28" stroke="#c6f054" strokeWidth="1.2" />
            {/* Peças rotacionadas */}
            <rect x="196" y="18" width="64" height="48" rx="3" />
            <rect x="196" y="70" width="64" height="48" rx="3" />
          </g>
          <g fill="#ccfbf1" fontSize="8.5" fontWeight="700" textAnchor="middle">
            <text x="84" y="45">40×25</text>
            <text x="84" y="97">40×25</text>
            <text x="159" y="71" fill="#ecfccb" fontSize="7.5">No furo ✓</text>
            <text x="228" y="45">35×25 ↻</text>
            <text x="228" y="97">35×25 ↻</text>
          </g>

          {/* Linha tracejada laranja de área usada */}
          <line x1="266" y1="10" x2="266" y2="128" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 4" />
          <text x="274" y="30" fill="#fcd34d" fontSize="9.5" fontWeight="800">Usado: 118 cm</text>
          <text x="274" y="44" fill="#93aab5" fontSize="8.5" fontWeight="600">Sobra livre para retalho: 126 cm</text>
        </svg>
        <div className="nf-mini-nesting-foot">
          <span>Encaixa até dentro dos furos da peça</span>
          <span>Régua em cm + aviso da sobra livre</span>
        </div>
      </div>
    );
  }

  if (tabId === "producao") {
    return (
      <div className="nf-mini-kanban">
        <div className="nf-mini-col">
          <header><b>Aprovação de Arte</b><span>3 pedidos</span></header>
          <article>
            <small>Pedido #325 · Arte v2</small>
            <b>Adesivo frota 2 vans</b>
            <span className="nf-mini-pill amber">Aguardando cliente</span>
          </article>
        </div>
        <div className="nf-mini-col accent-teal">
          <header><b>Na Oficina</b><span>5 pedidos</span></header>
          <article className="highlight">
            <div className="nf-mini-badges">
              <small>Pedido #318 · URGENTE</small>
              <span className="nf-mini-eye"><QrCode />QR ativo</span>
            </div>
            <b>Totem luminoso recepção</b>
            <span className="nf-mini-pill ok">Link de rastreio enviado</span>
          </article>
        </div>
        <div className="nf-mini-col accent-lime">
          <header><b>Instalação Hoje</b><span>4 pedidos</span></header>
          <article>
            <div className="nf-mini-badges">
              <small>Hoje · 14:00</small>
              <span className="nf-mini-ok"><Navigation className="size-3" />Maps / Waze</span>
            </div>
            <b>Fachada Padaria Central</b>
            <span className="nf-mini-pill lime"><Tv />Na TV da oficina</span>
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
        <span><b>Últimos 6 meses</b> · Entradas × Saídas × Lucro</span>
        <em>Sobrou 36,1% livre</em>
      </div>
      <svg viewBox="0 0 480 132" className="nf-mini-chart-svg" role="img" aria-label="Gráfico simples de entradas, saídas e lucro dos últimos 6 meses">
        {[20, 56, 92].map((y) => (
          <line key={y} x1="16" x2="466" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
        ))}
        {bars.map((b, i) => {
          const x = 32 + i * 74;
          return (
            <g key={b.m}>
              <rect x={x} y={108 - b.rev} width="20" height={b.rev} rx="4" fill="#14b8a6" />
              <rect x={x + 24} y={108 - b.exp} width="20" height={b.exp} rx="4" fill="#e26d54" opacity="0.88" />
              <text x={x + 22} y="125" textAnchor="middle" fill="#90a8b4" fontSize="10.5" fontWeight="700">{b.m}</text>
            </g>
          );
        })}
        <path
          d="M 54 80 L 128 74 L 202 78 L 276 64 L 350 58 L 424 48"
          fill="none"
          stroke="#c6f054"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {[
          [54, 80],
          [128, 74],
          [202, 78],
          [276, 64],
          [350, 58],
          [424, 48],
        ].map(([cx, cy], idx) => (
          <circle key={idx} cx={cx} cy={cy} r="4" fill="#c6f054" stroke="#081927" strokeWidth="2" />
        ))}
      </svg>
      <div className="nf-mini-receipt-strip">
        <span><CheckCircle2 className="size-3.5" /><b>Recibo #1042</b> · Pago no PIX · R$ 3.400,00</span>
        <em><MessageCircle className="size-3" />Enviar no WhatsApp</em>
      </div>
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
            Condição especial para as primeiras empresas: <strong>até 71% OFF</strong> — sistema completo para até 10 pessoas a partir de <strong>R$ 20/mês</strong>.
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
            <a href="#produto">Por dentro</a>
            <a href="#exemplos">Exemplos</a>
            <a href="#modulos">Recursos</a>
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
              Oferta de lançamento · Sistema completo para comunicação visual, gráficas e fabricação sob medida
            </div>
            <h1>
              Orçamento, corte, produção e caixa <em>organizados em 3 minutos.</em>
            </h1>
            <p className="nf-hero-copy">
              Chega de perder dinheiro em planilhas soltas e conversas perdidas no WhatsApp. Faça orçamentos rápidos com
              fotos, calcule o melhor corte da chapa, organize a oficina e a agenda de instalação e saiba exatamente
              quanto lucrou no mês.
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
              <span><Check /> Zero taxa para começar</span>
              <span><Check /> Sem cartão nos 7 dias grátis</span>
              <span><Check /> Até 10 pessoas na equipe</span>
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
                  Seus dados 100% privados e seguros
                </span>
              </div>

              <div className="nf-stage-tabs" role="tablist" aria-label="Telas do NexoFab">
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

      <div className="nf-marquee" aria-label="Tipos de empresas que usam o NexoFab">
        <div className="nf-marquee-track">
          {[...marqueeItems, ...marqueeItems].map((item, idx) => (
            <span key={`${item}-${idx}`} className="nf-marquee-item">
              <i />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* NOVA SEÇÃO VISUAL: Exemplos reais na prática */}
      <section id="exemplos" className="nf-section nf-showcase-section">
        <div className="nf-container">
          <div className="nf-section-head center" data-reveal="pending">
            <p className="nf-kicker">Veja na prática</p>
            <h2>Telas fáceis de entender, feitas para a rotina real da oficina.</h2>
            <p>
              Nada de sistema complicado cheio de termos difíceis. Olha como o NexoFab facilita o trabalho no dia a dia:
            </p>
          </div>

          <div className="nf-showcase-grid">
            {/* Exemplo Visual 1: 24 Projetos Prontos */}
            <article className="nf-showcase-card" data-reveal="pending" style={revealDelay(40)}>
              <div className="nf-showcase-visual">
                <div className="nf-mock-bar">
                  <span><Calculator className="size-3.5" />Novo orçamento rápido</span>
                  <em>24 modelos prontos</em>
                </div>
                <div className="nf-mock-projects">
                  <span className="active">Fachada ACM</span>
                  <span>Letra Caixa</span>
                  <span>Luminoso LED</span>
                  <span>Troféu Acrílico</span>
                  <span>Adesivo / Vitrine</span>
                  <span>Banner / Lona</span>
                  <span>Cavalete</span>
                  <span>Wind Banner</span>
                </div>
                <div className="nf-mock-calc">
                  <div>
                    <small>MEDIDA INFORMADA</small>
                    <b>Fachada 4,00 × 1,20 m · ACM 3mm + Instalação</b>
                  </div>
                  <div className="nf-mock-calc-price">
                    <small>PREÇO COM LUCRO</small>
                    <strong>R$ 4.890,00</strong>
                  </div>
                </div>
              </div>
              <div className="nf-showcase-copy">
                <h3>Orce em segundos sem esquecer nenhum custo</h3>
                <p>
                  Escolha os modelos que a sua empresa realmente faz, digite largura e altura e o sistema já soma
                  material, perda, tempo de produção e a sua margem de lucro.
                </p>
              </div>
            </article>

            {/* Exemplo Visual 2: Proposta com foto no celular do cliente */}
            <article className="nf-showcase-card" data-reveal="pending" style={revealDelay(110)}>
              <div className="nf-showcase-visual">
                <div className="nf-mock-proposal">
                  <div className="nf-mock-proposal-head">
                    <div>
                      <small>PROPOSTA COM A SUA MARCA</small>
                      <b>Padaria Central · Fachada + Letras</b>
                    </div>
                    <span className="nf-mini-eye"><Eye className="size-3" />Vista 3x</span>
                  </div>
                  <div className="nf-mock-photo-row">
                    <div className="nf-mock-photo-thumb" aria-hidden="true">
                      <svg viewBox="0 0 180 74" role="img" aria-label="Exemplo de foto de fachada anexada">
                        <rect width="180" height="74" rx="6" fill="#0d2636" />
                        <rect x="10" y="12" width="160" height="32" rx="4" fill="#163b4d" stroke="#2dd4bf" strokeWidth="1.2" />
                        <text x="90" y="32" textAnchor="middle" fill="#c6f054" fontSize="11.5" fontWeight="800" letterSpacing="1.4">PADARIA CENTRAL</text>
                        <rect x="26" y="48" width="44" height="22" rx="2" fill="#123040" />
                        <rect x="78" y="48" width="76" height="22" rx="2" fill="#123040" />
                      </svg>
                      <span><Camera className="size-3" />Foto de referência</span>
                    </div>
                    <div className="nf-mock-proposal-cta">
                      <small>TOTAL DO SERVIÇO</small>
                      <strong>R$ 4.890,00</strong>
                      <span className="nf-mock-approve-btn"><Check className="size-3.5" />Aprovar proposta</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="nf-showcase-copy">
                <h3>Proposta bonita no celular que fecha mais vendas</h3>
                <p>
                  Envie um link profissional no WhatsApp com sua logo e fotos de referência. Você recebe um alerta na
                  hora em que o cliente abre e ele aprova com 1 clique.
                </p>
              </div>
            </article>

            {/* Exemplo Visual 3: Plano de Corte Vetorial com Régua */}
            <article className="nf-showcase-card" data-reveal="pending" style={revealDelay(80)}>
              <div className="nf-showcase-visual">
                <div className="nf-mock-bar">
                  <span><Scissors className="size-3.5" />Plano de Corte · PVC / PS 122×244 cm</span>
                  <em>7 letras encaixadas</em>
                </div>
                <svg viewBox="0 0 420 124" className="nf-mock-cut-svg" role="img" aria-label="Exemplo visual de letras encaixadas na chapa com régua em centímetros">
                  {/* Réguas */}
                  <g stroke="#648391" strokeWidth="1" fill="#89a8b6" fontSize="8" fontWeight="700">
                    <line x1="28" y1="8" x2="28" y2="100" />
                    <text x="23" y="13" textAnchor="end">122</text>
                    <text x="23" y="56" textAnchor="end">60</text>
                    <text x="23" y="102" textAnchor="end">0</text>
                    <line x1="32" y1="104" x2="404" y2="104" />
                    <text x="34" y="116" textAnchor="start">0</text>
                    <text x="155" y="116" textAnchor="middle">80</text>
                    <text x="278" y="116" textAnchor="middle">160</text>
                    <text x="402" y="116" textAnchor="end">244 cm</text>
                  </g>
                  {/* Chapa */}
                  <rect x="32" y="8" width="372" height="92" rx="4" fill="#091b27" stroke="#2c5364" strokeWidth="1.4" />
                  {/* Letras encaixadas compactas no canto esquerdo */}
                  <g fill="#14b8a6" fillOpacity="0.24" stroke="#2dd4bf" strokeWidth="1.4" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="29">
                    <text x="40" y="42">P</text>
                    <text x="64" y="42">A</text>
                    <text x="90" y="42">D</text>
                    <text x="116" y="42">A</text>
                    <text x="40" y="88">R</text>
                    <text x="68" y="88">I</text>
                    <text x="84" y="88">A</text>
                  </g>
                  {/* Linha laranja de consumo */}
                  <line x1="146" y1="8" x2="146" y2="100" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 4" />
                  <text x="154" y="34" fill="#fcd34d" fontSize="10" fontWeight="800">Usado: 74 cm</text>
                  <text x="154" y="50" fill="#93aab5" fontSize="9" fontWeight="600">Sobra livre: 170 cm de chapa limpa</text>
                  <rect x="154" y="64" width="128" height="22" rx="11" fill="rgba(198,240,84,0.12)" stroke="rgba(198,240,84,0.35)" />
                  <text x="218" y="78" textAnchor="middle" fill="#c6f054" fontSize="8.5" fontWeight="800">Baixar DXF / SVG pronto</text>
                </svg>
              </div>
              <div className="nf-showcase-copy">
                <h3>Saiba na hora quanto de chapa o serviço vai gastar</h3>
                <p>
                  Jogue seu arquivo de corte ou digite as medidas. A régua em volta mostra o consumo exato e quanto de
                  retalho sobra — evitando prejuízo no orçamento.
                </p>
              </div>
            </article>

            {/* Exemplo Visual 4: Agenda de Instalação + Link do Cliente */}
            <article className="nf-showcase-card" data-reveal="pending" style={revealDelay(150)}>
              <div className="nf-showcase-visual">
                <div className="nf-mock-split">
                  <div className="nf-mock-agenda">
                    <small><CalendarDays className="size-3" />AGENDA DA SEMANA</small>
                    <div className="nf-mock-agenda-item">
                      <b>Ter 09:00 · Fachada Padaria</b>
                      <span>Av. Brasil, 420 · Equipe Carlos</span>
                      <div className="nf-mock-agenda-btns">
                        <em><MapPin className="size-3" />Maps</em>
                        <em><Navigation className="size-3" />Waze</em>
                      </div>
                    </div>
                    <div className="nf-mock-agenda-item subtle">
                      <b>Qua 14:30 · Entrega 20 placas</b>
                      <span>Clínica Vida · Retirada pronta</span>
                    </div>
                  </div>
                  <div className="nf-mock-track">
                    <small>TELA DO SEU CLIENTE</small>
                    <b>Pedido #1042</b>
                    <ul>
                      <li className="done"><Check className="size-3" />Pedido confirmado</li>
                      <li className="done"><Check className="size-3" />Arte aprovada</li>
                      <li className="now"><i />Em produção</li>
                      <li><i />Instalação Terça 09h</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="nf-showcase-copy">
                <h3>Agenda pro instalador e rastreio pro cliente</h3>
                <p>
                  Sua equipe de rua abre o endereço no Google Maps ou Waze com 1 toque, e o cliente acompanha o status
                  do pedido pelo celular sem precisar ficar perguntando toda hora.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="modulos" className="nf-section">
        <div className="nf-container">
          <div className="nf-section-head" data-reveal="pending">
            <p className="nf-kicker">Tudo conectado</p>
            <h2>Cada parte da sua empresa trabalhando junto.</h2>
            <p>
              Feito para trocar planilhas bagunçadas, anotações soltas no WhatsApp e sistemas caros demais — do primeiro
              orçamento até o dinheiro no caixa.
            </p>
          </div>

          <div className="nf-bento">
            <article className="nf-bento-card wide" data-reveal="pending" style={revealDelay(40)}>
              <div className="nf-icon-box"><Columns3 className="size-5" /></div>
              <h3>Vendas rápidas, Proposta com Fotos &amp; Link de Pedidos</h3>
              <p>
                Acompanhe cada orçamento em um quadro simples, envie propostas bonitas com fotos de referência no
                WhatsApp, saiba quando o cliente abriu e tenha seu próprio link para receber pedidos 24h por dia.
              </p>
              <div className="nf-mini-chips">
                <span>24 modelos prontos</span>
                <span>Fotos na proposta</span>
                <span>Aviso quando o cliente abre</span>
                <span>Link próprio de pedidos</span>
              </div>
            </article>

            <article className="nf-bento-card medium" data-reveal="pending" style={revealDelay(110)}>
              <div className="nf-icon-box teal"><Scissors className="size-5" /></div>
              <h3>Plano de Corte com Régua em cm</h3>
              <p>
                Envie arquivos DXF ou SVG (Corel, AutoCAD, Illustrator) ou digite as medidas em centímetros para chapas
                e bobinas. O sistema encaixa melhor as peças e mostra a sobra real antes de cortar.
              </p>
              <div className="nf-mini-chips">
                <span>DXF / SVG automático</span>
                <span>Régua em cm + sobra</span>
                <span>Chapas padrão prontas</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(60)}>
              <div className="nf-icon-box teal"><Factory className="size-5" /></div>
              <h3>Oficina Organizada, TV &amp; Pedido Rápido</h3>
              <p>
                Quadro visual de produção com alertas de prazo, tela em modo TV para a oficina, QR Code na folha do
                pedido para a equipe atualizar pelo celular e <strong>pedido rápido</strong> para serviços fechados
                direto no balcão ou WhatsApp.
              </p>
              <div className="nf-mini-chips">
                <span>Serviço rápido sem orçamento</span>
                <span>TV na oficina + QR Code</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(130)}>
              <div className="nf-icon-box"><CalendarDays className="size-5" /></div>
              <h3>Agenda de Instalação &amp; Rastreio do Pedido</h3>
              <p>
                Arraste datas no calendário semanal ou mensal, imprima o roteiro do dia com rota no Google Maps e Waze,
                e envie um link simples para o cliente acompanhar a produção em tempo real.
              </p>
              <div className="nf-mini-chips">
                <span><MapPin className="size-3 inline mr-1" />Maps &amp; Waze 1-toque</span>
                <span>Rastreio pro cliente</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(200)}>
              <div className="nf-icon-box teal"><CircleDollarSign className="size-5" /></div>
              <h3>Caixa, Lucro Real &amp; Recibo no WhatsApp</h3>
              <p>
                Veja entradas, saídas e quanto sobrou no mês sem complicação, leia boletos em PDF automaticamente,
                controle parcelas e envie <strong>recibo digital com sua marca</strong> direto dentro do orçamento.
              </p>
              <div className="nf-mini-chips">
                <span>Receber &amp; Recibo 1-clique</span>
                <span>Gráficos fáceis de lucro</span>
              </div>
            </article>

            <article className="nf-bento-card half" data-reveal="pending" style={revealDelay(70)}>
              <div className="nf-icon-box"><Boxes className="size-5" /></div>
              <h3>Estoque no controle &amp; Histórico completo do cliente</h3>
              <p>
                Separe chapas e materiais automaticamente quando um pedido entra em produção, receba aviso quando algo
                estiver acabando e consulte todo o histórico de compras e pagamentos de cada cliente em uma só tela.
              </p>
              <div className="nf-mini-chips">
                <span>Baixa automática no estoque</span>
                <span>Aviso de material acabando</span>
                <span>Histórico do cliente</span>
              </div>
            </article>

            <article className="nf-bento-card half" data-reveal="pending" style={revealDelay(140)}>
              <div className="nf-icon-box teal"><Lock className="size-5" /></div>
              <h3>Até 10 pessoas na equipe &amp; Dados 100% privados</h3>
              <p>
                Cadastre vendedores, arte-finalistas, produção e financeiro escolhendo o que cada pessoa pode ver ou
                alterar. Os dados da sua empresa ficam totalmente separados e protegidos — só sua equipe tem acesso.
              </p>
              <div className="nf-mini-chips">
                <span><Users className="size-3 inline mr-1" />Até 10 pessoas inclusas</span>
                <span>Acesso por função</span>
                <span>Privacidade garantida</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="comparativo" className="nf-section">
        <div className="nf-container">
          <div className="nf-section-head center" data-reveal="pending">
            <p className="nf-kicker">Compare na prática</p>
            <h2>Tudo que sistemas caros oferecem, fácil de usar e por uma fração do preço.</h2>
            <p>
              Sem taxa para começar, sem contrato preso e sem cobrar extra por cada ferramenta.
            </p>
          </div>

          <div className="nf-compare-card" data-reveal="pending" style={revealDelay(80)}>
            <div className="nf-compare-scroll">
              <table className="nf-compare-table">
                <thead>
                  <tr>
                    <th>O que sua empresa precisa no dia a dia</th>
                    <th>Planilhas &amp; WhatsApp</th>
                    <th>Sistemas tradicionais</th>
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
            <p className="nf-kicker">Simples de começar</p>
            <h2>Comece a usar em menos de 3 minutos.</h2>
            <p>Funciona direto no navegador e no celular — sem instalar nada e com dados de exemplo para testar na hora.</p>
          </div>

          <div className="nf-steps">
            {[
              ["01", "Crie sua conta grátis", "Informe seu nome, e-mail e senha. Não pedimos cartão de crédito para testar."],
              ["02", "Coloque sua marca", "Suba sua logo, coloque o nome da empresa e libere 7 dias grátis com tudo aberto."],
              ["03", "Chame sua equipe", "Adicione até 10 pessoas definindo quem mexe em vendas, produção, estoque ou caixa."],
              ["04", "Escolha seu plano", "Gostou do resultado? Ative a oferta de lançamento pagando por PIX, boleto ou cartão."],
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
            <h2>Preço especial para as primeiras empresas.</h2>
            <p>
              Tudo liberado desde o primeiro dia, até 10 pessoas na equipe e <strong>7 dias grátis</strong> para testar
              sem compromisso — com desconto especial de lançamento por tempo limitado.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", ...revealDelay(60) }} data-reveal="pending">
            <div className="nf-cycle-switch" role="tablist" aria-label="Escolher período de pagamento">
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
              <strong>Lote de lançamento:</strong> teste 7 dias grátis sem cartão e, ao assinar, garanta o preço
              promocional com todas as ferramentas liberadas — sem taxas escondidas e sem cobrança extra por função.
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
            <h2>Respostas diretas, sem enrolação.</h2>
            <p>Tudo que você precisa saber antes de testar o NexoFab na sua empresa.</p>
            <div style={{ marginTop: "8px" }}>
              <Link href="/cadastro" className="nf-btn-primary">
                <Sparkles className="size-4" />
                Criar conta grátis
              </Link>
            </div>
          </div>

          <div className="nf-faq-list" data-reveal="pending" style={revealDelay(80)}>
            <details open>
              <summary>Preciso colocar cartão de crédito para testar os 7 dias?</summary>
              <p>Não. Você cria sua conta, coloca o nome da sua empresa e usa o sistema completo por 7 dias sem informar nenhum cartão.</p>
            </details>
            <details>
              <summary>O valor promocional de lançamento sobe depois que eu assinar?</summary>
              <p>Quem assina durante a oferta de lançamento garante o preço promocional no período contratado — no plano anual, por exemplo, você trava R$ 20/mês pelos 12 meses inteiros com tudo liberado.</p>
            </details>
            <details>
              <summary>O NexoFab gera recibo e emite Nota Fiscal?</summary>
              <p>Para recibos, sim: você registra o pagamento direto no orçamento ou no financeiro e gera recibos digitais com a sua marca prontos para enviar no WhatsApp. Já a emissão automática de Nota Fiscal entrará na próxima fase — enquanto isso, você usa normalmente o emissor da prefeitura ou seu contador.</p>
            </details>
            <details>
              <summary>O que acontece se os 7 dias grátis acabarem antes de eu assinar?</summary>
              <p>Você não perde nada. Seus clientes, orçamentos e pedidos continuam salvos para consulta e, assim que o pagamento for confirmado, tudo volta ao normal na hora.</p>
            </details>
            <details>
              <summary>Quantas pessoas da minha equipe podem usar?</summary>
              <p>Até 10 pessoas por empresa já inclusas no mesmo valor, escolhendo quem pode ver vendas, produção, estoque ou financeiro.</p>
            </details>
            <details>
              <summary>Funciona no celular e em TV na oficina?</summary>
              <p>Sim. A folha do pedido sai com QR Code para a equipe atualizar pelo celular em 1 toque, a agenda de instalação abre direto no Google Maps e Waze, e a tela de produção tem modo TV para deixar visível na oficina.</p>
            </details>
            <details>
              <summary>Posso pagar com PIX ou boleto?</summary>
              <p>Sim! Aceitamos PIX, boleto bancário e cartão de crédito nos planos mensal, trimestral ou anual.</p>
            </details>
            <details>
              <summary>Outras empresas conseguem ver meus clientes ou preços?</summary>
              <p>Nunca. Cada empresa tem seu espaço 100% separado e protegido por senha — só você e a equipe que você convidar acessam os seus dados.</p>
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
              <p>7 dias grátis com tudo liberado, até 10 pessoas na equipe e oferta de lançamento de R$ 69 por a partir de R$ 20/mês no anual.</p>
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
            <a href="#produto">Por dentro</a>
            <a href="#exemplos">Exemplos</a>
            <a href="#modulos">Recursos</a>
            <a href="#comparativo">Comparativo</a>
            <a href="#planos">Oferta</a>
            <Link href="/termos">Termos</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/login">Entrar</Link>
            <Link href="/cadastro">Criar conta</Link>
          </div>
          <span>© {new Date().getFullYear()} NexoFab · Gestão simples para comunicação visual e fabricação</span>
        </div>
      </footer>
    </div>
  );
}
