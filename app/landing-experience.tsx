"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Calculator,
  Check,
  CircleDollarSign,
  ClipboardList,
  Factory,
  Layers,
  Lock,
  Scissors,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

type PreviewTabId = "comercial" | "precificacao" | "producao" | "financeiro";
type PlanCycle = "monthly" | "quarterly" | "yearly";

const previewTabs: Array<{
  id: PreviewTabId;
  label: string;
  icon: typeof ClipboardList;
  kpis: Array<{ label: string; value: string; delta: string }>;
  rows: Array<{ title: string; subtitle: string; tag: string; tone: "ok" | "lime" | "amber" }>;
  asideKicker: string;
  asideTitle: string;
  asideCopy: string;
  bullets: string[];
}> = [
  {
    id: "comercial",
    label: "Orçamentos & Proposta",
    icon: ClipboardList,
    kpis: [
      { label: "Propostas abertas", value: "18", delta: "Link público ativo" },
      { label: "Taxa de aprovação", value: "64%", delta: "Aprovação em 1 clique" },
      { label: "Ticket médio", value: "R$ 3.480", delta: "Com alternativas" },
    ],
    rows: [
      { title: "Fachada ACM 4,80 × 1,20m + Letra Caixa LED", subtitle: "Proposta #1042 · Cliente escolheu Opção B", tag: "Aprovada", tone: "lime" },
      { title: "Kit Sinalização Interna · 24 placas acrílico", subtitle: "Proposta #1045 · Link enviado via WhatsApp", tag: "Aguardando", tone: "amber" },
      { title: "Adesivo perfurado vitrine + instalação", subtitle: "Proposta #1048 · Convertida automaticamente", tag: "Em produção", tone: "ok" },
    ],
    asideKicker: "COMERCIAL SEM ATRITO",
    asideTitle: "Seu cliente aprova a proposta online com a sua marca.",
    asideCopy: "Envie alternativas de material ou acabamento no mesmo link. Quando ele aprova, a versão fica congelada e a OS já nasce pronta.",
    bullets: ["Proposta pública personalizada com sua logo", "Alternativas selecionáveis pelo cliente", "Histórico completo de revisões"],
  },
  {
    id: "precificacao",
    label: "Precificação & Corte",
    icon: Calculator,
    kpis: [
      { label: "Aproveitamento chapa", value: "87,4%", delta: "Plano de corte otimizado" },
      { label: "Margem líquida", value: "38,2%", delta: "Custos fixos inclusos" },
      { label: "Perda calculada", value: "12,6%", delta: "Sem chute no preço" },
    ],
    rows: [
      { title: "Chapa ACM 3mm Preto Fosco (1220 × 5000mm)", subtitle: "6 peças encaixadas · 1 chapa reservada", tag: "Otimizado", tone: "ok" },
      { title: "Router CNC · 1h 40min + fresa 6mm", subtitle: "Custo hora/máquina + consumíveis aplicados", tag: "Calculado", tone: "lime" },
      { title: "Vinil adesivo brilho 1,22m + laminação", subtitle: "Cálculo automático por m² + margem alvo", tag: "Pronto", tone: "ok" },
    ],
    asideKicker: "MARGEM REAL PROTEGIDA",
    asideTitle: "Pare de perder dinheiro em orçamento feito no olho.",
    asideCopy: "Combine chapas, insumos, tempo de máquina, mão de obra e plano de corte para formar preços seguros em segundos.",
    bullets: ["Plano de corte visual enviado direto ao orçamento", "Receitas de custo por produto e variante", "Ponto de equilíbrio conectado ao financeiro"],
  },
  {
    id: "producao",
    label: "Produção & Arte",
    icon: Factory,
    kpis: [
      { label: "OS em andamento", value: "12", delta: "Briefing até expedição" },
      { label: "Artes aprovadas", value: "9 / 10", delta: "Link de prova online" },
      { label: "Insumos reservados", value: "100%", delta: "Estoque sincronizado" },
    ],
    rows: [
      { title: "OS #318 · Totem luminoso recepção", subtitle: "Arte v2 aprovada pelo cliente · CNC liberada", tag: "Produção", tone: "lime" },
      { title: "OS #321 · Painel MDF fresado + pintura", subtitle: "3 chapas reservadas automaticamente", tag: "Acabamento", tone: "ok" },
      { title: "OS #325 · Plotagem frota 2 veículos", subtitle: "Aguardando aprovação da arte v1", tag: "Prova de arte", tone: "amber" },
    ],
    asideKicker: "CHÃO DE FÁBRICA ORGANIZADO",
    asideTitle: "Arte aprovada antes de ligar a máquina.",
    asideCopy: "Acompanhe cada etapa da ordem de produção, registre custos reais, reserve estoque automaticamente e evite retrabalho.",
    bullets: ["Link público de aprovação de arte por versão", "Reserva e baixa automática de insumos", "Responsáveis e prazos por ordem de produção"],
  },
  {
    id: "financeiro",
    label: "Financeiro & Caixa",
    icon: CircleDollarSign,
    kpis: [
      { label: "Recebido no mês", value: "R$ 48.900", delta: "Entrada + parcelas" },
      { label: "A receber (30d)", value: "R$ 19.450", delta: "Alertas de vencimento" },
      { label: "Ponto de equilíbrio", value: "118%", delta: "Meta superada" },
    ],
    rows: [
      { title: "Entrada 50% · Proposta #1042 (PIX)", subtitle: "Recibo digital público emitido automaticamente", tag: "Recebido", tone: "lime" },
      { title: "Fornecedor Chapas Sul · Boleto 2/3", subtitle: "Centro de custo: Produção · Vence em 3 dias", tag: "Agendado", tone: "amber" },
      { title: "Venda rápida balcão #1049", subtitle: "Pagamento integral + baixa de estoque", tag: "Concluído", tone: "ok" },
    ],
    asideKicker: "CAIXA SEM SURPRESAS",
    asideTitle: "Contas a pagar, receber, DRE e recibo em um clique.",
    asideCopy: "Saiba exatamente quanto entrou, quanto vai vencer, qual o lucro real do mês e envie recibo profissional pelo WhatsApp.",
    bullets: ["Contas a pagar e receber parceladas", "Recibo digital público com logo da empresa", "DRE gerencial e fluxo de caixa projetado"],
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
  "Gráficas Sob Medida",
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
  "Comercial, Precificação, Plano de Corte, Produção, Estoque e Financeiro",
  "Proposta online, aprovação de arte e recibo digital com sua marca",
  "Isolamento total multiempresa (RLS) e backups gerenciados",
  "Pagamento seguro via PIX, boleto bancário ou cartão (Asaas)",
];

function revealDelay(ms: number): CSSProperties {
  return { "--delay": `${ms}ms` } as CSSProperties;
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
            <a href="#como-funciona">Como funciona</a>
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
              Plataforma SaaS para fabricação sob medida e comunicação visual
            </div>
            <h1>
              O sistema completo do <em>orçamento ao caixa.</em>
            </h1>
            <p className="nf-hero-copy">
              Unifique propostas online, precificação técnica, plano de corte, ordens de produção, aprovação de arte,
              estoque e financeiro em uma plataforma rápida, moderna e isolada por empresa.
            </p>
            <div className="nf-hero-actions">
              <Link href="/cadastro" className="nf-btn-primary nf-btn-lg">
                Começar 7 dias grátis
                <ArrowRight className="size-4" />
              </Link>
              <a href="#planos" className="nf-btn-secondary nf-btn-lg">
                Ver planos a partir de R$ 20/mês
              </a>
            </div>
            <div className="nf-hero-trust">
              <span><Check /> Sem cartão no teste</span>
              <span><Check /> Até 10 usuários inclusos</span>
              <span><Check /> PIX, boleto ou cartão</span>
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
                  Multiempresa · Isolado
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
                  <div className="nf-stage-list">
                    {currentTab.rows.map((row) => (
                      <div key={row.title} className="nf-stage-row">
                        <div>
                          <b>{row.title}</b>
                          <small>{row.subtitle}</small>
                        </div>
                        <span className={`nf-tag ${row.tone}`}>{row.tag}</span>
                      </div>
                    ))}
                  </div>
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
              Construído para substituir planilhas espalhadas, retrabalho no WhatsApp e controles paralelos que fazem
              sua margem desaparecer no fim do mês.
            </p>
          </div>

          <div className="nf-bento">
            <article className="nf-bento-card wide" data-reveal="pending" style={revealDelay(40)}>
              <div className="nf-icon-box"><ClipboardList className="size-5" /></div>
              <h3>Orçamentos com proposta online e aprovação em 1 clique</h3>
              <p>
                Monte composições detalhadas com sua identidade visual, ofereça alternativas no mesmo link e deixe o
                cliente aprovar direto pelo celular. Ao aprovar, o sistema registra a versão fechada e já envia o pedido
                para a fila de produção.
              </p>
              <div className="nf-mini-chips">
                <span>Link público com sua logo</span>
                <span>Grupos de alternativas</span>
                <span>Revisões versionadas</span>
                <span>Venda rápida de balcão</span>
              </div>
            </article>

            <article className="nf-bento-card medium" data-reveal="pending" style={revealDelay(110)}>
              <div className="nf-icon-box teal"><Scissors className="size-5" /></div>
              <h3>Precificação técnica & plano de corte</h3>
              <p>
                Calcule chapas, m², perdas, insumos, máquinas e custos fixos com precisão. Envie o plano de corte direto
                para o orçamento sem redigitar nada.
              </p>
              <div className="nf-mini-chips">
                <span>Chapas & m²</span>
                <span>Custo hora/máquina</span>
                <span>Margem real</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(60)}>
              <div className="nf-icon-box teal"><Factory className="size-5" /></div>
              <h3>Produção & prova de arte</h3>
              <p>
                Controle cada etapa da OS, envie provas de arte por link para o cliente aprovar ou pedir ajustes e
                registre custos reais de execução.
              </p>
              <div className="nf-mini-chips">
                <span>Kanban / etapas</span>
                <span>Arte por versão</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(130)}>
              <div className="nf-icon-box"><Boxes className="size-5" /></div>
              <h3>Estoque com reserva automática</h3>
              <p>
                Reserve chapas e insumos assim que a OS entra na fila, visualize alertas de saldo insuficiente e dê baixa
                rastreável na conclusão.
              </p>
              <div className="nf-mini-chips">
                <span>Reserva por OS</span>
                <span>Movimentações</span>
              </div>
            </article>

            <article className="nf-bento-card" data-reveal="pending" style={revealDelay(200)}>
              <div className="nf-icon-box teal"><CircleDollarSign className="size-5" /></div>
              <h3>Financeiro, DRE & recibo digital</h3>
              <p>
                Contas a pagar e receber parceladas, fornecedores, ponto de equilíbrio, fluxo projetado e recibo digital
                público pronto para WhatsApp.
              </p>
              <div className="nf-mini-chips">
                <span>Contas a pagar/receber</span>
                <span>DRE & ponto de equilíbrio</span>
              </div>
            </article>

            <article className="nf-bento-card half" data-reveal="pending" style={revealDelay(70)}>
              <div className="nf-icon-box"><Users className="size-5" /></div>
              <h3>Equipe organizada por função (até 10 usuários)</h3>
              <p>
                Convide comercial, produção, estoque e financeiro por link único de e-mail. Cada pessoa enxerga apenas
                sua empresa ativa e seu escopo de trabalho.
              </p>
              <div className="nf-mini-chips">
                <span>Convites com expiração</span>
                <span>Troca de empresa</span>
                <span>Papéis granulares</span>
              </div>
            </article>

            <article className="nf-bento-card half" data-reveal="pending" style={revealDelay(140)}>
              <div className="nf-icon-box teal"><Lock className="size-5" /></div>
              <h3>Arquitetura multiempresa com segurança real</h3>
              <p>
                Isolamento rigoroso por organização no banco de dados (Row Level Security), arquivos separados por empresa
                e identidade própria em cada documento emitido.
              </p>
              <div className="nf-mini-chips">
                <span>Isolamento RLS</span>
                <span>Storage por empresa</span>
                <span>Auditoria</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="nf-section">
        <div className="nf-container">
          <div className="nf-section-head center" data-reveal="pending">
            <p className="nf-kicker">Implantação imediata</p>
            <h2>Comece a operar em menos de 3 minutos.</h2>
            <p>Sem instalação local, sem servidor próprio e sem reuniões intermináveis de setup.</p>
          </div>

          <div className="nf-steps">
            {[
              ["01", "Crie sua conta grátis", "Cadastre seu nome, e-mail e senha. Não pedimos cartão de crédito para iniciar."],
              ["02", "Personalize sua empresa", "Suba sua logo e dados fiscais. Os 7 dias grátis completos são liberados na hora."],
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
